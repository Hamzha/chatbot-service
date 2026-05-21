import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/requireApiPermission";
import {
    countOpenEscalationsForOwner,
    listEscalationsSinceForOwner,
} from "@/lib/db/escalationRepo";

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
    const gate = await requireApiPermission("escalations:read");
    if (gate instanceof NextResponse) return gate;

    const ownerId = gate.ctx.userId;
    const url = new URL(request.url);
    const since = parseSinceParam(url.searchParams.get("since"));

    const encoder = new TextEncoder();
    let lastSeen = since;
    let lastOpenCount = await countOpenEscalationsForOwner(ownerId);

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
                        since: lastSeen,
                        openCount: lastOpenCount,
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
                    const rows = await listEscalationsSinceForOwner(ownerId, lastSeen, 50);
                    for (const r of rows) {
                        controller.enqueue(
                            encoder.encode(
                                sseEvent({
                                    type: "new",
                                    escalation: {
                                        id: r.id,
                                        reason: r.reason,
                                        status: r.status,
                                        widgetSessionId: r.widgetSessionId,
                                        chatbotId: r.chatbotId,
                                        contact: r.contact,
                                        createdAt: r.createdAt,
                                    },
                                }),
                            ),
                        );
                        if (r.createdAt > lastSeen) lastSeen = r.createdAt;
                    }
                    const openCount = await countOpenEscalationsForOwner(ownerId);
                    if (openCount !== lastOpenCount) {
                        lastOpenCount = openCount;
                        controller.enqueue(
                            encoder.encode(sseEvent({ type: "count", openCount })),
                        );
                    }
                } catch (err) {
                    console.error("[escalations:notifications] poll error", err);
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
