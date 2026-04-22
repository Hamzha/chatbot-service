import Link from "next/link";

type SiteFooterWidth = "6xl" | "7xl";

type SiteFooterProps = {
    width?: SiteFooterWidth;
};

const WIDTH_CLASS: Record<SiteFooterWidth, string> = {
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
};

/**
 * Site-wide footer shown on every page except the embeddable chatbot iframe
 * (`/widget/[botId]`).
 *
 * Width is controlled by the `width` prop so each shell can align the footer
 * with its own content column.
 */
export function SiteFooter({ width = "6xl" }: SiteFooterProps = {}) {
    return (
        <footer className={`mx-auto w-full ${WIDTH_CLASS[width]}`.trim()}>
            <div className="glass flex flex-col items-start justify-between gap-4 rounded-2xl px-5 py-4 text-sm text-slate-600 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href="/"
                        aria-label="AI Chatbot Platform — home"
                        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 rounded-lg"
                    >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-xs font-bold text-white">
                            AI
                        </span>
                    </Link>
                    <span className="font-semibold text-slate-900">Chatbot Platform</span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span>© {new Date().getFullYear()}</span>
                </div>
                <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Link href="/login" className="transition hover:text-slate-900">
                        Log in
                    </Link>
                    <Link href="/signup" className="transition hover:text-slate-900">
                        Sign up
                    </Link>
                    <Link href="/dashboard" className="transition hover:text-slate-900">
                        Dashboard
                    </Link>
                    <Link href="/#faq" className="transition hover:text-slate-900">
                        FAQ
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
