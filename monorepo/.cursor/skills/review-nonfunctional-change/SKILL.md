---
name: review-nonfunctional-change
description: Review the current change against the repo default branch when the change is intended to be mostly non-functional, such as a performance patch, refactor, cleanup, or RAM reduction. Use when Codex should inspect the full diff, distinguish genuine regressions from justified improvements or bug fixes, prove issues with failing tests or equivalent direct evidence before fixing them, rerun validation, and commit the result if the user asked for an end-to-end repair pass.
---

# Review Nonfunctional Change

Use this when the change is supposed to preserve functionality relative to the
repo default branch and only change non-functional properties such as
performance, memory use, readability, or shared logic. Small behavior changes
are allowed if they are definite improvements or real bug fixes.

## Goal

- Treat the resolved base branch as the default behavioral baseline.
- Any behavior change in the diff needs justification.
- Keep behavior changes only when they are definite improvements or real bug
  fixes.
- Do not report speculative issues. Every finding needs proof.

## Workflow

1. Establish the comparison base by resolving the repo default branch and state
   which branch you are using.
2. Inspect the entire diff from the merge base, not just filenames. Build a
   concise map of changed modules, call sites, tests, and risk areas.
3. Review each changed hunk with the assumption that behavior should match the
   base branch unless the new behavior is clearly better. Classify changes as
   preserved behavior, justified improvement or bug fix, or regression.
4. For each suspected issue or claimed improvement, verify it with direct
   evidence from code flow, reproduction, benchmark data, or existing failing
   behavior. Drop anything that cannot be defended.
5. For each real regression or unjustified behavior change, add the smallest
   failing regression test that passes on the base logic and fails on the
   current branch.
6. Run the targeted test to confirm it fails for the expected reason.
7. Fix the bug with the smallest behavior-preserving change. Keep performance
   in mind and prefer simplification or shared helpers over extra layers.
8. Rerun the targeted tests until green.
9. Run the relevant lint, build, and test commands for affected workspaces.
   Resolve any issues in touched areas before finishing.
10. If the user asked for the full repair flow, commit the final changes with a
    scoped conventional commit.

## Review Standard

- Functionality should usually remain the same as the base branch.
- Behavior changes are acceptable when direct evidence shows they fix incorrect
  behavior or are clearly better than the baseline.
- Prefer fewer, high-confidence findings over a long speculative list.
- Treat changed tests carefully. Weakened coverage, deleted assertions, or
  shifted expectations can hide regressions.
- Pay extra attention to stateful code, caching, async behavior, null handling,
  server/client boundaries, and code paths that now skip work.
- If a change improves performance by dropping required work, that is a bug,
  not a valid optimization.
- If a change is clearly better, say so instead of forcing a parity-only
  conclusion.

## Proof Standard

A finding is only real if at least one of these is true:

- a new regression test fails on the current branch for the expected reason
- the branch already fails lint, typecheck, build, or tests because of the
  issue
- there is a direct runtime or code-path contradiction that can be explained
  precisely and reproduced

Do not call out "might be broken" issues without proof.

Use the same proof bar when allowing a behavior change as an improvement or bug
fix: explain why it is definitely better and cite the evidence.

## Fix Standard

- Keep fixes minimal and local to the regression.
- Preserve the change's non-functional goal where possible.
- Keep definite improvements and real bug fixes; do not revert them just to
  match the base branch mechanically.
- Prefer removing incorrect branching or duplication over adding fallback code.
- Reuse shared code from `packages/*` when that reduces duplication.
- Do not smuggle unrelated cleanup into the patch.

## Validation

Resolve the base branch once and reuse it for all diff commands:

```bash
BASE_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)"
BASE_BRANCH="${BASE_BRANCH#origin/}"
test -n "$BASE_BRANCH" || {
  echo "Could not resolve the repo default branch from origin/HEAD. Set BASE_BRANCH explicitly."
  exit 1
}
git merge-base "$BASE_BRANCH" HEAD
git diff --stat "$BASE_BRANCH"...HEAD
git diff --name-only "$BASE_BRANCH"...HEAD
git diff "$BASE_BRANCH"...HEAD
npm run test -- --filter=<workspace> -- <target>
npm run lint -- --filter=<workspace>
npm run build -- --filter=<workspace>
```

If `origin/HEAD` is unavailable locally, set the repo default branch explicitly:

```bash
BASE_BRANCH=<repo-default-branch>
git rev-parse --verify "$BASE_BRANCH"
```

When a commit is requested:

```bash
git add <files>
git commit -m "fix: preserve <behavior> in nonfunctional change"
```

## Output

When using this skill:

- start by stating the base branch and the diff you are reviewing
- if the user asked for review only, lead with validated findings and file
  references
- if the diff contains a justified behavior change, call it out explicitly as
  an allowed improvement or bug fix and explain why it stays
- if the user asked to fix, mention the failing test you added before the
  production change
- report the exact tests, lint, and build commands run
- state clearly whether a commit was created
