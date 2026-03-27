# Internal Usage Guide

This guide shows how teammates can use this auth toolkit in an existing Next.js App Router project without npm publishing.

## Prerequisites

- Node.js 20+
- npm 10+
- A Next.js App Router project (must contain `app/`)
- Access to this repository

## Option 1: Use Existing Next.js Project

### Windows (PowerShell)

1. Clone this toolkit repo (once):

```powershell
git clone https://github.com/hafabdulsami/auth.git
```

2. Run scaffold into your existing Next project:

```powershell
node C:\Users\Admin\OneDrive\Desktop\auth\scripts\create-next-auth-kit.mjs --target C:\path\to\your-next-app
```

3. Install dependencies in target app:

```powershell
cd C:\path\to\your-next-app
npm install
```

4. Configure env:

- Open `.env.local`
- Fill required values (see Environment section below)

5. Start app:

```powershell
npm run dev
```

### macOS/Linux (bash/zsh)

1. Clone this toolkit repo (once):

```bash
git clone https://github.com/hafabdulsami/auth.git
```

2. Run scaffold into your existing Next project:

```bash
node ~/path/to/auth/scripts/create-next-auth-kit.mjs --target ~/path/to/your-next-app
```

3. Install dependencies and run:

```bash
cd ~/path/to/your-next-app
npm install
npm run dev
```

## Option 2: From This Repo (relative target)

If you are already inside this toolkit repo:

```bash
npm run auth:init -- --target ../your-next-app
```

## Scaffolder Flags

- `--target <path>`: Target Next.js project path
- `--force`: Overwrite existing files in target
- `--with-landing`: Also copy `app/page.tsx`

Example:

```bash
npm run auth:init -- --target ../your-next-app --force --with-landing
```

## Environment Variables

Set these in target project's `.env.local`:

```env
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN_SECONDS=3600
BCRYPT_SALT_ROUNDS=10
MONGODB_URI=mongodb://127.0.0.1:27017/auth_app
MONGODB_DB_NAME=auth_app
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## What Gets Added to Target Project

- API routes: `app/api/auth/*`
- Pages: login, signup, forgot-password, reset-password, verify-email, dashboard
- Components: auth + UI components
- Hooks: `hooks/useAuth.ts`
- Auth/DB/Email libs: `lib/auth/*`, `lib/db/*`, `lib/email/*`
- Types: `types/*`
- Route protection: `proxy.ts`
- Dependency + tsconfig updates

## Smoke Test Checklist

1. `npm run build` succeeds
2. Open `/signup` and create account
3. Redirects to `/login?message=verify-email`
4. Login blocked before verification
5. Verify via email link
6. Login succeeds after verification
7. `/dashboard` requires auth
8. Forgot/reset password flow works

## Common Issues

1. `No app/ directory found in target`

- Ensure target is a Next.js App Router project with root `app/`

2. Missing env errors

- Fill `.env.local` keys above

3. Mongo/Resend connection issues

- Verify `MONGODB_URI`, `RESEND_API_KEY`, `EMAIL_FROM`

## Updating Existing Integration

To re-apply latest template changes into a project:

```bash
npm run auth:init -- --target ../your-next-app --force
```

Then run:

```bash
cd ../your-next-app
npm install
npm run build
```
