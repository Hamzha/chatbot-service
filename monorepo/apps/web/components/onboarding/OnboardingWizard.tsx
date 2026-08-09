"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/shell/PageContainer";
import {
    assertOkJson,
    formatApiErrorMessage,
    parseJsonResponse,
} from "@/lib/chatbot/parseJsonResponse";
import { toast } from "@/lib/ui/toast";
import { extractErrorMessage } from "@/lib/ui/notifyMutation";

type UseCase = "support" | "sales" | "faq" | "other";
type Step = "welcome" | "useCase" | "content" | "bot" | "done";

type LibraryDoc = {
    id: string;
    source: string;
    chunks: number;
    kind?: "upload" | "site";
    ragSourceKey?: string;
};

type JobStatus = {
    status: string;
    output: { ingested?: number; source?: string } | null;
};

const SUCCESS_STATES = ["Completed", "Succeeded", "Success", "Finished"];

const USE_CASES: { id: UseCase; label: string; hint: string }[] = [
    { id: "support", label: "Customer support", hint: "Answer FAQs and ticket-style questions" },
    { id: "sales", label: "Sales / lead help", hint: "Product info and qualification" },
    { id: "faq", label: "Website FAQ bot", hint: "Docs and site content Q&A" },
    { id: "other", label: "Something else", hint: "I’ll set it up myself" },
];

const STEPS: Step[] = ["welcome", "useCase", "content", "bot", "done"];

async function pollJob(eventId: string): Promise<JobStatus> {
    for (let i = 0; i < 60; i += 1) {
        const res = await fetch(`/api/chatbot/jobs/${eventId}`);
        const data = await parseJsonResponse<JobStatus>(res);
        assertOkJson(res, data);
        if (SUCCESS_STATES.includes(data.status)) {
            return data;
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    return { status: "timeout", output: null };
}

async function loadDocuments(): Promise<LibraryDoc[]> {
    const res = await fetch("/api/chatbot/documents");
    const data = await parseJsonResponse<{ sources?: LibraryDoc[] }>(res);
    if (!res.ok) return [];
    return data.sources ?? [];
}

function hostFromUrl(url: string): string | null {
    try {
        return new URL(url).host;
    } catch {
        return null;
    }
}

type Props = {
    userName: string;
};

export function OnboardingWizard({ userName }: Props) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>("welcome");
    const [useCase, setUseCase] = useState<UseCase | null>(null);
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [documentId, setDocumentId] = useState<string | null>(null);
    const [botName, setBotName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const firstName = useMemo(() => userName.split(" ")[0] || "there", [userName]);
    const stepIndex = STEPS.indexOf(step);

    async function finishOnboarding(opts?: { skipped?: boolean; sessionId?: string | null }) {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch("/api/auth/onboarding", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    useCase,
                    websiteUrl: websiteUrl.trim() || null,
                    skipped: Boolean(opts?.skipped),
                }),
            });
            const data = await parseJsonResponse<{ error?: string }>(res);
            assertOkJson(res, data);
            setStep("done");
            router.refresh();
            const nextPath = opts?.sessionId
                ? `/dashboard/chatbot/${opts.sessionId}`
                : "/dashboard";
            setTimeout(() => {
                router.push(nextPath);
                router.refresh();
            }, 900);
        } catch (err) {
            setError(extractErrorMessage(err, "Could not save onboarding."));
        } finally {
            setBusy(false);
        }
    }

    async function onSkip() {
        await finishOnboarding({ skipped: true });
    }

    async function ingestPdf(): Promise<string | null> {
        if (!file) return null;
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/chatbot/ingest", { method: "POST", body: fd });
        const body = await parseJsonResponse<{
            event_ids?: string[];
            document?: { id: string; source: string };
            error?: string;
        }>(res);
        assertOkJson(res, body);
        const eventId = body.event_ids?.[0];
        const id = body.document?.id;
        if (!eventId || !id) {
            throw new Error("Unexpected response from ingest.");
        }
        const job = await pollJob(eventId);
        if (job.output?.ingested != null && SUCCESS_STATES.includes(job.status)) {
            await fetch("/api/chatbot/documents", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ documentId: id, chunks: job.output.ingested }),
            });
        } else {
            throw new Error(`Ingest status: ${job.status}`);
        }
        return id;
    }

    async function scrapeWebsite(): Promise<string | null> {
        const url = websiteUrl.trim();
        if (!url) return null;
        const res = await fetch("/api/scraper/scrape", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url }),
        });
        const data = await parseJsonResponse<{
            success?: boolean;
            ingestion?: { ingested?: number; displaySource?: string };
            error?: string;
        }>(res);
        if (!res.ok) {
            throw new Error(formatApiErrorMessage(data, res.status));
        }
        if (!data.success) {
            throw new Error("Scrape did not succeed.");
        }
        const docs = await loadDocuments();
        const host = hostFromUrl(url);
        const match =
            docs.find((d) => d.kind === "site" && host && d.source === host) ||
            docs.find((d) => host && (d.source === host || d.ragSourceKey?.includes(host))) ||
            docs[0];
        return match?.id ?? null;
    }

    async function onContentContinue() {
        setBusy(true);
        setError(null);
        const loadingId = toast.loading("Preparing your knowledge…");
        try {
            let id: string | null = null;
            if (file) {
                id = await ingestPdf();
            } else if (websiteUrl.trim()) {
                id = await scrapeWebsite();
            }
            setDocumentId(id);
            toast.success(id ? "Knowledge ready" : "You can add content later", { id: loadingId });
            setStep("bot");
        } catch (err) {
            const msg = extractErrorMessage(err, "Could not add content.");
            setError(msg);
            toast.error(msg, { id: loadingId });
        } finally {
            setBusy(false);
        }
    }

    async function onCreateBot(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            if (documentId) {
                const res = await fetch("/api/chatbot/sessions", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        name: botName.trim() || "My first bot",
                        documentIds: [documentId],
                    }),
                });
                const data = await parseJsonResponse<{
                    session?: { id: string };
                    error?: string;
                }>(res);
                assertOkJson(res, data);
                const sessionId = data.session?.id ?? null;
                await finishOnboarding({ sessionId });
            } else {
                await finishOnboarding();
            }
        } catch (err) {
            setError(extractErrorMessage(err, "Could not create bot."));
            setBusy(false);
        }
    }

    return (
        <PageContainer>
            <div className="mx-auto max-w-xl">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                        Setup · Step {Math.min(stepIndex + 1, STEPS.length - 1)} of {STEPS.length - 1}
                    </p>
                    {step !== "done" && (
                        <button
                            type="button"
                            onClick={() => void onSkip()}
                            disabled={busy}
                            className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-50"
                        >
                            Skip for now
                        </button>
                    )}
                </div>

                <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                        className="h-full rounded-full bg-brand-700 transition-all duration-300"
                        style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
                    />
                </div>

                <div className="glass-strong rounded-2xl p-6 sm:p-8">
                    {step === "welcome" && (
                        <div className="space-y-5">
                            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                                Welcome, {firstName}
                            </h1>
                            <p className="text-sm leading-6 text-slate-700">
                                You’re on a free trial with usage limits. This short setup helps you
                                create your first chatbot from a website or PDF — you can skip anytime.
                            </p>
                            <button
                                type="button"
                                onClick={() => setStep("useCase")}
                                className="inline-flex w-full items-center justify-center rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800"
                            >
                                Get started
                            </button>
                        </div>
                    )}

                    {step === "useCase" && (
                        <div className="space-y-5">
                            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                                What are you building?
                            </h1>
                            <p className="text-sm text-slate-700">Pick the closest match — you can change direction later.</p>
                            <div className="grid gap-2">
                                {USE_CASES.map((item) => {
                                    const selected = useCase === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setUseCase(item.id)}
                                            className={`rounded-xl border px-4 py-3 text-left transition ${
                                                selected
                                                    ? "border-brand-600 bg-brand-50"
                                                    : "border-slate-200 bg-white/60 hover:border-slate-300"
                                            }`}
                                        >
                                            <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                                            <p className="mt-0.5 text-xs text-slate-600">{item.hint}</p>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep("welcome")}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    disabled={!useCase}
                                    onClick={() => setStep("content")}
                                    className="flex-1 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    )}

                    {step === "content" && (
                        <div className="space-y-5">
                            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                                Add knowledge
                            </h1>
                            <p className="text-sm text-slate-700">
                                Scrape a page or upload a PDF. Optional — you can do this later from the dashboard.
                            </p>

                            <label className="block space-y-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    Website URL
                                </span>
                                <input
                                    type="url"
                                    value={websiteUrl}
                                    onChange={(e) => {
                                        setWebsiteUrl(e.target.value);
                                        if (e.target.value.trim()) setFile(null);
                                    }}
                                    placeholder="https://example.com"
                                    className="glass-input h-11 w-full rounded-xl px-3 text-sm text-slate-900"
                                    disabled={busy || Boolean(file)}
                                />
                            </label>

                            <div className="relative flex items-center gap-3">
                                <div className="h-px flex-1 bg-slate-200" />
                                <span className="text-xs font-medium text-slate-500">or</span>
                                <div className="h-px flex-1 bg-slate-200" />
                            </div>

                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                        const picked = e.target.files?.[0] ?? null;
                                        setFile(picked);
                                        if (picked) setWebsiteUrl("");
                                    }}
                                />
                                <button
                                    type="button"
                                    disabled={busy || Boolean(websiteUrl.trim())}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full rounded-xl border border-dashed border-slate-300 bg-white/50 px-4 py-6 text-sm text-slate-700 disabled:opacity-50"
                                >
                                    {file ? `Selected: ${file.name}` : "Upload a PDF"}
                                </button>
                            </div>

                            {error && <p className="text-sm text-red-600">{error}</p>}

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep("useCase")}
                                    disabled={busy}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void onContentContinue()}
                                    className="flex-1 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {busy
                                        ? "Working…"
                                        : websiteUrl.trim() || file
                                          ? "Continue"
                                          : "Skip content"}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === "bot" && (
                        <form className="space-y-5" onSubmit={(e) => void onCreateBot(e)}>
                            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                                Name your bot
                            </h1>
                            <p className="text-sm text-slate-700">
                                {documentId
                                    ? "We’ll create your first chatbot with the knowledge you added."
                                    : "No knowledge yet — finish setup and create a bot later from Chatbot → New."}
                            </p>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    Bot name
                                </span>
                                <input
                                    type="text"
                                    value={botName}
                                    onChange={(e) => setBotName(e.target.value)}
                                    placeholder="My first bot"
                                    className="glass-input h-11 w-full rounded-xl px-3 text-sm text-slate-900"
                                    disabled={busy || !documentId}
                                />
                            </label>
                            {error && <p className="text-sm text-red-600">{error}</p>}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep("content")}
                                    disabled={busy}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={busy}
                                    className="flex-1 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {busy ? "Finishing…" : documentId ? "Create bot & finish" : "Finish setup"}
                                </button>
                            </div>
                        </form>
                    )}

                    {step === "done" && (
                        <div className="space-y-3 text-center">
                            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">You’re set</h1>
                            <p className="text-sm text-slate-700">Taking you to the dashboard…</p>
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
