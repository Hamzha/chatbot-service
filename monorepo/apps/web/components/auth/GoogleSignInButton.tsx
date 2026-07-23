import Link from "next/link";

type GoogleSignInButtonProps = {
    label?: string;
};

export function GoogleSignInButton({ label = "Continue with Google" }: GoogleSignInButtonProps) {
    return (
        <Link
            href="/api/auth/google"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
                <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.5H12z"
                />
                <path
                    fill="#34A853"
                    d="M3.9 7.5l3.2 2.3C8 7.5 9.8 6.3 12 6.3c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 8.4 2.3 5.3 4.4 3.9 7.5z"
                />
                <path
                    fill="#4A90E2"
                    d="M12 20.7c2.5 0 4.6-.8 6.1-2.2l-3-2.4c-.8.6-1.9 1-3.1 1-3.9 0-5.3-2.5-5.5-3.8l-3.2 2.5C5.2 18.6 8.3 20.7 12 20.7z"
                />
                <path
                    fill="#FBBC05"
                    d="M20.6 12c0-.6-.1-1-.2-1.5H12v3.9h5.5c-.3 1.2-1.1 2.2-2.3 2.9l3 2.4c1.8-1.6 2.4-4 2.4-7.7z"
                />
            </svg>
            {label}
        </Link>
    );
}

export function AuthDivider() {
    return (
        <div className="relative my-5">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-white/80 px-2 text-slate-500">or</span>
            </div>
        </div>
    );
}
