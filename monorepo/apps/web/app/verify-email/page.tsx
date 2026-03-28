"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
                return;
            }

            try {
                const response = await fetch(`/api/auth/verify-email?token=${token}`);
                const data = await response.json();

                if (!response.ok) {
                    setStatus("error");
                    setMessage(data.error || "Verification failed.");
                    return;
                }

                setStatus("success");
                setMessage(data.message || "Email verified successfully!");

                setTimeout(() => {
                    router.push("/login");
                }, 3000);
            } catch {
                setStatus("error");
                setMessage("Something went wrong. Please try again.");
            }
        }

        verify();
    }, [searchParams, router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">Verifying Email</h2>
                </div>

                <div className="rounded-lg bg-white p-8 shadow">
                    {status === "loading" && (
                        <div className="text-center">
                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-sky-600"></div>
                            <p className="mt-4 text-gray-600">Verifying your email...</p>
                        </div>
                    )}

                    {status === "success" && (
                        <div className="text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <p className="mt-4 text-lg font-medium text-gray-900">{message}</p>
                            <p className="mt-2 text-sm text-gray-600">Redirecting to login...</p>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </div>
                            <p className="mt-4 text-lg font-medium text-gray-900">Verification Failed</p>
                            <p className="mt-2 text-sm text-gray-600">{message}</p>
                            <button
                                onClick={() => router.push("/login")}
                                className="mt-4 inline-block rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
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
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-md">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-sky-600"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
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
