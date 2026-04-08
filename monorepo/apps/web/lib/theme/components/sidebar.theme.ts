export const sidebarThemeClasses = {
    root: "fixed bottom-4 left-4 top-4 flex w-60 flex-col overflow-hidden",
    header: "border-b border-white/30 p-6",
    title: "text-lg font-semibold text-slate-900",
    subtitle: "mt-1 text-sm text-slate-500",
    nav: "flex-1 space-y-1 p-4",
    navItem: "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
    navItemActive: "glass border-brand-300/60 text-brand-800 shadow-sm",
    navItemInactive: "text-slate-600 hover:bg-white/40 hover:text-slate-900",
    footer: "border-t border-white/30 p-4",
    profileWrap: "mb-3",
    profileName: "truncate text-sm font-medium text-slate-900",
    profileEmail: "truncate text-xs text-slate-500",
} as const;
