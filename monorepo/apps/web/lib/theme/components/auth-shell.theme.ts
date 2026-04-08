export const authShellThemeClasses = {
    root: "relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 sm:py-10",
    shell: "glass-strong relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl lg:grid-cols-[1fr_1.05fr]",
    sidePanel: "glass-dark relative hidden p-10 lg:flex lg:flex-col lg:justify-between",
    sideSection: "space-y-4",
    sideBadge:
        "inline-flex items-center rounded-full border border-brand-300/40 bg-brand-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-100 backdrop-blur",
    sideTitle: "max-w-sm text-3xl font-semibold leading-tight text-white",
    sideDescription: "max-w-md text-sm leading-6 text-slate-200",
    pointsList: "space-y-3",
    pointItem: "flex items-start gap-3 text-sm text-slate-100/90",
    pointBullet: "mt-1 inline-block h-2 w-2 rounded-full bg-brand-300",
    contentWrap: "flex items-center justify-center p-5 sm:p-8 lg:p-12",
    contentCard: "glass w-full max-w-md space-y-6 rounded-2xl p-6 sm:p-8",
    headerBlock: "space-y-2",
    mainBadge:
        "inline-flex items-center rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white backdrop-blur",
    title: "text-3xl font-semibold leading-tight text-slate-900",
    subtitle: "text-sm leading-6 text-slate-600",
    footer: "border-t border-white/30 pt-4 text-sm text-slate-600",
} as const;
