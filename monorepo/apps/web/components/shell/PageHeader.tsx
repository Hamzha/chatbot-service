import type { ReactNode } from "react";

type PageHeaderProps = {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    /** Optional actions (buttons / links). Stacks below on mobile, right-aligned on `sm+`. */
    actions?: ReactNode;
    /** `plain` = no card; `card` = wrapped in `.glass-strong` card. Defaults to `card`. */
    variant?: "plain" | "card";
    /** Extra id for aria-labelledby etc. */
    headingId?: string;
};

/**
 * Consistent page header for every dashboard route.
 *
 * Responsive behaviour:
 * - Title ladder: `text-2xl sm:text-3xl`.
 * - Subtitle reads at `text-sm` on mobile, `text-base leading-6` on larger.
 * - Actions slot wraps below heading on mobile and sits to the right on `sm+`.
 * - Card variant pads `p-5 sm:p-6` to reclaim space on small screens.
 */
export function PageHeader({
    eyebrow,
    title,
    subtitle,
    actions,
    variant = "card",
    headingId,
}: PageHeaderProps) {
    const body = (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 space-y-1.5">
                {eyebrow ? (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                        {eyebrow}
                    </p>
                ) : null}
                <h1
                    id={headingId}
                    className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl"
                >
                    {title}
                </h1>
                {subtitle ? (
                    <p className="max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>
                ) : null}
            </div>
            {actions ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
                    {actions}
                </div>
            ) : null}
        </div>
    );

    if (variant === "plain") {
        return <header className="w-full">{body}</header>;
    }

    return (
        <header className="glass-strong rounded-2xl p-5 sm:p-6">{body}</header>
    );
}
