# Modular Authentication System (Next.js App Router)

## Plug-and-Play Scaffolder

This repository now includes a scaffolder command that can copy the full auth stack
(UI + API routes + service layer + DB + email + proxy) into another Next.js App Router project.

From this repository:

```bash
npm run auth:init -- --target ../your-next-app
```

Options:

- `--force`: overwrite existing files in target app
- `--with-landing`: also copy `app/page.tsx` from this project

After scaffolding, in target app:

```bash
npm install
npm run dev
```

Then set values in `.env.local`.

This project now includes a modular auth scaffold with:

- Signup and login routes
- Secure JWT session cookies (HTTP-only)
- Password hashing with bcrypt
- Route protection using `proxy.ts` (Next.js 16 replacement for middleware)
- Reusable UI components and a `useAuth` hook

## 1. Architecture Overview

- `components/auth/*`: Reusable auth UI blocks (`LoginForm`, `SignupForm`, `AuthCard`, `LogoutButton`)
- `components/ui/*`: Generic form UI components
- `hooks/useAuth.ts`: Client auth hook to call API routes
- `app/api/auth/*`: Route handlers for `signup`, `login`, `logout`, `me`
- `lib/auth/*`: Core auth logic (validation, hashing, JWT, cookie/session helpers)
- `lib/db/client.ts`: Reusable Mongoose connection manager
- `lib/db/userRepo.ts`: User repository backed by MongoDB + Mongoose
- `proxy.ts`: Protected route and auth-page redirect logic

## 2. Current Flows

- Signup:
  - POST `/api/auth/signup`
  - Validate input with Zod
  - Hash password with bcrypt
  - Create user record
  - Issue JWT and set secure cookie

- Login:
  - POST `/api/auth/login`
  - Validate input
  - Verify hashed password
  - Issue JWT and set secure cookie

- Logout:
  - POST `/api/auth/logout`
  - Clear cookie

- Protected routes:
  - `proxy.ts` checks session for `/dashboard`
  - Redirects unauthenticated users to `/login`
  - Redirects authenticated users away from `/login` and `/signup`

## 3. Step-by-Step Setup

1. Install dependencies:

```bash
npm install
```

2. Create your env file from `.env.example` and set values:

```bash
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN_SECONDS=3600
BCRYPT_SALT_ROUNDS=10
MONGODB_URI=mongodb://127.0.0.1:27017/auth_app
```

3. Run the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`

5. Test flow in order:

- Go to `/signup` and create an account
- Go to `/dashboard` to verify protected access
- Click logout and verify redirect behavior
- Try opening `/dashboard` while logged out to confirm protection

## 4. Important Security Notes

- Passwords are hashed using `bcryptjs`
- JWT is signed with `HS256` using `JWT_SECRET`
- Token is stored in an HTTP-only cookie (`auth_token`)
- Cookie uses `sameSite: "lax"` and `secure` in production

## 5. Scalability Next Step

- Add production-grade enhancements: refresh tokens, email verification, password reset, and role-based access control.
