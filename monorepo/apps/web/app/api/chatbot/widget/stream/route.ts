import { getChatSessionById } from "@/lib/db/chatSessionRepo";
import { findActiveTakeoverForSession } from "@/lib/db/escalationRepo";
import { listWidgetMessagesSince } from "@/lib/db/widgetMessageRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 1500;
const KEEPALIVE_MS = 15_000;
const MAX_STREAM_MS = 25 * 60_000;

function sseEvent(data: unknown): string {
    return `data: ${JSON.stringify(data)}\n\n`;
}

function parseSinceParam(raw: string | null): string {
    if (!raw) return new Date().toISOString();
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const botId = url.searchParams.get("botId")?.trim() ?? "";
    const widgetSessionId = url.searchParams.get("widgetSessionId")?.trim() ?? "";
    const since = parseSinceParam(url.searchParams.get("since"));

    if (!botId) {
        return new Response(JSON.stringify({ error: "Missing botId" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    }
    if (!widgetSessionId || widgetSessionId.length > 128) {
        return new Response(JSON.stringify({ error: "Missing or invalid widgetSessionId" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    }
    const bot = await getChatSessionById(botId);
    if (!bot) {
        return new Response(JSON.stringify({ error: "Invalid botId" }), {
            status: 404,
            headers: { "content-type": "application/json" },
        });
    }

    const encoder = new TextEncoder();
    let lastSeen = since;
    let lastTakeoverActive: boolean | null = null;

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const startedAt = Date.now();
            let closed = false;
            const close = () => {
                if (closed) return;
                closed = true;
                clearInterval(pollTimer);
                clearInterval(keepaliveTimer);
                try {
                    controller.close();
                } catch {
                    /* already closed */
                }
            };

            request.signal.addEventListener("abort", close);

            controller.enqueue(encoder.encode(sseEvent({ type: "hello", widgetSessionId, since: lastSeen })));

            async function tick() {
                if (closed) return;
                if (Date.now() - startedAt > MAX_STREAM_MS) {
                    close();
                    return;
                }
                try {
                    const messages = await listWidgetMessagesSince(widgetSessionId, lastSeen, 100);
                    for (const m of messages) {
                        controller.enqueue(encoder.encode(sseEvent({ type: "message", message: m })));
                        if (m.createdAt > lastSeen) lastSeen = m.createdAt;
                    }
                    const takeover = await findActiveTakeoverForSession(widgetSessionId);
                    const active = Boolean(takeover?.liveTakeover.active);
                    if (lastTakeoverActive === null) {
                        lastTakeoverActive = active;
                        controller.enqueue(
                            encoder.encode(sseEvent({ type: "takeover", active })),
                        );
                    } else if (active !== lastTakeoverActive) {
                        lastTakeoverActive = active;
                        controller.enqueue(
                            encoder.encode(sseEvent({ type: "takeover", active })),
                        );
                    }
                } catch (err) {
                    console.error("[widget:stream] poll error", err);
                }
            }

            const pollTimer = setInterval(tick, POLL_INTERVAL_MS);
            const keepaliveTimer = setInterval(() => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(": keep-alive\n\n"));
                } catch {
                    close();
                }
            }, KEEPALIVE_MS);

            void tick();
        },
    });

    return new Response(stream, {
        headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "x-accel-buffering": "no",
        },
    });
}
