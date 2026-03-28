import type { PropsWithChildren } from "react";

type AuthCardProps = PropsWithChildren<{
    title: string;
    subtitle: string;
}>;

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
    return (
        <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-6 space-y-1">
                <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
                <p className="text-sm text-zinc-600">{subtitle}</p>
            </div>
            {children}
        </section>
    );
}
