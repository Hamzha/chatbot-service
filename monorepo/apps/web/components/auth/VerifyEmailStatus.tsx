"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "@/lib/ui/toast";

type Status = "loading" | "success" | "error";

export function VerifyEmailStatus() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<Status>("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        async function verify() {
            const token = searchParams.get("token");

            if (!token) {
                setStatus("error");
                setMessage("No verification token provided.");
                toast.error("No verification token provided.");
                return;
            }

            try {
                const response = await fetch(`/api/auth/verify-email?token=${token}`);
                const data = (await response.json()) as { message?: string; error?: string };

                if (!response.ok) {
                    const msg = data.error || "Verification failed.";
                    setStatus("error");
                    setMessage(msg);
                    toast.error(msg);
                    return;
                }

                setStatus("success");
                setMessage(data.message || "Email verified successfully!");
                toast.success("Email verified");

                setTimeout(() => {
                    router.push("/login");
                }, 3000);
            } catch {
                setStatus("error");
                setMessage("Something went wrong. Please try again.");
                toast.error("Something went wrong. Please try again.");
            }
        }

        void verify();
    }, [searchParams, router]);

    if (status === "loading") {
        return (
            <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-4 text-center">
                <div
                    className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600"
                    aria-hidden="true"
                />
                <p className="text-sm text-slate-700">Verifying your email…</p>
            </div>
        );
    }

    if (status === "success") {
        return (
            <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-2 text-center">
                <div className="glass flex h-12 w-12 items-center justify-center rounded-full border-emerald-300/60" aria-hidden="true">
                    <svg className="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <p className="text-base font-semibold text-slate-900">{message}</p>
                <p className="text-sm text-slate-600">Redirecting you to log in…</p>
                <Link
                    href="/login"
                    className="text-sm font-semibold text-brand-700 underline-offset-2 hover:text-brand-900 hover:underline"
                >
                    Continue to log in now
                </Link>
            </div>
        );
    }

    return (
        <div role="alert" className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="glass flex h-12 w-12 items-center justify-center rounded-full border-rose-300/60" aria-hidden="true">
                <svg className="h-6 w-6 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
            <p className="text-base font-semibold text-slate-900">Verification failed</p>
            <p className="text-sm text-slate-700">{message}</p>
            <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800"
            >
                Back to log in
            </Link>
        </div>
    );
}
