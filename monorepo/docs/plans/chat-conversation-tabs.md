# Plan: ChatGPT-Style Conversation Tabs (Dashboard)

**Status:** Proposed  
**Date:** 2026-06-02  
**Scope:** Dashboard chat UI (`/dashboard/chatbot/[sessionId]`) — multiple conversation threads per chatbot.  
**Out of scope (v1):** Public embed widget visitor history, tab bar between different bots.

## Goal

Let owners test and use a chatbot with **multiple separate conversations** (like ChatGPT “New chat”), while keeping **one chatbot config** (name, documents, color, widget settings).

Today one `ChatSession` is both the bot config **and** the only conversation thread. This plan splits those concerns.

## Why This Is Worth Doing

- Users can start a fresh thread without deleting history (“Clear conversation” is destructive today).
- Matches familiar ChatGPT UX for power users testing prompts.
- RAG docs stay on the **bot**; only message history is per-thread.
- Low risk to widget/escalation if scoped to dashboard first.

## Current State

| Concept today | Mongo / code |
| --- | --- |
| Chatbot (config) | `ChatbotChatSession` in `chatSessionRepo.ts` |
| Messages | `ChatbotMessage.sessionId` → same id as chatbot |
| Query context | `POST /api/chatbot/query` loads prior messages by `sessionId` |
| Clear chat | `DELETE /api/chatbot/messages?sessionId=` wipes all messages for that bot |
| List bots | `/dashboard/chatbot` — one card per `ChatSession` |

**Problem:** `sessionId` overloads “bot” and “conversation.” Adding tabs without a new entity would break semantics and make escalations/RAG harder to reason about.

## Target Model

```text
User
 └── ChatSession (bot)          ← name, selectedRagKeys, primaryColor, autoEscalation…
      └── Conversation (thread) ← title, createdAt, updatedAt (last message)
           └── ChatbotMessage    ← user/assistant rows scoped to conversationId
```

### Naming (internal)

| User-facing | Internal type | Route param |
| --- | --- | --- |
| Chatbot / bot | `ChatSession` | `sessionId` (unchanged) |
| Chat / conversation / tab | `Conversation` | `conversationId` (new) |

Keep **`sessionId`** on existing APIs where it means **bot id**. Add **`conversationId`** wherever messages or query context are involved.

## Data Model

### New collection: `ChatbotConversation`

```typescript
{
  _id: ObjectId,
  userId: ObjectId,           // owner (indexed)
  sessionId: ObjectId,        // parent bot (indexed)
  title: string,              // default "New chat", auto-rename from first user message
  createdAt: Date,
  updatedAt: Date,            // bump on each message append
}
```

**Indexes:**

- `{ userId: 1, sessionId: 1, updatedAt: -1 }` — list threads for a bot
- `{ sessionId: 1, updatedAt: -1 }` — cascade delete when bot deleted

### Change: `ChatbotMessage`

Add required field:

```typescript
conversationId: ObjectId  // ref ChatbotConversation
```

Keep `sessionId` (bot id) **during migration** for backfill, then optional or derived for queries. Preferred long-term query key: `{ userId, conversationId, createdAt }`.

**New index:** `{ userId: 1, conversationId: 1, createdAt: 1 }`

### Auto-title rules

1. On create: `title = "New chat"`.
2. After first user message is saved: set `title` to first ~60 chars of question (trimmed, single line).
3. User can rename via PATCH (optional v1.1).

## API Plan

### New routes

Base path: `/api/chatbot/sessions/[sessionId]/conversations`

| Method | Path | Permission | Behavior |
| --- | --- | --- | --- |
| `GET` | `.../conversations` | `chatbot_messages:read` | List threads for bot, newest `updatedAt` first |
| `POST` | `.../conversations` | `chatbot_messages:create` | Create empty thread; return `{ conversation }` |
| `GET` | `.../conversations/[conversationId]` | `chatbot_messages:read` | Single thread metadata |
| `PATCH` | `.../conversations/[conversationId]` | `chatbot_messages:create`* | Rename title (*or new `chatbot_conversations:update` later) |
| `DELETE` | `.../conversations/[conversationId]` | `chatbot_messages:delete` | Delete thread + its messages |

\* Reuse existing message permissions for v1 to avoid RBAC migration; split permissions in v2 if needed.

### Updated routes

| Route | Change |
| --- | --- |
| `GET /api/chatbot/messages?sessionId=&conversationId=` | Require `conversationId`; load messages for thread only |
| `POST /api/chatbot/messages` | Body adds `conversationId`; append exchange; bump conversation `updatedAt` |
| `DELETE /api/chatbot/messages?conversationId=` | Clear one thread (replace bot-wide clear in UI) |
| `POST /api/chatbot/query` | Body adds `conversationId`; load prior messages from that thread only |
| `DELETE /api/chatbot/sessions/[sessionId]` | Delete all conversations for bot, then messages, then session |

### Backward compatibility (transition)

**Phase A — dual read:**

- If `conversationId` omitted on query/messages, resolve **default conversation** for that `sessionId` (lazy-create on first use).

**Phase B — require `conversationId`:**

- Dashboard UI always sends it; drop fallback after one release.

## UI / UX Plan

### Layout (dashboard chat page)

```text
┌─────────────────────────────────────────────────────────────┐
│ ← All chatbots    [Bot name]                    [Customize] │
├──────────────┬──────────────────────────────────────────────┤
│ Conversations│  ChatHeader (docs chips — unchanged)         │
│              ├──────────────────────────────────────────────┤
│ + New chat   │  ChatMessages                                │
│              │                                              │
│ • Refunds Q  │                                              │
│ • Pricing    ├──────────────────────────────────────────────┤
│ • New chat   │  ChatComposer                                │
└──────────────┴──────────────────────────────────────────────┘
```

**Mobile:** conversations collapse into a drawer or horizontal scroll chip row under the header.

### Interactions

| Action | Behavior |
| --- | --- |
| **New chat** | `POST .../conversations` → switch active tab → empty message list |
| **Select tab** | Update URL `?conversationId=` or `/.../c/[conversationId]` → load messages |
| **Send message** | Query with `conversationId` → persist with same id |
| **Delete tab** | Confirm → `DELETE` conversation → select next most recent |
| **Clear conversation** | Remove from header; replaced by per-tab delete or “New chat” |

### URL strategy (pick one in implementation)

**Option A (recommended):** Query param  
`/dashboard/chatbot/[sessionId]?conversationId=abc`

**Option B:** Nested route  
`/dashboard/chatbot/[sessionId]/[conversationId]`

Option A is less routing churn for v1.

### Copy updates

- List page: keep “Your chatbots” (bots, not threads).
- Chat page subtitle: “Each conversation is separate history; documents are shared for this bot.”

## Migration

### Script: `apps/web/scripts/migrate-conversations.js`

For each existing `ChatbotChatSession`:

1. Create one `ChatbotConversation` titled from session name or first message snippet.
2. Set `conversationId` on all `ChatbotMessage` rows where `sessionId` matches.
3. Log counts; idempotent (skip if conversation already exists for session).

Run once per environment before enabling UI.

### Lazy default (safety net)

On first dashboard load after deploy, if bot has messages but zero conversations, auto-run migration logic for that bot only.

## Widget & Escalation (unchanged in v1)

| Area | v1 decision |
| --- | --- |
| Public widget | Keep single `widgetSessionId` per browser — no tab UI |
| `widgetMessages` | No schema change |
| Escalations | Still keyed to `widgetSessionId`; dashboard threads do not create tickets |
| Auto-escalation | Dashboard query path unchanged upstream; only conversation scoping changes |

**Future (v2):** Optional visitor thread list in widget if customers request it — separate plan.

## RBAC

**v1:** Reuse `chatbot_messages:*` for conversation CRUD (threads are message containers).

**v2 (optional):** Add `chatbot_conversations:read|create|update|delete` to `permissionCatalog.ts` and role seeds if finer control is needed.

## Implementation Phases

### Phase 1 — Data layer (backend only)

- [ ] Add `chatConversationRepo.ts` (CRUD + list by session)
- [ ] Extend `chatbotMessageRepo.ts` with `conversationId`
- [ ] Migration script + integration test on sample data
- [ ] Unit tests for repo functions

**Exit criteria:** Can create/list/delete conversations; messages scoped correctly.

### Phase 2 — API

- [ ] New conversation route handlers under `app/api/chatbot/sessions/[sessionId]/conversations/`
- [ ] Update `query`, `messages` routes for `conversationId`
- [ ] Default-conversation fallback for missing param
- [ ] Update `sessions/[sessionId]` DELETE cascade
- [ ] Extend `rbacRouteHandlers.http.test.ts`

**Exit criteria:** API tests green; Postman/curl can run full thread lifecycle.

### Phase 3 — Dashboard UI

- [ ] `ConversationSidebar` (or tab strip) component
- [ ] Wire `ChatbotSessionClient` to active `conversationId`
- [ ] “New chat” + switch thread without full page reload
- [ ] Remove or repurpose “Clear conversation” header button
- [ ] Deep-link `conversationId` in URL

**Exit criteria:** Owner can run two parallel threads on same bot with isolated history.

### Phase 4 — Polish

- [ ] Auto-title from first message
- [ ] Empty state for new thread
- [ ] Rename conversation (PATCH)
- [ ] Keyboard/a11y (tab list roles)
- [ ] Update `docs/apps/web/architecture.md`

### Phase 5 — Cleanup

- [ ] Require `conversationId` on dashboard API calls
- [ ] Remove default-conversation fallback
- [ ] Optional: drop redundant `sessionId` on messages if fully migrated

## Files Likely Touched

| Area | Files |
| --- | --- |
| Repos | `lib/db/chatConversationRepo.ts` (new), `lib/db/chatbotMessageRepo.ts`, `chatSessionRepo.ts` (delete cascade) |
| API | `app/api/chatbot/sessions/[sessionId]/conversations/**`, `query/route.ts`, `messages/route.ts`, `sessions/[sessionId]/route.ts` |
| UI | `ChatbotSessionClient.tsx`, new `ConversationSidebar.tsx`, `ChatHeader.tsx` |
| Tests | `rbacRouteHandlers.http.test.ts`, new `chatConversationRepo.integration.test.ts` |
| Scripts | `scripts/migrate-conversations.js` |
| Docs | `docs/apps/web/architecture.md`, this file |

## Test Plan

1. **Migration:** Bot with 10 messages → one default conversation; all messages linked.
2. **Isolation:** Thread A and B on same bot — message in A not visible in B; query context respects thread.
3. **New chat:** Empty thread sends first message; title updates.
4. **Delete thread:** Only that thread’s messages removed; bot config intact.
5. **Delete bot:** All conversations + messages removed.
6. **RBAC:** Mediator cannot delete threads if role lacks `chatbot_messages:delete`.
7. **Regression:** Widget chat, escalations, customize page unaffected.

## Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Breaking existing dashboard clients | Default conversation fallback during Phase A–B |
| URL bookmark breakage | Migration creates one conversation per bot; default to latest or migrated id |
| Query context leak across tabs | Always pass `conversationId` into `listChatbotMessages` before `formatConversationContext` |
| Mongo growth | Same volume as today; threads replace “clear + restart” pattern |

## Success Metrics

- Owners create ≥2 conversations on same bot without support docs (qualitative).
- No increase in 404/400 on `/api/chatbot/query` after rollout.
- “Clear conversation” support questions drop (replaced by “New chat”).

## Related Docs

- [`decisions/keep-rag-ingest-in-chatbot-api.md`](../decisions/keep-rag-ingest-in-chatbot-api.md)
- [`apps/web/architecture.md`](../apps/web/architecture.md)
- [`apps/chatbot-api/architecture.md`](../apps/chatbot-api/architecture.md) — RAG/query unchanged; only web-side context scoping changes
