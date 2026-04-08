/**
 * 🎨 THEME CONFIGURATION
 * All theme colors and values in one place
 */

export const themeConfig = {
    colors: {
        // Brand colors
        brand: {
            50: '#ecfeff',
            100: '#cffafe',
            200: '#a5f3fc',
            300: '#67e8f9',
            400: '#22d3ee',
            500: '#06b6d4',
            600: '#0891b2',
            700: '#0e7490',
            800: '#155e75',
            900: '#164e63',
        },
        // Background + surface colors
        background: '#eef2f7',
        surface: 'rgba(255, 255, 255, 0.65)',
        surfaceStrong: 'rgba(255, 255, 255, 0.82)',
        surfaceMuted: 'rgba(255, 255, 255, 0.45)',
        surfaceDark: 'rgba(15, 23, 42, 0.78)',
        // Text colors
        ink: '#0f172a',
        inkMuted: '#475569',
        // Border colors
        hairline: 'rgba(148, 163, 184, 0.35)',
        hairlineStrong: 'rgba(148, 163, 184, 0.55)',
        // Status colors
        success: '#059669',
        warning: '#d97706',
        danger: '#e11d48',
    },
    background: {
        gradients: [
            'radial-gradient(at 12% 8%, rgba(34, 211, 238, 0.28) 0px, transparent 55%)',
            'radial-gradient(at 88% 12%, rgba(251, 191, 36, 0.22) 0px, transparent 55%)',
            'radial-gradient(at 70% 92%, rgba(99, 102, 241, 0.22) 0px, transparent 55%)',
            'radial-gradient(at 18% 88%, rgba(16, 185, 129, 0.18) 0px, transparent 55%)',
        ],
    },
} as const;

export const themeClasses = {
    inputBase:
        'glass-input h-11 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500',
    inputError: 'border-red-400 focus:border-red-500 focus:ring-red-500',
    errorText: '-mt-3 text-xs text-red-700',
    submitButton:
        'h-11 rounded-xl bg-brand-700 text-sm font-semibold tracking-wide text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800',
    infoMessage:
        'rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800',
    passwordHint: '-mt-2 text-xs leading-5 text-slate-500',
} as const;
