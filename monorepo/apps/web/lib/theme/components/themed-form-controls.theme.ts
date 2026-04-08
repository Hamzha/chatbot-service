export const themedFormControlsThemeClasses = {
    inputBase:
        "glass-input h-11 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500",
    inputError: "border-red-400 focus:border-red-500 focus:ring-red-500",
    errorText: "-mt-3 text-xs text-red-700",
    submitButton:
        "h-11 rounded-xl bg-brand-700 text-sm font-semibold tracking-wide text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800",
    infoMessage: "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800",
    passwordHint: "-mt-2 text-xs leading-5 text-slate-500",
} as const;
