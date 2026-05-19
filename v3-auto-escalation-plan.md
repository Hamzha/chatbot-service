# Human Escalation — v3 Plan (Auto-Escalation)

## What it is

v3 closes the last manual gap in the escalation flow. Today (v1+v2):

- **v1** captures a ticket when the visitor *explicitly asks* (button or phrase) and emails the owner.
- **v2** lets the owner *manually* take over a ticket in real time.

In both, **the human still has to act first** — either the visitor presses "Talk to human", or the owner has to be watching their inbox to know a takeover is needed.

**v3 removes that requirement.** The system itself detects when a chat is going badly, auto-creates a ticket, and pushes a realtime notification to the owner's dashboard. The owner sees a toast/badge appear, clicks in, and uses the v2 takeover flow to jump into the live conversation. The visitor never has to ask.

This is purely *additive* on top of v1 and v2 — the existing manual triggers, contact form, email, inbox, and takeover stay exactly as they are.

---

## Scope

In scope:

- Server-side detection of low-confidence chats and auto-creation of an escalation ticket with `reason: "low_confidence"`.
- Making the `contact` fields on an escalation optional, so auto-tickets can be created without name/email.
- Realtime notification of new tickets to the owner: SSE stream + sidebar badge + in-dashboard toast.
- Widget-side cue when an auto-escalation has been raised (so the visitor knows a human is being looped in).

Out of scope for v3 (candidates for v4+):

- Additional detection signals beyond `num_contexts === 0 × 2` (repeated-question detection, LLM sentiment judge, intent-based keyword triggers like refund/cancel/legal). The plan leaves a single extension point so adding them later is mechanical.
- Auto-dismiss / TTL for unattended auto-tickets.
- Slack / Teams notification channels.
- Multi-agent round-robin assignment.
- Browser push notifications when the dashboard is closed (we only notify when the owner has a dashboard tab open).

---

## Default design decisions (redirect any you don't like)

| Decision                          | Default                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Detection signal (v3)             | `num_contexts === 0` on two consecutive bot replies within the same `widgetSessionId`                                    |
| Where detection runs              | Server-side in `POST /api/chatbot/widget/chat` (not the widget JS) — owner can't be fooled by a tampered client          |
| Where the streak counter lives    | Mongo on the existing widget message log (cheap query: last 2 bot messages for this session). No new collection.         |
| Contact fields on auto-tickets    | Skipped — `contact.name` and `contact.email` become optional in the schema; auto-tickets store empty strings             |
| Reason                            | Reuse existing `"low_confidence"` enum value — already in `EscalationReason`                                             |
| Duplicate handling                | Reuse the existing per-session duplicate guard (`findOpenEscalationForSession`). If a manual ticket already exists, skip |
| Owner notification channel        | SSE stream pushed to any open dashboard tab + sidebar unread badge + toast on the new ticket. Email is **NOT** sent for auto-tickets in v3 (avoid spam) |
| Widget UX after auto-escalation   | Inline system bubble in the widget: "A human has been notified and will join shortly." No form, no interruption          |
| Allow disabling                   | Per-chatbot setting `autoEscalationEnabled: boolean` on the `ChatSession` doc, default `true`. Owner can flip it off     |
| Rate cap                          | Max **1 auto-escalation per `widgetSessionId`** (the duplicate guard already enforces this). No global per-bot cap in v3 |

---

## Data model changes

### `escalations` collection — `lib/db/escalationRepo.ts`

Make `contact` fields optional:

```ts
// before (current)
contact: {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
},

// after
contact: {
    name: { type: String, required: false, default: "", trim: true, maxlength: 100 },
    email: { type: String, required: false, default: "", lowercase: true, trim: true, maxlength: 254 },
},
```

`CreateEscalationInput.contact` becomes `{ name?: string; email?: string }`. The existing manual-escalation endpoint keeps validating both as required at the *route* level (`validateEscalationRequest.ts`), so no behavior change for v1 manual tickets. Only the new auto-escalation path skips the contact.

No new indexes needed.

### `ChatSession` / chatbot config doc

Add one boolean:

```ts
autoEscalationEnabled: { type: Boolean, default: true }
```

(Where `ChatSession` is the per-chatbot config record returned by `getChatSessionById` — same doc that already holds `selectedRagKeys`, `primaryColor`, etc.)

### `widgetMessages` — no schema change

Streak detection reads existing rows. The last two `role: "bot"` messages for the session, ordered by `createdAt desc`, are enough to compute "is this the second consecutive low-confidence reply?". We persist `num_contexts` alongside each bot message so the check is a Mongo read, not a re-call to upstream.

Add one optional field on the existing schema:

```ts
metadata: {
    numContexts: { type: Number, default: null },
}
```

Backfill is not needed — null means "unknown, assume not low-confidence" for legacy rows.

---

## Detection signal pipeline

Single place: `POST /api/chatbot/widget/chat` in `apps/web/app/api/chatbot/widget/chat/route.ts`. The flow becomes:

1. Existing logic runs: rate limit → validation → takeover check → upstream call → persist user + bot messages.
2. Persist the bot message with `metadata.numContexts = data.num_contexts ?? 0` (new field).
3. **New step**: if `data.num_contexts === 0` AND `autoEscalationEnabled` is true for this chatbot AND no open/in-progress escalation exists for this `widgetSessionId`, call `maybeAutoEscalate(...)`:
   - Look up the **last 2 bot messages** for this `widgetSessionId` (ordered by `createdAt desc`).
   - If both have `metadata.numContexts === 0`, trigger auto-escalation.
4. Auto-escalation = `createEscalation({ reason: "low_confidence", contact: { name: "", email: "" }, ..., transcriptSnapshot: last20 })` — same repo function, just with empty contact.
5. Append a `role: "system"` widget message: `"A human has been notified and will join shortly."` so the visitor sees something in the widget on next poll/SSE event.
6. Add the escalation to the owner's SSE notification stream (see below).
7. Continue returning the normal chat response to the visitor (the system message rides through SSE, not through this response — keeps the response shape backwards-compatible).

If any step fails, log + swallow. The chat response must still be delivered to the visitor.

### Module placement

Put the detection logic in a new module `apps/web/lib/chatbot/autoEscalation.ts`:

```ts
export async function maybeAutoEscalate(args: {
    chatbot: { id: string; userId: string; autoEscalationEnabled: boolean };
    widgetSessionId: string;
    currentBotMessageNumContexts: number;
}): Promise<{ created: false } | { created: true; escalationId: string }>;
```

Keeps the chat route lean and makes the signal swappable for v4 (add a second function `detectFrustration()` and OR the results).

---

## API surface

### New: `GET /api/chatbot/escalations/notifications/stream`

SSE stream for the **owner's dashboard** to receive new-ticket events.

- Auth: requires `escalations:read`.
- Query: optional `since` (ISO timestamp) to replay missed events on reconnect.
- Events:
  - `new`: `{ id, reason, createdAt, widgetSessionId, chatbotId }` — fires when a new escalation lands for this owner (any reason, not just auto, so the same stream works for v1 manual tickets too).
  - `status`: `{ id, status }` — fires when status changes (covers other dashboard tabs / agents).
  - Keep-alive comment every 15s (matches the existing `/api/chatbot/escalations/[id]/stream` pattern from v2).
- Implementation: same polling-over-Mongo pattern as the v2 SSE streams. Poll `escalations` collection every 1.5s for rows where `botOwnerId === ownerId AND createdAt > lastSeen`. Cache the last seen `_id` per connection.

### Modified: `POST /api/chatbot/widget/chat`

- Persist `metadata.numContexts` on the bot widgetMessage row.
- After persisting, invoke `maybeAutoEscalate(...)` (fire-and-forget — don't block the chat response).
- No change to the response body. Visitors still get `{ reply, sources, num_contexts, backend }`.

### Modified: `GET /api/chatbot/widget/stream`

The v2 widget SSE already pushes `agent` and `system` widget messages. The new auto-escalation `system` bubble flows through this same stream — **no API change**. (Confirmed by reading `apps/web/app/(public)/widget/[botId]/page.tsx` widget SSE subscription.)

### Modified: chatbot settings PATCH

Whichever route currently updates the chatbot config (likely `PATCH /api/chatbot/chatbots/[id]` or similar — verify during implementation) accepts a new optional `autoEscalationEnabled: boolean` field.

---

## Dashboard changes

### Sidebar badge

Add a small numeric badge next to the existing **Inbox** nav item showing the count of `open` escalations for the current owner. Source: existing `countOpenEscalationsForOwner(ownerId)` in `escalationRepo.ts` (already implemented for v2).

- Initial value: fetched on page load via a tiny endpoint `GET /api/chatbot/escalations/unread-count` (auth: `escalations:read`).
- Live update: a global SSE client (mounted in the dashboard layout) subscribes to `/api/chatbot/escalations/notifications/stream` and increments/decrements the badge as `new` and `status: resolved` events come in.

### Toast on new ticket

When the dashboard receives a `new` SSE event:

- Show a Sonner toast: **"New escalation — auto-detected"** (or **"… — visitor request"** for manual). Click → navigates to `/dashboard/inbox/{id}`.
- Toast duration: 8s. No sound in v3 (kept simple; can add later).

### Inbox detail page

No structural change. Auto-tickets render the same as manual ones, except:

- The **Contact** block shows "Anonymous visitor" when `contact.name` and `contact.email` are empty.
- The **Reason** chip reads `low_confidence` (already a valid value, just becomes more common).
- "Take over" button works identically — the v2 takeover flow doesn't depend on contact info.

### Per-chatbot settings page

Add one toggle:

> **Auto-escalate low-confidence chats** — When the bot has no relevant context to answer two replies in a row, automatically create an escalation ticket and notify you. [toggle, default ON]

Located on the existing chatbot configuration page (wherever color/primaryColor lives). Maps to `autoEscalationEnabled` on the chatbot config doc.

---

## Widget changes

`apps/web/app/(public)/widget/[botId]/page.tsx` — minimal.

- The existing SSE subscription already renders `system` widget messages as styled chips. The new auto-escalation system message (`"A human has been notified and will join shortly."`) flows in through that same channel and renders for free.
- No new widget API call, no form, no header button change.

`apps/web/public/chatbot-widget.js` — no change.

---

## RBAC

No new permissions. The notification stream is gated on the existing `escalations:read`, which v1 already grants to bot owners.

---

## Rate limiting

| Route                                                            | Limit                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| `GET /api/chatbot/escalations/notifications/stream`              | Per-user max 3 concurrent SSE connections (cheap, idempotent — relies on the existing connection-cap pattern from v2 stream routes) |

Auto-escalation creation itself is implicitly capped at **1 per widget session** by the existing duplicate guard (`findOpenEscalationForSession`). No new bucket needed.

---

## File checklist (concrete)

New:

- `monorepo/apps/web/lib/chatbot/autoEscalation.ts` — detection + creation logic.
- `monorepo/apps/web/app/api/chatbot/escalations/notifications/stream/route.ts` — owner SSE.
- `monorepo/apps/web/app/api/chatbot/escalations/unread-count/route.ts` — initial badge value.
- `monorepo/apps/web/components/dashboard/EscalationNotificationsProvider.tsx` — client component mounted in dashboard layout; owns the SSE subscription, badge count state, toast dispatch.

Modified:

- `monorepo/apps/web/lib/db/escalationRepo.ts` — `contact.name` / `contact.email` become optional; `CreateEscalationInput.contact` becomes partial.
- `monorepo/apps/web/lib/db/widgetMessageRepo.ts` — add `metadata.numContexts` field (optional, default null); accept it in `appendWidgetMessage`.
- `monorepo/apps/web/lib/db/chatSessionRepo.ts` (or wherever the chatbot config schema lives) — add `autoEscalationEnabled: boolean` with default true.
- `monorepo/apps/web/app/api/chatbot/widget/chat/route.ts` — persist `numContexts` on bot message; fire-and-forget `maybeAutoEscalate(...)` after persisting.
- `monorepo/apps/web/app/(protected)/dashboard/layout.tsx` (or whichever dashboard shell exists) — mount `<EscalationNotificationsProvider />`.
- `monorepo/apps/web/components/dashboard/Sidebar.tsx` — render the unread badge next to the Inbox item.
- `monorepo/apps/web/app/(protected)/dashboard/inbox/[ticketId]/TicketClient.tsx` — handle empty `contact.name`/`email` (show "Anonymous visitor").
- Whichever chatbot config page exists — add the **Auto-escalate** toggle.
- `monorepo/README.md` — add v3 section under "Human Escalation".

---

## Build order

1. **Schema migrations** — escalation `contact` becomes optional; widgetMessage gets `metadata.numContexts`; ChatSession gets `autoEscalationEnabled`. All backwards-compatible (defaults / optional). No data migration needed.
2. **Detection module** — `autoEscalation.ts` + unit logic (read last 2 bot messages, decide, create). Standalone, easy to test.
3. **Wire into widget chat route** — persist `numContexts`, fire-and-forget `maybeAutoEscalate`.
4. **Notification SSE** — owner stream + unread-count endpoint.
5. **Dashboard wiring** — `EscalationNotificationsProvider`, sidebar badge, toast.
6. **Per-chatbot toggle** — settings UI + PATCH support.
7. **Empty-contact rendering** — TicketClient handles "Anonymous visitor".
8. **Docs** — update `monorepo/README.md` Human Escalation section with v3 entry; mention `autoEscalationEnabled` toggle.

Each step is independently shippable. Steps 1–3 are usable on their own (auto-tickets land in the inbox, owner sees them next time they open the dashboard) — steps 4–5 just make discovery realtime.

---

## Open questions worth confirming before build

1. **Should auto-escalations also send an email?** Default: **no** — auto-detection is noisier than user-initiated escalation, and an in-dashboard toast is enough when the owner is online. If we send email too, we risk spamming on false positives.
2. **One signal in v3 or include keyword/sentiment now?** Default: just `num_contexts === 0 × 2`. It's zero-risk (no new compute, no LLM cost) and the module is structured so adding keyword/sentiment in v4 is one new file plus an OR in `maybeAutoEscalate`.
3. **Should the visitor see "human notified" right away, or only after the owner actually takes over?** Default: show it right away when the auto-ticket is created. Otherwise the visitor keeps trying the bot and gets frustrated; the bubble manages expectations even if the owner doesn't take over for a few minutes.

If any default is wrong, say which — otherwise I'll proceed with them when we start building.
