# Theme System Guide

This project uses a component-level theme structure.

Goal:

- Global design tokens are centralized.
- Every reusable component has its own theme file.
- Feature code uses component wrappers, not repeated class bundles.

## Theme Folder Structure

- lib/theme/tokens.ts
- lib/theme/index.ts
- lib/theme/components/themed-form-controls.theme.ts
- lib/theme/components/themed-primitives.theme.ts
- lib/theme/components/auth-shell.theme.ts
- lib/theme/components/login-form.theme.ts
- lib/theme/components/signup-form.theme.ts
- lib/theme/components/logout-button.theme.ts
- lib/theme/components/sidebar.theme.ts
- lib/theme/components/dashboard.theme.ts
- lib/theme/components/landing.theme.ts

## Runtime And CSS Infrastructure

- Runtime injector: lib/ThemeProvider.tsx
- Tailwind mapping/utilities: app/globals.css

Important:

- Do not remove app/globals.css.
- Edit token values in lib/theme/tokens.ts.
- Edit component styling in the matching lib/theme/components/\*.theme.ts file.

## Global Tokens

File: lib/theme/tokens.ts

Export:

- themeConfig

Current token API:

- themeConfig.colors.brand[50..900]
- themeConfig.colors.background
- themeConfig.colors.surface
- themeConfig.colors.surfaceStrong
- themeConfig.colors.surfaceMuted
- themeConfig.colors.surfaceDark
- themeConfig.colors.ink
- themeConfig.colors.inkMuted
- themeConfig.colors.hairline
- themeConfig.colors.hairlineStrong
- themeConfig.colors.success
- themeConfig.colors.warning
- themeConfig.colors.danger
- themeConfig.background.gradients[]

## Component-Level Theme Files

Each reusable component now has a dedicated theme config file.

Scope rule:

- For every reusable component inside components/, keep a matching file in lib/theme/components/.
- Naming convention: <component-name>.theme.ts
- Class map naming: <componentName>ThemeClasses

1. components/auth/ThemedFormControls.tsx

- theme file: lib/theme/components/themed-form-controls.theme.ts
- export used: themedFormControlsThemeClasses

2. components/theme/ThemedPrimitives.tsx

- theme file: lib/theme/components/themed-primitives.theme.ts
- export used: themedPrimitivesThemeClasses

3. components/auth/AuthShell.tsx

- theme file: lib/theme/components/auth-shell.theme.ts
- export used: authShellThemeClasses

4. components/auth/LoginForm.tsx

- theme file: lib/theme/components/login-form.theme.ts
- export used: loginFormThemeClasses

5. components/auth/SignupForm.tsx

- theme file: lib/theme/components/signup-form.theme.ts
- export used: signupFormThemeClasses

6. components/auth/LogoutButton.tsx

- theme file: lib/theme/components/logout-button.theme.ts
- export used: logoutButtonThemeClasses

7. components/dashboard/Sidebar.tsx

- theme file: lib/theme/components/sidebar.theme.ts
- export used: sidebarThemeClasses

Reserved component theme files:

- lib/theme/components/dashboard.theme.ts
- lib/theme/components/landing.theme.ts

These are placeholders for future dashboard/landing-specific reusable components.

## Theme Index Exports

File: lib/theme/index.ts

Exports:

- themeConfig
- themedFormControlsThemeClasses
- themedPrimitivesThemeClasses
- authShellThemeClasses
- loginFormThemeClasses
- signupFormThemeClasses
- logoutButtonThemeClasses
- sidebarThemeClasses
- dashboardThemeClasses
- landingThemeClasses

## How Theme Variables Work

1. ThemeProvider reads themeConfig from lib/theme/tokens.ts.
2. ThemeProvider injects runtime CSS vars in --theme-\* namespace.
3. app/globals.css maps Tailwind --color-* tokens to --theme-* vars.
4. Tailwind classes (bg-brand-700, text-brand-700, etc.) keep working.
5. Custom @utility classes (glass, glass-strong, glass-input) keep working.

In short:

- lib/theme/tokens.ts = token values
- lib/theme/components/*.theme.ts = component style bundles
- lib/ThemeProvider.tsx = runtime variable injection
- app/globals.css = Tailwind token registration + utility definitions

## Development Rules

- For token changes, edit only lib/theme/tokens.ts.
- For component style changes, edit that component's dedicated \*.theme.ts file.
- Do not hardcode long class bundles in feature pages.
- If you create a new reusable component, also create its own theme file.
- Export new theme modules from lib/theme/index.ts.

## Adding A New Reusable Component (Required Pattern)

Example component: NotificationBadge

1. Create component:

- components/common/NotificationBadge.tsx

2. Create matching theme file:

- lib/theme/components/notification-badge.theme.ts

3. Export class map:

- export const notificationBadgeThemeClasses = { ... } as const

4. Import classes in component and apply class names.

5. Export from lib/theme/index.ts.

6. Add docs entry to this file.

## Current Adoption

Reusable component-level theming is applied across:

Auth/Public:

- app/(public)/login/page.tsx
- app/(public)/signup/page.tsx
- app/(public)/forgot-password/page.tsx
- app/(public)/reset-password/page.tsx
- app/verify-email/page.tsx
- app/page.tsx
- components/auth/LoginForm.tsx
- components/auth/SignupForm.tsx
- components/auth/AuthShell.tsx
- components/auth/LogoutButton.tsx
- components/auth/ThemedFormControls.tsx

Dashboard:

- app/(protected)/dashboard/page.tsx
- app/(protected)/dashboard/scraper/page.tsx
- app/(protected)/dashboard/chatbot/page.tsx
- app/(protected)/dashboard/upload-document/page.tsx
- components/dashboard/Sidebar.tsx
- components/theme/ThemedPrimitives.tsx

Reusable component theme files currently present:

- lib/theme/components/themed-form-controls.theme.ts
- lib/theme/components/themed-primitives.theme.ts
- lib/theme/components/auth-shell.theme.ts
- lib/theme/components/login-form.theme.ts
- lib/theme/components/signup-form.theme.ts
- lib/theme/components/logout-button.theme.ts
- lib/theme/components/sidebar.theme.ts
- lib/theme/components/dashboard.theme.ts (reserved)
- lib/theme/components/landing.theme.ts (reserved)

## Quick Troubleshooting

If styles break:

1. Check ThemeProvider is mounted in app/layout.tsx.
2. Check lib/theme/tokens.ts for missing token values.
3. Check component imports the correct \*.theme.ts file.
4. Check app/globals.css still contains @theme mapping and @utility blocks.
5. Check lib/theme/index.ts exports are up to date.
