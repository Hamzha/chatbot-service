"use client";

import { useRouter } from "next/navigation";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { toast } from "@/lib/ui/toast";

type NotificationsState = {
    openCount: number;
    refreshCount: () => Promise<void>;
};

type NewEscalationPayload = {
    id: string;
    reason: "user_request" | "low_confidence" | "manual";
    status: "open" | "in_progress" | "resolved";
    widgetSessionId: string;
    chatbotId: string;
    contact: { name: string; email: string };
    createdAt: string;
};

type StreamEvent =
    | { type: "hello"; since: string; openCount: number }
    | { type: "new"; escalation: NewEscalationPayload }
    | { type: "count"; openCount: number };

const NotificationsContext = createContext<NotificationsState>({
    openCount: 0,
    refreshCount: async () => {},
});

export function useEscalationNotifications(): NotificationsState {
    return useContext(NotificationsContext);
}

function describeReason(reason: NewEscalationPayload["reason"]): string {
    if (reason === "low_confidence") return "auto-detected";
    if (reason === "user_request") return "visitor request";
    return "manual";
}

export function EscalationNotificationsProvider({
    enabled,
    children,
}: {
    enabled: boolean;
    children: ReactNode;
}) {
    const router = useRouter();
    const [openCount, setOpenCount] = useState(0);
    const seenIdsRef = useRef<Set<string>>(new Set());
    const mountedAtRef = useRef<string>(new Date().toISOString());

    const refreshCount = useCallback(async () => {
        if (!enabled) return;
        try {
            const res = await fetch("/api/chatbot/escalations/unread-count", { cache: "no-store" });
            if (!res.ok) return;
            const data = (await res.json()) as { count?: number };
            if (typeof data.count === "number") setOpenCount(data.count);
        } catch {
            /* ignore */
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return;
        void refreshCount();
    }, [enabled, refreshCount]);

    useEffect(() => {
        if (!enabled) return;
        const since = mountedAtRef.current;
        const es = new EventSource(
            `/api/chatbot/escalations/notifications/stream?since=${encodeURIComponent(since)}`,
        );

        es.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data) as StreamEvent;
                if (data.type === "hello") {
                    if (typeof data.openCount === "number") setOpenCount(data.openCount);
                    return;
                }
                if (data.type === "count") {
                    setOpenCount(data.openCount);
                    return;
                }
                if (data.type === "new") {
                    const e = data.escalation;
                    if (seenIdsRef.current.has(e.id)) return;
                    seenIdsRef.current.add(e.id);
                    toast.info(`New escalation — ${describeReason(e.reason)}`, {
                        duration: 8000,
                        action: {
                            label: "Open",
                            onClick: () => router.push(`/dashboard/inbox/${e.id}`),
                        },
                    });
                }
            } catch {
                /* ignore */
            }
        };
        es.onerror = () => {
            /* EventSource auto-reconnects; nothing to do */
        };

        return () => {
            es.close();
        };
    }, [enabled, router]);

    return (
        <NotificationsContext.Provider value={{ openCount, refreshCount }}>
            {children}
        </NotificationsContext.Provider>
    );
}
