"use client";

import type { InputHTMLAttributes } from "react";
import { useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
    label: string;
    id: string;
};

export function PasswordInput({ label, id, className = "", ...props }: PasswordInputProps) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <label className="flex w-full flex-col gap-1 text-sm text-zinc-700">
            <span className="font-medium">{label}</span>
            <div className="relative">
                <input
                    id={id}
                    type={showPassword ? "text" : "password"}
                    className={`w-full rounded-md border border-zinc-300 px-3 py-2 pr-11 text-zinc-900 outline-none ring-sky-500 transition focus:ring-2 ${className}`}
                    {...props}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 hover:text-zinc-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                >
                    {showPassword ? (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.88 5.09A10.94 10.94 0 0112 5c5 0 9 4 10 7a10.96 10.96 0 01-4.04 5.14M6.1 6.1A11.02 11.02 0 002 12c1 3 5 7 10 7a10.9 10.9 0 004.27-.85"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    ) : (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M2 12c1-3 5-7 10-7s9 4 10 7c-1 3-5 7-10 7s-9-4-10-7z"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                    )}
                </button>
            </div>
        </label>
    );
}
