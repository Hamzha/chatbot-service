/**
 * 🎨 THEME PROVIDER COMPONENT
 * Wraps your app and injects all theme CSS variables
 * 
 * Usage in layout.tsx:
 * <ThemeProvider>
 *   {children}
 * </ThemeProvider>
 */

'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { themeConfig } from './theme';

const ThemeContext = createContext(themeConfig);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        injectThemeVariables();
    }, []);

    return <ThemeContext.Provider value={themeConfig}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}

/**
 * Inject all theme CSS variables into document root
 */
function injectThemeVariables() {
    const root = document.documentElement;

    // Brand colors
    Object.entries(themeConfig.colors.brand).forEach(([shade, color]) => {
        root.style.setProperty(`--theme-brand-${shade}`, color);
    });

    // Surface colors
    root.style.setProperty('--theme-surface', themeConfig.colors.surface);
    root.style.setProperty('--theme-surface-strong', themeConfig.colors.surfaceStrong);
    root.style.setProperty('--theme-surface-muted', themeConfig.colors.surfaceMuted);
    root.style.setProperty('--theme-surface-dark', themeConfig.colors.surfaceDark);

    // Ink colors
    root.style.setProperty('--theme-ink', themeConfig.colors.ink);
    root.style.setProperty('--theme-ink-muted', themeConfig.colors.inkMuted);

    // Hairline colors
    root.style.setProperty('--theme-hairline', themeConfig.colors.hairline);
    root.style.setProperty('--theme-hairline-strong', themeConfig.colors.hairlineStrong);

    // Status colors
    root.style.setProperty('--theme-success', themeConfig.colors.success);
    root.style.setProperty('--theme-warning', themeConfig.colors.warning);
    root.style.setProperty('--theme-danger', themeConfig.colors.danger);

    // Background gradient on body
    document.body.style.backgroundColor = themeConfig.colors.background;
    document.body.style.backgroundImage = themeConfig.background.gradients.join(', ');
    document.body.style.backgroundAttachment = 'fixed';
}
