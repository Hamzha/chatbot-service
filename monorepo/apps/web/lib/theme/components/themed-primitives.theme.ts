export const themedPrimitivesThemeClasses = {
    card: "glass rounded-2xl",
    strongCard: "glass-strong rounded-2xl",
    input:
        "glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none",
    select:
        "glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none",
    primaryButton:
        "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50",
    ghostButton:
        "glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-white/80 disabled:opacity-50",
    dangerButton:
        "shrink-0 rounded-lg border border-rose-300/70 bg-white/40 px-3 py-1.5 text-xs font-medium text-rose-700 backdrop-blur transition-colors hover:bg-rose-50/60 disabled:opacity-50",
    primaryLink:
        "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800",
    ghostLink:
        "glass inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white/80",
} as const;
