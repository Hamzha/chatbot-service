import Link from "next/link";

export function PasswordResetCard() {
    return (
        <section className="glass-strong space-y-2 rounded-2xl p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-900">Password</h2>
            <p className="text-sm text-slate-700">
                For security, password changes use email verification. Request a reset link for your account email.
            </p>
            <Link
                href="/forgot-password"
                className="inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-brand-700 underline-offset-2 hover:text-brand-900 hover:underline"
            >
                Forgot password / reset link
                <span aria-hidden="true">→</span>
            </Link>
        </section>
    );
}
