"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";

type DocKind = "upload" | "site";

type OverviewDoc = {
    id: string;
    source: string;
    ragSourceKey: string;
    kind: DocKind;
    chunks: number;
    pages: number;
    createdAt: string;
    updatedAt: string;
};

type OverviewChatbot = {
    id: string;
    name: string;
    primaryColor: string;
    widgetPublicId: string;
    createdAt: string;
    updatedAt: string;
    documents: Array<OverviewDoc & { inLibrary: boolean }>;
    missingDocKeys: string[];
};

type OverviewUser = {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    emailVerified: boolean;
    roles: { id: string; slug: string; name: string; enabled: boolean }[];
    chatbots: OverviewChatbot[];
    documents: Array<OverviewDoc & { attachedTo: { id: string; name: string }[] }>;
    counts: { chatbots: number; documents: number; totalChunks: number };
};

async function readError(res: Response): Promise<string> {
    try {
        const j = (await res.json()) as { error?: string };
        return j.error ?? res.statusText;
    } catch {
        return await res.text();
    }
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function KindBadge({ kind }: { kind: DocKind }) {
    const label = kind === "site" ? "Site" : "Upload";
    const cls =
        kind === "site"
            ? "bg-indigo-100 text-indigo-800"
            : "bg-emerald-100 text-emerald-800";
    return (
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
            {label}
        </span>
    );
}

export function AdminOverviewClient() {
    const [users, setUsers] = useState<OverviewUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const res = await fetch("/api/admin/overview", { credentials: "include" });
            if (!res.ok) throw new Error(await readError(res));
            const j = (await res.json()) as { users: OverviewUser[] };
            setUsers(j.users);
            setExpanded(new Set(j.users.length > 0 && j.users[0] ? [j.users[0].id] : []));
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return users;
        return users.filter(
            (u) =>
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                u.chatbots.some((c) => c.name.toLowerCase().includes(q)) ||
                u.documents.some((d) => d.source.toLowerCase().includes(q)),
        );
    }, [users, search]);

    const totals = useMemo(() => {
        return users.reduce(
            (acc, u) => ({
                users: acc.users + 1,
                chatbots: acc.chatbots + u.counts.chatbots,
                documents: acc.documents + u.counts.documents,
                chunks: acc.chunks + u.counts.totalChunks,
            }),
            { users: 0, chatbots: 0, documents: 0, chunks: 0 },
        );
    }, [users]);

    const toggle = (userId: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    if (loading) {
        return (
            <PageContainer size="7xl">
                <p className="text-sm text-slate-700" role="status" aria-live="polite">
                    Loading platform overview…
                </p>
            </PageContainer>
        );
    }

    return (
        <PageContainer size="7xl">
            <PageHeader
                variant="plain"
                eyebrow="Super admin"
                title="Platform overview"
                subtitle="Every user, the chatbots they've created, and the documents each chatbot is attached to."
                actions={
                    <button
                        type="button"
                        onClick={() => void load()}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    >
                        Refresh
                    </button>
                }
            />

            {error ? (
                <div
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                    role="alert"
                >
                    {error}
                </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Users" value={totals.users} />
                <Stat label="Chatbots" value={totals.chatbots} />
                <Stat label="Documents" value={totals.documents} />
                <Stat label="Total chunks" value={totals.chunks} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users, chatbots, or documents…"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm placeholder:text-slate-400 sm:max-w-md"
                />
                <p className="text-xs text-slate-600">
                    Showing {filtered.length} of {users.length} users
                </p>
            </div>

            <ul className="space-y-3">
                {filtered.map((u) => {
                    const isOpen = expanded.has(u.id);
                    return (
                        <li
                            key={u.id}
                            className="overflow-hidden rounded-2xl border border-white/40 bg-white/70 shadow-sm"
                        >
                            <button
                                type="button"
                                onClick={() => toggle(u.id)}
                                aria-expanded={isOpen}
                                className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-white"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="wrap-break-word text-base font-semibold text-slate-900">
                                            {u.name}
                                        </span>
                                        <span className="text-sm text-slate-600">·</span>
                                        <span className="wrap-break-word text-sm text-slate-700">{u.email}</span>
                                        {!u.emailVerified ? (
                                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                                                unverified
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                        <span>
                                            <strong className="text-slate-900">{u.counts.chatbots}</strong> chatbots
                                        </span>
                                        <span>
                                            <strong className="text-slate-900">{u.counts.documents}</strong> docs
                                        </span>
                                        <span>
                                            <strong className="text-slate-900">{u.counts.totalChunks}</strong> chunks
                                        </span>
                                        <span>Joined {formatDate(u.createdAt)}</span>
                                        {u.roles.length > 0 ? (
                                            <span className="flex flex-wrap items-center gap-1">
                                                {u.roles.map((r) => (
                                                    <span
                                                        key={r.id}
                                                        className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700"
                                                    >
                                                        {r.slug}
                                                    </span>
                                                ))}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                <span
                                    aria-hidden="true"
                                    className={`mt-1 text-slate-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                                >
                                    ›
                                </span>
                            </button>

                            {isOpen ? (
                                <div className="border-t border-slate-100 bg-white/90 px-5 py-4">
                                    <UserDetail user={u} />
                                </div>
                            ) : null}
                        </li>
                    );
                })}
                {filtered.length === 0 ? (
                    <li className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-5 py-8 text-center text-sm text-slate-700">
                        No users match the current search.
                    </li>
                ) : null}
            </ul>
        </PageContainer>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
    );
}

function UserDetail({ user }: { user: OverviewUser }) {
    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                    Chatbots ({user.chatbots.length})
                </h3>
                {user.chatbots.length === 0 ? (
                    <p className="text-xs text-slate-600">This user has not created any chatbots.</p>
                ) : (
                    <ul className="space-y-3">
                        {user.chatbots.map((c) => (
                            <li
                                key={c.id}
                                className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
                            >
                                <div className="flex items-start gap-3">
                                    <span
                                        aria-hidden="true"
                                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                                        style={{ backgroundColor: c.primaryColor }}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="wrap-break-word text-sm font-semibold text-slate-900">
                                            {c.name}
                                        </p>
                                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
                                            widget: {c.widgetPublicId}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-slate-600">
                                            Updated {formatDate(c.updatedAt)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                        Attached documents ({c.documents.length})
                                    </p>
                                    {c.documents.length === 0 && c.missingDocKeys.length === 0 ? (
                                        <p className="mt-1 text-xs text-slate-500">
                                            No documents attached.
                                        </p>
                                    ) : (
                                        <ul className="mt-1 space-y-1">
                                            {c.documents.map((d) => (
                                                <li
                                                    key={d.id}
                                                    className="flex flex-wrap items-center gap-2 text-xs text-slate-800"
                                                >
                                                    <KindBadge kind={d.kind} />
                                                    <span className="wrap-break-word">{d.source}</span>
                                                    <span className="text-slate-500">
                                                        ({d.chunks} chunks
                                                        {d.kind === "site" && d.pages > 0 ? `, ${d.pages} pages` : ""})
                                                    </span>
                                                </li>
                                            ))}
                                            {c.missingDocKeys.map((k) => (
                                                <li
                                                    key={k}
                                                    className="flex flex-wrap items-center gap-2 text-xs text-amber-800"
                                                >
                                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                                                        missing
                                                    </span>
                                                    <span className="wrap-break-word font-mono">{k}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                    Ingested documents ({user.documents.length})
                </h3>
                {user.documents.length === 0 ? (
                    <p className="text-xs text-slate-600">This user has not ingested any documents.</p>
                ) : (
                    <ul className="space-y-2">
                        {user.documents.map((d) => (
                            <li
                                key={d.id}
                                className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <KindBadge kind={d.kind} />
                                    <span className="wrap-break-word text-sm font-semibold text-slate-900">
                                        {d.source}
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-600">
                                    {d.chunks} chunks
                                    {d.kind === "site" && d.pages > 0 ? ` · ${d.pages} pages` : ""}
                                    {" · "}
                                    Updated {formatDate(d.updatedAt)}
                                </p>
                                <div className="mt-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                        Attached to
                                    </p>
                                    {d.attachedTo.length === 0 ? (
                                        <p className="text-xs text-slate-500">Not attached to any chatbot.</p>
                                    ) : (
                                        <ul className="mt-1 flex flex-wrap gap-1">
                                            {d.attachedTo.map((c) => (
                                                <li
                                                    key={c.id}
                                                    className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800"
                                                >
                                                    {c.name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
