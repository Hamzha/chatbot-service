---
name: implement-github-issue
description: Implement a single GitHub issue in the current repository when the user provides an issue number or issue reference such as "implement issue 123", "work on #456", or "fix GitHub ticket 789". Use when Codex should fetch the target issue and any directly referenced dependency or parent issues, restate scope and non-goals, implement only the target issue with the tdd skill, run repeated review and repair passes until no new issues are found, and finish with lint, test, and build passing.
---

# Implement GitHub Issue

Use this skill to turn a GitHub issue number into a completed code change with
verification. Start from the issue details, implement through `$tdd`, and do
not stop after the first green test pass.

## Workflow

1. Inspect the local repository state before making changes. Confirm the
   current branch, existing user changes, and the `origin` remote.
2. Resolve the target repository and fetch the GitHub issue by number. Prefer
   GitHub MCP tools when they are available. If they are not, derive
   `owner/repo` from `git remote get-url origin` and use `gh issue view`.
3. If the issue body names a direct dependency, parent issue, or closely
   coupled blocking issue, fetch that issue too. Use dependency issues for
   interface context, sequencing, and non-goals; do not broaden scope into
   sibling work.
4. Read the target issue title, body, labels, and any directly relevant
   comments or linked context. Convert them into concrete acceptance criteria,
   explicit non-goals, and blockers before coding.
5. Inspect the affected code, tests, and docs in the repo so local facts drive
   the plan instead of assumptions.
6. Implement the issue by following `$tdd` strictly.
7. After the first implementation pass is green, run a review pass focused on
   missed requirements, regressions, and defects in the touched area.
8. If subagents are available, prefer using a fresh reviewer context for that
   review pass so a second pair of eyes inspects the issue with less context
   contamination.
9. If the review pass finds a problem, fix that problem with `$tdd`, then run
   another review pass.
10. Keep looping review and repair passes until one full reviewer pass and one
    full main-agent pass both find no new issues.
11. Format touched TypeScript and Markdown files before the final reruns if
    formatting changes were needed.
12. Run the final repo checks in this order: `npm run lint`, `npm run test`,
    `npm run build`. Fix every surfaced problem and rerun until all three pass.

## Issue Intake

- Treat the GitHub issue as the source of truth for requested behavior.
- Fail fast if the issue cannot be fetched or the repository cannot be derived.
- When the issue references a direct dependency or parent issue, read that issue
  too and extract the contract or sequencing details that affect the target
  issue.
- Restate the target issue scope in concrete terms before editing code.
- Restate explicit non-goals before editing code.
- Inspect local code and tests before asking clarifying questions whose answers
  are already in the repo.
- If the target issue depends on missing or unmerged work, report the exact
  blocker instead of silently implementing extra scope.
- If the issue is ambiguous after local inspection, ask the user one focused
  question or state the narrow assumption you are making.

Prefer commands such as:

```bash
git status --short --branch
git remote get-url origin
gh issue view <number> --repo <owner/repo> \
  --json number,title,body,labels,assignees,url
```

## Scope Control

- Implement the target issue only.
- Treat dependency and parent issues as context, not expanded scope.
- Do not implement sibling issues or backlog cleanup unless the user asks.
- If the issue body and the current code disagree in a way that changes the
  contract, surface that contradiction before editing.
- If working on top of unmerged dependency work, say so explicitly.

## TDD Execution

- Explicitly invoke `$tdd` for the implementation work.
- Start by naming the failing test you are adding first.
- Keep each change small and scoped to one behavior at a time.
- Run the narrowest relevant test while iterating, then run the broader
  affected suite once the targeted test is green.
- When the review loop finds a missed bug or regression, treat it as a fresh
  `$tdd` cycle and add a regression test first when a test seam exists.

## Review Loop

- Compare the implemented behavior against the issue acceptance criteria.
- Prefer a fresh reviewer subagent when available so the review uses a cleaner
  context than the implementation pass.
- Inspect touched code for obvious missed edge cases, broken types, stale tests,
  and local regressions.
- Re-run the smallest relevant validation after each repair.
- Do not stop after one review pass just because the main issue appears done.
- Exit the loop only when a complete reviewer pass and a complete main-agent
  pass both find no new issues to fix.

## Final Validation

Use the repo-level commands at the end:

```bash
npm run lint
npm run test
npm run build
```

While fixing surfaced failures, use narrower reruns to keep the loop fast:

```bash
npm run lint -- --filter=<workspace>
npm run test -- --filter=<workspace>
npm run build -- --filter=<workspace>
```

Format touched files before the last reruns:

```bash
git diff --name-only --diff-filter=ACMRTUB HEAD -- '*.ts' '*.tsx' '*.md' |
  xargs -r npx prettier --write
```

## Standards

- Keep changes minimal and focused on the issue.
- Do not broaden scope into speculative refactors.
- Respect unrelated local changes already in the worktree.
- Fix root causes rather than patching symptoms.
- Do not silence lint, test, or build failures by weakening checks.
- Do not commit, push, or open a PR unless the user explicitly asks for that
  outcome.
- Do not claim completion until the review loop is clean and final validation
  passes.

## Output

When working with this skill:

- identify the issue number and repository up front
- identify any dependency or parent issues you read for context
- restate the target issue's in-scope and out-of-scope items before coding
- mention the failing test you add first, per `$tdd`
- report each reviewer-subagent pass and what it found, or that it found
  nothing
- report each main-agent review pass and what it found, or that it found
  nothing
- list the targeted reruns used during iteration
- end with the final `lint`, `test`, and `build` results or the exact blocker
