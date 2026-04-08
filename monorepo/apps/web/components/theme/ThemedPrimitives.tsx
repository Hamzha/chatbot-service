import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import Link from "next/link";

type BaseProps = {
    className?: string;
};

function joinClasses(...classes: Array<string | undefined>) {
    return classes.filter(Boolean).join(" ");
}

export function ThemedCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement> & BaseProps) {
    return <div {...props} className={joinClasses("glass rounded-2xl", className)} />;
}

export function ThemedStrongCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement> & BaseProps) {
    return <div {...props} className={joinClasses("glass-strong rounded-2xl", className)} />;
}

export function ThemedInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement> & BaseProps) {
    return (
        <input
            {...props}
            className={joinClasses(
                "glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none",
                className,
            )}
        />
    );
}

export function ThemedSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & BaseProps) {
    return (
        <select
            {...props}
            className={joinClasses(
                "glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none",
                className,
            )}
        />
    );
}

export function ThemedPrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & BaseProps) {
    return (
        <button
            {...props}
            className={joinClasses(
                "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
        />
    );
}

export function ThemedGhostButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & BaseProps) {
    return (
        <button
            {...props}
            className={joinClasses(
                "glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-white/80 disabled:opacity-50",
                className,
            )}
        />
    );
}

export function ThemedDangerButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & BaseProps) {
    return (
        <button
            {...props}
            className={joinClasses(
                "shrink-0 rounded-lg border border-rose-300/70 bg-white/40 px-3 py-1.5 text-xs font-medium text-rose-700 backdrop-blur transition-colors hover:bg-rose-50/60 disabled:opacity-50",
                className,
            )}
        />
    );
}

export function ThemedPrimaryLink({ href, className, ...props }: React.ComponentProps<typeof Link> & BaseProps) {
    return (
        <Link
            href={href}
            {...props}
            className={joinClasses(
                "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800",
                className,
            )}
        />
    );
}

export function ThemedGhostLink({ href, className, ...props }: React.ComponentProps<typeof Link> & BaseProps) {
    return (
        <Link
            href={href}
            {...props}
            className={joinClasses(
                "glass inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white/80",
                className,
            )}
        />
    );
}