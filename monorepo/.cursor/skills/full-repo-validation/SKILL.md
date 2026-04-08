---
name: full-repo-validation
description: Run lint, build, and test across the entire monorepo, fix every repo-wide validation failure, and finish only when the checkout is clean or a concrete external blocker is identified. Use when the user asks for a full verification pass, wants all lint/build/test issues resolved, or needs confidence that the whole repo is green.
---

# Full Repo Validation

Use this when the task is to make the whole repo pass its standard checks, not
just a single feature area.

## Workflow

1. Inspect `git status --short` so you understand existing local changes before
   editing.
2. From the repo root, run the full checks in this order: `npm run lint`,
   `npm run build`, `npm run test`.
3. Treat the first failing command as the active constraint. Read the full
   error, identify the root cause, and make the smallest defensible fix.
4. After each edit, run the narrowest relevant validation first, such as
   `npm run lint -- --filter=<workspace>`,
   `npm run build -- --filter=<workspace>`, or
   `npm run test -- --filter=<workspace>`.
5. Once the local fix is green, rerun the full command that previously failed.
6. Continue until all three full-repo commands pass, or until you hit a real
   external blocker such as missing credentials or unavailable services.
7. Finish by formatting changed TypeScript and Markdown files, then rerun any
   full checks affected by that formatting.

## Standards

- Do not stop after the first fix. Keep going until the repo is fully green or
  a blocker is explicit.
- Do not silence failures by disabling rules, weakening types, skipping tests,
  or adding fallbacks unless the user explicitly requests that tradeoff.
- Prefer fixing the underlying bug over patching symptoms.
- Keep fixes minimal and scoped. Avoid opportunistic refactors.
- Add or update tests when behavior changes or when a regression seam exists.
- Respect unrelated user changes already in the worktree. Never revert them
  just to get green.

## Repo Commands

Use the root-level commands first:

```bash
npm run lint
npm run build
npm run test
```

Use narrower reruns while iterating:

```bash
npm run lint -- --filter=<workspace>
npm run build -- --filter=<workspace>
npm run test -- --filter=<workspace>
```

Format touched files before the final pass:

```bash
git diff --name-only --diff-filter=ACMRTUB HEAD -- '*.ts' '*.tsx' '*.md' |
  xargs -r npx prettier --write
```

## Output

When working with this skill:

- report the failing command and the root cause before describing the fix
- list the targeted reruns used during iteration
- end with the final full-repo validation results or the exact blocker that
  prevented completion
