# UI / UX — Future Ideas

A short list of follow-up ideas for the web app after the glassmorphism redesign.
None of these are required — pick whichever feels worth the effort.

---

## 1. Real stats on the dashboard overview

**What:** The pipeline cards on `/dashboard` currently have static descriptions.
Make them show live counts so the overview actually reflects state.

**Suggested counts:**
- Web Scraper card → "X scrapes this week" (would need a scrape history table — biggest lift)
- Upload Document card → "X documents · Y total chunks" (already available via `/api/chatbot/documents`)
- Chatbot card → "X messages in current conversation" (already available via `/api/chatbot/messages`)

**How:** The page is already a server component. Add `fetch` calls to the two existing endpoints inside `app/(protected)/dashboard/page.tsx` and pass counts into the pipeline cards. Use `cache: "no-store"` so they refresh on every visit.

---

## 2. Dark mode toggle

**What:** A light/dark theme switch in the sidebar footer.

**Why it's easy:** All theme values are already CSS variables in `app/globals.css` under `@theme` and `:root`. We just need a second block:

```css
[data-theme="dark"] {
  --color-surface: rgba(15, 23, 42, 0.55);
  --color-surface-strong: rgba(15, 23, 42, 0.75);
  --color-ink: #e2e8f0;
  /* ...etc */
}
```

Then add a toggle button (in `Sidebar.tsx`) that sets `document.documentElement.dataset.theme` and persists to `localStorage`. The aurora gradient on `body` would also need a darker variant.

**Tradeoff:** The glass utilities use hardcoded `rgba(255,255,255,...)` for inset highlights — those would need to become CSS vars too for a fully clean dark mode.

---

## 3. Multi-line chat composer

**What:** Right now the chatbot input is a single-line `<input>`. Switch to a `<textarea>` so users can paste longer prompts and use **Shift+Enter for newline, Enter to send**.

**Where:** `app/(protected)/dashboard/chatbot/page.tsx` — the composer block.

**Sketch:**
```tsx
<textarea
  rows={1}
  onKeyDown={(e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onAsk(e as unknown as FormEvent);
    }
  }}
  className="... resize-none"
/>
```

Add auto-resize with `field.style.height = "auto"; field.style.height = field.scrollHeight + "px"` on input.

---

## 4. Toast notifications

**What:** Replace the inline status panels (e.g. upload-document's "Job status" card, chatbot's error block in the sidebar) with toast notifications that pop in the bottom-right corner and auto-dismiss.

**Why:** Inline status panels eat layout space even after the user has read them. Toasts feel more modern and don't shift layout.

**How:** Either roll a tiny toast context (~50 lines) or use `sonner` (small, no theming pain — accepts custom className so it'd take the glass style).

---

## 5. Scraper — recent runs history

**What:** On the scraper page, show a small "Recent runs" list under the form (or in the empty state) so users can replay or compare past scrapes.

**Why:** Currently every scrape result is lost the moment you start a new one.

**How:** Persist last N (say 5) scrape results to `localStorage`. Show them as small cards in the empty state. Click to restore the result into the right pane.

---

## 6. Upload — drag-to-list shortcut

**What:** Let users drag a PDF directly onto the **My Documents** list on the right side of `/dashboard/upload-document` and have it upload immediately, skipping the dropzone entirely.

**Why:** Power users who already understand the flow shouldn't have to traverse from right column → left column to add a file.

**How:** Add the same `onDrop` handler to the documents `<section>`. Trigger the upload mutation directly with the dropped file.

---

## 7. Auth pages — reduce side panel duplication

**What:** The `(public)/forgot-password` and `(public)/reset-password` pages currently use `AuthCard` from `@repo/auth`, while login/signup use `AuthShell`. They look slightly inconsistent.

**Suggested fix:** Wrap forgot/reset in `AuthShell` too (with appropriate `sideTitle`/`sidePoints`) so all four auth pages share the same split-panel glass shell.

---

## 8. Mobile polish

**What:** The sidebar is `fixed left-4 top-4 bottom-4 w-60` with the main content using `ml-[17rem]`. On mobile (`< lg`) this still applies, leaving the page squished or overlapped.

**Suggested fix:**
- Hide the sidebar on `< lg` and show a hamburger button in a top mobile bar
- Sidebar slides in from the left as a drawer when toggled
- Remove the `ml-[17rem]` on small screens

**Where:** `components/dashboard/Sidebar.tsx` and `app/(protected)/dashboard/layout.tsx`

---

## 9. Loading skeletons

**What:** Replace the spinning circles (e.g. document list loading, chatbot history loading) with actual skeleton placeholders that match the shape of the content.

**Why:** Skeletons reduce perceived load time and prevent layout shift when real content lands.

**How:** Three or four reusable skeleton primitives in `components/ui/` — `<SkeletonRow />`, `<SkeletonCard />` — with `animate-pulse` and the glass background.

---

## 10. Source highlighting in chat replies

**What:** When the chatbot replies, show inline citation markers (`[1]`, `[2]`) in the text that link to the matching source in the right sidebar.

**Why:** Currently sources are listed but not tied to specific claims in the answer.

**Tradeoff:** Requires backend changes to return source spans alongside the answer, not just a flat list. Bigger lift than the others.

---

## Notes

- Theme tokens live in `apps/web/app/globals.css` (Tailwind v4 `@theme` directive — there is no `tailwind.config.js`)
- Reusable glass utilities: `.glass`, `.glass-strong`, `.glass-muted`, `.glass-dark`, `.glass-input`
- Brand palette: `brand-50` → `brand-900` (cyan family)
