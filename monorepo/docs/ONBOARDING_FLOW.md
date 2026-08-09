# Product Onboarding Flow

**Scope:** First-run product setup after signup/login — collect light product info (use case, optional website/PDF, bot name), mark the user complete, and never show the wizard again.

This is **not** payment / Stripe onboarding. Card and billing details stay on Stripe Checkout (see [`TRIAL_MODE_FLOW.md`](./TRIAL_MODE_FLOW.md)).

---

## 1. Big picture

```text
Signup / Google  →  onboardingCompleted = false
Login            →  proxy redirects to /dashboard/onboarding (if not completed)
Wizard           →  use case · optional scrape/PDF · optional first bot
Finish or Skip   →  PATCH /api/auth/onboarding  →  onboardingCompleted = true
Later logins     →  normal /dashboard (wizard never shown again)
```

| Kind | Purpose | Where |
| --- | --- | --- |
| **Product onboarding** (this doc) | Guide first bot + store use case / site | `/dashboard/onboarding` |
| **Payment / billing** | Collect card, unlock paid limits | Stripe Checkout + webhooks |

---

## 2. Flow

```mermaid
flowchart TD
    A[Signup or Google login] --> B[User created · onboardingCompleted = false]
    B --> C[Login · session cookie]
    C --> D{onboardingCompleted?}
    D -->|false| E[/dashboard/onboarding]
    D -->|true| F[/dashboard]
    E --> G[Welcome]
    G --> H[Use case: support / sales / faq / other]
    H --> I[Optional: website URL or PDF]
    I --> J[Optional: bot name + create session]
    J --> K[PATCH /api/auth/onboarding]
    E -->|Skip for now| K
    K --> L[onboardingCompleted = true]
    L --> F
```

---

## 3. What we collect

| Field | Required? | Stored on User | Notes |
| --- | --- | --- | --- |
| `onboardingUseCase` | No (skip OK) | Yes | `support` \| `sales` \| `faq` \| `other` |
| `onboardingWebsiteUrl` | No | Yes | If they entered a URL in the wizard |
| Bot name | Only if they created a bot | Chat session, not User | Needs at least one document id |
| PDF / scrape content | No | ChatbotDocument + vectors | Via existing ingest / scrape APIs |
| Card / tax / company | — | — | **Not** collected here |

Completion flag:

| Field | Type | Meaning |
| --- | --- | --- |
| `onboardingCompleted` | `boolean` | `false` = show wizard; `true` = never show again |

---

## 4. Database & types

**Mongo `User`** (`apps/web/lib/db/userRepo.ts`):

- `onboardingCompleted` — default `false` on create (password + Google)
- `onboardingUseCase` — optional string
- `onboardingWebsiteUrl` — optional string

**Auth types** (`packages/auth/src/types/user.ts`):

- `UserRecord` includes the three fields
- `SafeUser.onboardingCompleted` is exposed to the client / proxy

**Legacy / existing users**

- Seed calls `backfillOnboardingCompletedForExistingUsers()` — sets `true` only when the field **`$exists: false`**
- New signups write `false` explicitly, so later seed runs do **not** overwrite them
- Mapping treats missing field as completed (`!== false`) so old sessions are not trapped before backfill
- Demo upserts force `onboardingCompleted: true`

---

## 5. Gate (when the wizard shows)

`apps/web/proxy.ts` (dashboard matcher):

1. Not logged in → `/login`
2. Logged in + `!onboardingCompleted` + path ≠ `/dashboard/onboarding` → redirect to onboarding
3. Logged in + `onboardingCompleted` + on onboarding page → redirect to `/dashboard`

Page also double-checks: `app/(protected)/dashboard/onboarding/page.tsx`.

---

## 6. API & UI pieces

| Piece | Path |
| --- | --- |
| Complete / skip | `PATCH /api/auth/onboarding` |
| Wizard UI | `components/onboarding/OnboardingWizard.tsx` |
| Page | `app/(protected)/dashboard/onboarding/page.tsx` |
| Repo helper | `completeUserOnboarding()` in `userRepo.ts` |

**Wizard steps**

1. **Welcome** — trial note  
2. **Use case** — support / sales / faq / other  
3. **Content** — website scrape (`POST /api/scraper/scrape`) **or** PDF (`POST /api/chatbot/ingest`) — optional  
4. **Bot** — if a document id exists → `POST /api/chatbot/sessions`; else finish without a bot  
5. **Done** → dashboard (or the new chatbot)

**Skip** always calls the same PATCH and sets `onboardingCompleted: true`.

---

## 7. Relation to trial & billing

```text
Product onboarding  →  get value fast (first knowledge + bot)
Trial limits        →  quota while plan = free          (TRIAL_MODE_FLOW.md)
Stripe Checkout     →  payment details + paid plan      (not this wizard)
```

Hitting a feature limit still returns `FEATURE_LIMIT_REACHED` and can send users to `/#pricing`. That path does not reopen product onboarding.

---

## 8. Quick test checklist

1. Create a **new** account (existing users are already marked complete).  
2. After login → land on `/dashboard/onboarding`.  
3. Complete the wizard (or Skip) → `onboardingCompleted: true` in Mongo.  
4. Log out / log in → go straight to `/dashboard`, not onboarding.  
5. Optional: with scraper + RAG running, paste a URL or upload a PDF and create a bot from the wizard.
