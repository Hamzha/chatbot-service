import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import { getEscalation } from "@/lib/db/escalationRepo";
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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
    const gate = await requireApiPermission("escalations:read");
    if (gate instanceof NextResponse) return gate;

    const { id } = await context.params;
    const ticket = await getEscalation(id, gate.ctx.userId);
    if (!ticket) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const since = parseSinceParam(url.searchParams.get("since"));
    const widgetSessionId = ticket.widgetSessionId;
    const ownerId = gate.ctx.userId;

    const encoder = new TextEncoder();
    let lastSeen = since;
    let lastTakeoverActive: boolean | null = ticket.liveTakeover.active;
    let lastStatus = ticket.status;

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

            controller.enqueue(
                encoder.encode(
                    sseEvent({
                        type: "hello",
                        ticketId: id,
                        since: lastSeen,
                        takeoverActive: lastTakeoverActive,
                        status: lastStatus,
                    }),
                ),
            );

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
                    const fresh = await getEscalation(id, ownerId);
                    if (fresh) {
                        const active = fresh.liveTakeover.active;
                        if (active !== lastTakeoverActive) {
                            lastTakeoverActive = active;
                            controller.enqueue(
                                encoder.encode(sseEvent({ type: "takeover", active })),
                            );
                        }
                        if (fresh.status !== lastStatus) {
                            lastStatus = fresh.status;
                            controller.enqueue(
                                encoder.encode(sseEvent({ type: "status", status: fresh.status })),
                            );
                        }
                    }
                } catch (err) {
                    console.error("[escalation:stream] poll error", err);
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
