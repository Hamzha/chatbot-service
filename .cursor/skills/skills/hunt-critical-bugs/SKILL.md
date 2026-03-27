---
name: hunt-critical-bugs
description: Hunt for very obvious P0 or P1 bugs in this repo and fix them. Use when the user asks for a critical bug sweep, wants the most severe production risks found first, or wants Codex to scan for high-confidence auth, security, data-loss, outage, or broken-core-flow defects and implement the smallest safe fix.
---

# Hunt Critical Bugs

Use this only for high-confidence critical bug hunting. Most passes should find
zero P0/P1 bugs; do not inflate severity to justify changes.

## Severity Bar

- `P0`: active secret exposure in tracked code, auth bypass, unsafe destructive
  action without required checks, major data corruption or tenant leakage, or a
  crash/outage on a primary production path.
- `P1`: a clearly broken core flow for many users, incorrect writes on an
  important path, or a production entrypoint that fails build/runtime in normal
  use.

## Workflow

1. Start with the user-indicated area. Otherwise inspect the highest-risk
   boundaries first.
2. Look for strong signals in auth, API routes, server actions, env exposure,
   and data mutations.
3. Validate each suspected issue with direct evidence: code path, failing test,
   typecheck/build failure, or a small reproduction.
4. If no issue clearly meets P0/P1, say so explicitly and stop rather than
   drifting into lower-severity cleanup. Still run the completion validation
   before finishing.
5. Once you find a real issue, fix the smallest viable scope.
6. Add or update a regression test whenever a seam exists.
7. Run the narrowest relevant validation for the issue, then always run the
   broader affected lint, build, and test checks before finishing.

## High-Signal Areas

- `apps/web/app/api/**` and `apps/server/app/api/**`
- `"use server"` modules and mutating server actions
- `packages/models/src/auth/**` and `packages/models/src/db/**`
- `packages/utils/src/server/**`
- `GlobalEnv`, `NEXT_PUBLIC_*`, and other env wiring
- delete/update flows, tenant/company/user scoping, and ID-based writes

## High-Signal Patterns

- mutating route or action missing `ServerAction.doChecks`, role checks, or
  session validation
- server-only helpers or secret values leaking into client code or public env
- success responses after caught failures or swallowed errors
- wrong-id or wrong-scope writes/deletes that can corrupt shared data
- obvious null/undefined/runtime failure in a hot production path
- build/type errors in production entrypoints
- tracked secrets or credentials in repo files
  If found, never echo the secret value in output.

## Standards

- Prefer one validated fix over a long speculative bug list.
- Keep the patch minimal and behavior-preserving outside the bug.
- Always finish with lint, build, and test for the affected workspaces, even if
  the result is "no obvious P0/P1 issue found."
- Lead with findings if acting as a review; include file references and why the
  issue is P0/P1.
- If the issue requires operational work, such as credential rotation or
  incident response, say that clearly.
- Do not batch unrelated hardening changes into the same pass.

## Repo Guidance

Prefer commands such as:

```bash
rg -n "export async function (POST|PUT|PATCH|DELETE)|\"use server\"|ServerAction\\.doChecks|PaveAuthServer|NEXT_PUBLIC_|process\\.env|delete|update" apps packages
npm run test -- --filter=<workspace>
npm run lint -- --filter=<workspace>
npm run build -- --filter=<workspace>
```

When the user asks to hunt and fix:

- continue until you either fix one validated P0/P1 bug end-to-end or conclude
  there is no obvious P0/P1 issue with evidence
- always run lint, build, and test before completing the pass unless the user
  explicitly narrows validation
- report the exact validation you ran and any residual operational follow-up
