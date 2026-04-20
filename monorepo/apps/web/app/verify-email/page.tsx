"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "@/lib/ui/toast";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
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
                const data = await response.json();

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

        verify();
    }, [searchParams, router]);

    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Verifying Email</h2>
                </div>

                <div className="glass-strong rounded-3xl p-8">
                    {status === "loading" && (
                        <div className="text-center">
                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600"></div>
                            <p className="mt-4 text-slate-600">Verifying your email...</p>
                        </div>
                    )}

                    {status === "success" && (
                        <div className="text-center">
                            <div className="glass mx-auto flex h-12 w-12 items-center justify-center rounded-full border-emerald-300/60">
                                <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <p className="mt-4 text-lg font-medium text-slate-900">{message}</p>
                            <p className="mt-2 text-sm text-slate-600">Redirecting to login...</p>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="text-center">
                            <div className="glass mx-auto flex h-12 w-12 items-center justify-center rounded-full border-rose-300/60">
                                <svg className="h-6 w-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </div>
                            <p className="mt-4 text-lg font-medium text-slate-900">Verification Failed</p>
                            <p className="mt-2 text-sm text-slate-600">{message}</p>
                            <button
                                onClick={() => router.push("/login")}
                                className="mt-4 inline-block rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800"
                            >
                                Back to Login
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function VerifyEmailLoadingPage() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="w-full max-w-md">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600"></div>
                    <p className="mt-4 text-slate-600">Loading...</p>
                </div>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<VerifyEmailLoadingPage />}>
            <VerifyEmailContent />
        </Suspense>
    );
}
