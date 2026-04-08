# Theme System Guide

This document explains the complete theme architecture used in the web app, how reusable UI primitives are structured, and how to safely extend the system.

## Purpose

The goal of this pattern is to keep visual styling centralized and reusable:

- One source of truth for theme tokens.
- One runtime injector for CSS variables.
- Reusable primitives for repeated UI patterns.
- Feature pages focused on behavior, not styling duplication.

## Source Of Truth

Main theme token file:

- lib/theme.ts

Important:

- Edit values in lib/theme.ts only.
- app/globals.css is infrastructure (Tailwind token mapping + fallback), not the primary editing surface.

Main runtime provider:

- lib/ThemeProvider.tsx

Global utility layer:

- app/globals.css

Reusable primitives:

- components/auth/ThemedFormControls.tsx
- components/theme/ThemedPrimitives.tsx

## High-Level Flow

1. Theme tokens are defined in lib/theme.ts.
2. ThemeProvider reads those tokens and injects CSS variables on app load.
3. globals.css consumes these variables through Tailwind utilities and custom utility classes.
4. Reusable primitives encapsulate class combinations.
5. Pages import primitives instead of repeating class strings.

## Theme Tokens

### File: lib/theme.ts

Exports:

- themeConfig
- themeClasses

### themeConfig

Current token structure:

- colors.brand (50-900)
- colors.background
- colors.surface
- colors.surfaceStrong
- colors.surfaceMuted
- colors.surfaceDark
- colors.ink
- colors.inkMuted
- colors.hairline
- colors.hairlineStrong
- colors.success
- colors.warning
- colors.danger
- background.gradients

### themeClasses

Shared auth class presets:

- inputBase
- inputError
- errorText
- submitButton
- infoMessage
- passwordHint

Use themeClasses only for reusable wrappers, not directly in feature pages unless necessary.

## Runtime Injection

### File: lib/ThemeProvider.tsx

Exports:

- ThemeProvider
- useTheme

Behavior:

- Creates React context with themeConfig.
- Injects CSS custom properties into document root using the --theme-\* namespace.
- Sets brand token variables and semantic variables.
- Applies background color and radial gradient from themeConfig to body.

Expected usage:

- Root app layout wraps children with ThemeProvider in app/layout.tsx.

## Global CSS Layer

### File: app/globals.css

Responsibilities:

- Tailwind v4 import and @theme fallback variables.
- Base html/body typography and minimum height.
- Shared glass utilities:
  - glass
  - glass-strong
  - glass-muted
  - glass-dark
  - glass-input

Important rule:

- Keep fallback @theme values aligned with themeConfig to avoid visual mismatch during initial paint.

## Reusable Component APIs

## Auth Primitives

### File: components/auth/ThemedFormControls.tsx

1. AuthTextField

- Wraps Input
- Props: Input props + error?: string
- Adds base input classes and error variant classes

2. AuthPasswordField

- Wraps PasswordInput
- Props: PasswordInput props + error?: string
- Adds base input classes and error variant classes

3. FieldError

- Props: message?: string
- Renders nothing when message is empty

4. AuthInfoMessage

- Props: message?: string | null
- Renders nothing when message is empty

5. AuthPasswordHint

- Props: children: React.ReactNode
- Renders helper text style

6. AuthSubmitButton

- Wraps FormButton
- Props: FormButton props
- Uses themeClasses.submitButton

## Generic Theme Primitives

### File: components/theme/ThemedPrimitives.tsx

1. ThemedCard

- Wraps div
- Props: div props + className
- Base: glass rounded-2xl

2. ThemedStrongCard

- Wraps div
- Props: div props + className
- Base: glass-strong rounded-2xl

3. ThemedInput

- Wraps input
- Props: input props + className
- Shared input classes with focus ring behavior

4. ThemedSelect

- Wraps select
- Props: select props + className
- Shared select classes with focus ring behavior

5. ThemedPrimaryButton

- Wraps button
- Props: button props + className
- Brand filled action style

6. ThemedGhostButton

- Wraps button
- Props: button props + className
- Glass ghost action style

7. ThemedDangerButton

- Wraps button
- Props: button props + className
- Danger bordered action style

8. ThemedPrimaryLink

- Wraps Next Link
- Props: Link props + className
- Brand filled CTA style

9. ThemedGhostLink

- Wraps Next Link
- Props: Link props + className
- Glass ghost link style

## Route Adoption Matrix

The following pages/components are already migrated to the reusable pattern.

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

Protected Dashboard:

- app/(protected)/dashboard/page.tsx
- app/(protected)/dashboard/scraper/page.tsx
- app/(protected)/dashboard/chatbot/page.tsx
- app/(protected)/dashboard/upload-document/page.tsx
- components/dashboard/Sidebar.tsx

## How To Add A New Theme Token

1. Add token to lib/theme.ts under themeConfig.
2. Inject corresponding CSS variable in lib/ThemeProvider.tsx.
3. If token should be available at build-time utility level, keep fallback in app/globals.css @theme aligned.
4. Prefer creating or extending a reusable primitive before using token directly in many feature files.
5. Update this document after introducing new token groups.

## How To Add A New Reusable Primitive

1. Decide location:

- Auth-specific primitive: components/auth/ThemedFormControls.tsx
- Generic primitive: components/theme/ThemedPrimitives.tsx

2. Keep API small and predictable:

- Accept native/base component props.
- Accept optional className override.
- Merge className at the end.

3. Replace duplicated usage in feature pages.

4. Document primitive name, props, and behavior in this file.

## Development Rules

- Do not duplicate long Tailwind class strings across feature pages.
- Do not bypass ThemeProvider for global token wiring.
- Keep visual styles in primitives and token files.
- Keep business logic in feature pages/components.
- Prefer semantic wrappers over ad-hoc utility combinations.

## Troubleshooting

If theme updates do not appear:

1. Confirm ThemeProvider wraps app in app/layout.tsx.
2. Confirm token was added to lib/theme.ts.
3. Confirm variable injection exists in lib/ThemeProvider.tsx.
4. Confirm CSS utility references correct variable names.
5. Confirm fallback variables in app/globals.css are aligned.

If style inconsistency appears:

1. Search for duplicated hardcoded class strings in feature pages.
2. Move repeated patterns into themed primitives.
3. Re-check this document and update adoption matrix.

## Quick Checklist For PR Review

- Token change documented in lib/theme.ts.
- Injection path updated in lib/ThemeProvider.tsx.
- No repeated long class strings introduced.
- Reusable primitive used where applicable.
- theme.md updated when architecture/API changed.
