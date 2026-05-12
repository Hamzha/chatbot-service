# Human Escalation — Plan

## What it is

Human escalation is the path that takes a conversation from the bot to a real person when the bot can't or shouldn't handle it. Three families of trigger, three families of handoff:

**Triggers**

1. **Explicit** — user says "talk to a human", "speak to an agent", clicks a "Talk to human" button.
2. **Implicit / failure** — bot returns "I don't know" / RAG retrieves 0 contexts / repeated low-confidence answers in a row.
3. **Intent-based** (later) — sensitive keywords like refund, cancel, complaint, legal.

**Handoff modes**

1. **Asynchronous ticket** — capture a ticket, notify the bot owner by email, owner replies out-of-band. (v1)
2. **In-dashboard inbox** — owner sees and manages escalations in the dashboard. (v1)
3. **Live takeover** — owner joins the live conversation in real time. (v2, out of scope here)

This plan covers v1.

---

## Scope

In scope:

- Detect escalation in the widget.
- Capture contact info + transcript snapshot into Mongo.
- Email the bot owner via Resend.
- Owner dashboard page to list/manage escalations.
- Rate limiting + RBAC.

Out of scope (v2):

- Live takeover / real-time chat between owner and end user.
- Slack / Teams webhook notifications.
- Sentiment analysis. (We're using keyword + RAG-confidence triggers, not LLM sentiment classification.)
- Round-robin assignment across multiple agents.

---

## Default design decisions (redirect any you don't like)

| Decision               | Default                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Storage                | New Mongo collection `escalations` via `lib/db/escalationRepo.ts`                                                             |
| Per-session vs per-bot | Per-session — escalation links to `chatSessionId` (the end-user's widget session) and `botOwnerId` (= chatbot owner's userId) |
| Trigger v1             | Explicit only — "Talk to human" button in widget header + phrase regex on user messages                                       |
| Trigger v1.5           | After 2 consecutive low-confidence bot responses, widget prompts "Would you like to talk to a human?"                         |
| Contact form fields    | `name` (required), `email` (required), `message` (optional, prefilled with last user message)                                 |
| Notification channel   | Email to bot owner via Resend (already wired in auth-service)                                                                 |
| Notification cadence   | One email per ticket created; no digest                                                                                       |
| Statuses               | `open` → `in_progress` → `resolved` (linear, no reopen v1)                                                                    |
| Owner reply            | Out-of-band (owner emails the end user directly); we don't proxy replies in v1                                                |
| RBAC                   | New permissions: `escalations:read`, `escalations:update`. Auto-granted to the bot owner                                      |
| Rate limit             | Per-IP on widget escalation endpoint: 3 / 15 min                                                                              |
| Transcript snapshot    | Capture last 20 messages of the session at ticket creation, denormalized into the ticket doc                                  |

---

## Data model

### `escalations` collection — `lib/db/escalationRepo.ts`

```ts
{
  _id: ObjectId,
  botOwnerId: ObjectId,        // = userId of the chatbot owner; indexed
  chatSessionId: string,       // widget session id (same one used by chatbotMessageRepo)
  chatbotId: ObjectId,         // which of the owner's chatbots was used (chatSessionRepo record)
  contact: {
    name: string,
    email: string,             // validated, lowercased
  },
  reason: "user_request" | "low_confidence" | "manual",
  message: string,             // user-supplied message at escalation time (optional, may be "")
  transcriptSnapshot: Array<{  // last N=20 messages, denormalized
    role: "user" | "bot",
    content: string,
    createdAt: Date,
  }>,
  status: "open" | "in_progress" | "resolved",
  createdAt: Date,
  updatedAt: Date,
  resolvedAt: Date | null,
  notes: string,               // owner-only internal notes; default ""
}
```

Indexes:

- `{ botOwnerId: 1, status: 1, createdAt: -1 }` — for the inbox list query.
- `{ chatSessionId: 1 }` — to avoid duplicate escalations within the same session (see "Duplicate handling" below).

### Repo functions

- `createEscalation(input)` — inserts the doc.
- `listEscalationsForOwner(ownerId, { status?, limit, cursor })` — paged list.
- `getEscalation(id, ownerId)` — single fetch, scoped to owner.
- `updateEscalationStatus(id, ownerId, status, { notes? })` — status transition + audit timestamps.
- `findOpenEscalationForSession(chatSessionId)` — duplicate-guard (see below).

---

## API surface

### Public (widget) — under `app/api/chatbot/widget/escalation/`

**`POST /api/chatbot/widget/escalation`**

- Body: `{ botId, chatSessionId, contact: { name, email }, message?, reason }`
- Validation via new `lib/chatbot/validateEscalationRequest.ts` (mirrors `validateWidgetRequest.ts`):
  - `botId` resolves to an existing user.
  - `chatSessionId` belongs to that bot (cross-check via `chatSessionRepo` / `chatbotMessageRepo`).
  - `email` is RFC-valid; `name` is 1–100 chars; `message` ≤ 500 chars.
- Rate limit: `requireRateLimitByIp(req, "widget:escalation", { limit: 3, windowSec: 900 })`.
- Duplicate guard: if `findOpenEscalationForSession(chatSessionId)` returns a doc, return `200 { ticketId, duplicate: true }` instead of creating a new one.
- Side effects:
  - Snapshot last 20 messages from `chatbotMessageRepo` into `transcriptSnapshot`.
  - Insert escalation doc.
  - Fire-and-forget email via Resend (don't block the response on email success).
- Returns: `{ ticketId, status: "open" }`.

### Authenticated (dashboard) — under `app/api/chatbot/escalations/`

**`GET /api/chatbot/escalations`** — list (paged) — gate with `escalations:read`.

- Query params: `status?`, `limit` (default 25, max 100), `cursor?`.
- Returns escalations where `botOwnerId === sessionUser.id`.

**`GET /api/chatbot/escalations/[id]`** — single — gate with `escalations:read`. Owner-scoped.

**`PATCH /api/chatbot/escalations/[id]`** — update — gate with `escalations:update`.

- Body: `{ status?, notes? }`.
- Allowed transitions: `open → in_progress`, `in_progress → resolved`, `open → resolved`.
- Sets `resolvedAt` when transitioning to `resolved`.

Rate limiting for authenticated endpoints: leave ungated initially (matches the current pattern for cheap read/update routes).

---

## Email notification

**Template** — `lib/email/escalationEmail.ts` (new):

- Subject: `New chatbot escalation — {contact.name}`
- Body: contact details, the user's `message`, a compact transcript snippet (last 5 messages), and a link to `${NEXT_PUBLIC_APP_URL}/dashboard/inbox/{ticketId}`.
- Sent from `EMAIL_FROM` env (already used by auth-service for verification mails).

**Failure handling**: log + swallow. Ticket creation must not fail because email failed; owner can still see it in the inbox.

---

## Widget changes — `public/chatbot-widget.js`

1. **Header button**: add a small "Talk to human" link/icon next to the existing controls. Color follows the configured `primaryColor`.
2. **Trigger detection** on user messages, client-side:
   - Phrase regex: `/\b(talk|speak|chat)\s+(to\s+)?(a\s+)?(human|agent|person|real\s+person|someone)\b/i`.
   - If matched, suppress the normal chat send and open the escalation form instead.
3. **Low-confidence prompt** (v1.5): after the widget sees 2 consecutive bot replies flagged as low-confidence, inject a system message: _"I'm having trouble with this — would you like to talk to a human?"_ with an inline button. This needs the chat API to return a `confidence` or `num_contexts` field — see "Backend signal for low confidence" below.
4. **Escalation form**: in-panel form (not a modal) with name, email, optional message (prefilled with last user message). Submit calls `POST /api/chatbot/widget/escalation`. On success: in-panel confirmation "Thanks — someone will reach out at {email}." and lock the form so a session can't spam tickets.
5. **postMessage**: not needed for v1 (still direct-script architecture, not iframe). Revisit when iframe migration lands.

### Backend signal for low confidence

For trigger 2 to work, the chat endpoints need to surface a confidence signal in the response. Cheapest path:

- `model-gateway-api` `/chat` response: add `num_contexts` (already computed internally for RAG).
- `chatbot-api` `/v1/query` job result: same.
- The web app proxy (`POST /api/chatbot/widget/chat`) forwards `num_contexts` to the widget.
- Widget treats `num_contexts === 0` as low-confidence. Threshold tunable client-side.

This is small and additive — no contract break.

---

## Dashboard — owner inbox

**Route**: `/dashboard/inbox` (and `/dashboard/inbox/[ticketId]`).

**Permission**: `escalations:read` (page-level via `requirePagePermission`), `escalations:update` for status changes.

**Sidebar**: add an "Inbox" item in `lib/dashboard/dashboardSidebarNav.ts` keyed on `escalations:read`. Optional small unread badge later.

**Page split** (following the existing client/server pattern):

- `app/(protected)/dashboard/inbox/page.tsx` — server, calls `requirePagePermission("escalations:read")`.
- `app/(protected)/dashboard/inbox/InboxClient.tsx` — `"use client"`, fetches list, renders table.
- `app/(protected)/dashboard/inbox/[ticketId]/page.tsx` + `TicketClient.tsx` — single-ticket detail view.

**List UI** (v1):

- Table: created, contact name, contact email, reason, status, action (Open).
- Filter chips: `open`, `in_progress`, `resolved`, `all`.

**Detail UI** (v1):

- Contact block (name, email, mailto link).
- Reason + status (with status dropdown).
- Internal notes textarea (debounced PATCH).
- Transcript snapshot as a chat-style log.

---

## RBAC seeding

Add to `lib/db/rbacSeed.ts`:

- New permissions: `escalations:read`, `escalations:update`.
- Grant both to the default owner role (whichever role the bot owner gets by default in current seed).
- Admin role gets them too.

Update the route→permission table in `context.md` after implementation.

---

## Rate limiting

Add one bucket to the existing `lib/rateLimit/*` infrastructure:

| Route                                 | Limit               |
| ------------------------------------- | ------------------- |
| `POST /api/chatbot/widget/escalation` | 3 / 15 min (per-IP) |

Authenticated escalation endpoints (`GET/PATCH /api/chatbot/escalations/*`) stay ungated for v1, matching the existing pattern for read/update routes.

---

## File checklist (concrete)

New:

- `monorepo/apps/web/lib/db/escalationRepo.ts`
- `monorepo/apps/web/lib/chatbot/validateEscalationRequest.ts`
- `monorepo/apps/web/lib/email/escalationEmail.ts`
- `monorepo/apps/web/app/api/chatbot/widget/escalation/route.ts`
- `monorepo/apps/web/app/api/chatbot/escalations/route.ts`
- `monorepo/apps/web/app/api/chatbot/escalations/[id]/route.ts`
- `monorepo/apps/web/app/(protected)/dashboard/inbox/page.tsx`
- `monorepo/apps/web/app/(protected)/dashboard/inbox/InboxClient.tsx`
- `monorepo/apps/web/app/(protected)/dashboard/inbox/[ticketId]/page.tsx`
- `monorepo/apps/web/app/(protected)/dashboard/inbox/[ticketId]/TicketClient.tsx`

Modified:

- `monorepo/apps/web/public/chatbot-widget.js` — header button, regex trigger, escalation form, low-confidence prompt.
- `monorepo/apps/web/lib/db/rbacSeed.ts` — new permissions.
- `monorepo/apps/web/lib/dashboard/dashboardSidebarNav.ts` — inbox nav item.
- `monorepo/apps/web/app/api/chatbot/widget/chat/route.ts` — forward `num_contexts` from upstream.
- `monorepo/apps/model-gateway-api/app/api/chat.py` (or wherever the chat handler lives) — include `num_contexts` in response.
- `monorepo/apps/chatbot-api/...` query result shape — include `num_contexts`.
- `context.md` — add Human Escalation section + route/permission/rate-limit rows.

---

## Build order

1. **Schema + repo** — `escalationRepo.ts`, indexes, RBAC permissions in seed.
2. **Widget public POST endpoint** — validation, dedupe, transcript snapshot, Resend email.
3. **Widget UI** — header button + escalation form, no trigger detection yet.
4. **Dashboard inbox** — list page, detail page, PATCH endpoint.
5. **Trigger detection** — phrase regex client-side (cheap, no backend change).
6. **Low-confidence trigger** — backend `num_contexts` plumbing + widget prompt.
7. **Polish** — sidebar badge for open tickets count, empty states, loading states.
8. **Docs** — update `context.md`.

Each step is independently shippable behind the dashboard nav (the widget piece stays unlinked until step 3 is done).

---

## Open questions worth confirming before build

1. **Should the bot owner be able to reply through the dashboard, or is "email the user directly" enough for v1?** Default: email only. Adding in-dashboard reply means we also need outbound email composition, threading, and "from" identity — a meaningful jump in scope.
2. **Do we want the escalation button always visible in the widget header, or only after the first bot response?** Default: always visible — simpler and discoverable.
3. **One inbox per bot owner across all their chatbots, or one inbox per chatbot?** Default: one combined inbox per owner with a "chatbot" column/filter. Matches "multiple chatbots per user" data model without UI explosion.

If any of those defaults are wrong, say which — otherwise I'll proceed with them when we start building.
