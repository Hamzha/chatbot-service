---
name: review-pr-against-issue
description: Review a GitHub pull request against its linked issue or spec and decide whether it is ready to merge. Use when Codex is given a PR number or URL and needs a full review or merge-readiness pass that checks requirement coverage, correctness, tests, performance, architecture, readability, minimality, and cleanup of stale artifacts such as redundant code, completed plan docs, or one-off scripts. Only surface proven problems; do not speculate or pad the review with hypothetical concerns.
---

# Review PR Against Issue

Use this skill to harden a pull request before merge. Inspect the PR against
its linked issue or spec, then either report validated findings or fix them
when requested.

## Goal

- verify that the PR fully satisfies the linked issue or spec with no silent
  scope gaps
- find real correctness, test, performance, architecture, readability, and
  maintainability problems
- keep the code minimal and easy to reason about
- identify redundant or stale artifacts that should be removed before merge
- leave the PR tidy and merge-ready when the user asks for fixes
- do not report speculative issues; every finding must be a real problem with
  direct evidence

## Inputs

- PR number or URL
- repo owner and name, derived from `origin` when the user does not specify
- linked issue number or spec, resolved from the PR body, branch naming, or
  explicit user input
- local checkout when available; otherwise the remote PR diff and metadata

## Workflow

1. Resolve the repo, PR, base branch, head SHA, and current review status. Use
   GitHub MCP for PR metadata, files, diff, checks, comments, and review
   threads. If the local checkout matches the PR head, inspect the files and
   diff locally as well.
2. Resolve the linked issue or spec. Prefer explicit closing references in the
   PR body. If multiple issues are linked, identify the primary implementation
   issue and note any secondary issues. If no linked issue or spec exists, say
   so immediately, review against the PR description, and treat the missing
   linkage as a scope risk rather than pretending the spec is clear.
3. Read the issue body and relevant comments. Convert them into a short
   checklist of required behavior, non-goals, rollout constraints, and edge
   cases.
4. Inspect the entire diff from merge base, not just filenames. Build a concise
   map of changed modules, touched tests, call sites, data flows, and
   cleanup-adjacent files.
5. Review requirement coverage. For each issue requirement, classify it as
   implemented, partially implemented, contradicted, or unverified. Call out
   unrequested scope expansion when it adds complexity or risk without clear
   value.
6. Review correctness and tests. Trace changed code paths, state transitions,
   async boundaries, data access, error handling, auth, null handling, and
   caching. Treat weakened or missing tests as findings when promised behavior
   is not adequately proven.
7. Review performance. Look for unnecessary queries, repeated work, N+1
   patterns, blocking work on hot paths, oversized payloads, extra
   serialization, redundant renders, unbounded loops, avoidable allocations,
   missed batching, and accidental cache busting. Keep only optimizations that
   preserve required behavior.
8. Review architecture and readability. Prefer cohesive modules, direct control
   flow, shared helpers only when duplication is real, and names a human can
   follow quickly. Flag indirection, fallback code, compatibility branches, or
   duplicated logic that make the change harder to reason about without a
   concrete need.
9. Review minimality and cleanup. Check whether the PR leaves behind redundant
   code, dead branches, completed plan docs, temporary notes, one-off scripts,
   debug code, fixtures, or generated artifacts that no longer serve a live
   workflow. Only flag cleanup when the evidence is strong.
10. Before reporting any problem, confirm it is real. Drop anything that cannot
    be defended with evidence from the issue, code flow, tests, validation
    failures, or cleanup proof.
11. If the user asks for fixes, add or update the smallest high-value
    regression tests first for behavioral issues, then implement the minimal
    fix set, remove validated cleanup items, and rerun validation.
12. Run the relevant validation for affected workspaces. At minimum rerun
    targeted tests and the relevant lint and build commands. Widen scope when
    the risk surface is broad or the user asks for a final merge-readiness
    pass.
13. If the user wants review comments on GitHub, create them only for validated
    findings and anchor them to exact diff hunks when possible.

## Review Standard

- treat the issue or spec as the primary contract
- define "full review" as inspecting all changed code plus the surrounding call
  sites and tests needed to judge correctness, not as inventing speculative
  concerns
- keep the change as small as possible while still complete
- prefer deleting stale code, docs, and scripts over keeping "just in case"
  artifacts
- do not add fallback behavior, defensive no-ops, or extra abstraction unless
  the issue explicitly calls for it
- preserve legitimate improvements even when they differ from the previous
  behavior, but explain why they stay
- distinguish bugs and architectural debt from style preferences; only raise
  comments that materially affect correctness, completeness, performance,
  architecture, clarity, or maintainability

## Evidence Standard

Only report a finding when you can back it with at least one of these:

- a failing or missing test that should exist for the promised behavior
- a direct contradiction between the issue or spec and the implementation
- a code-path proof of incorrect behavior, unnecessary work, or architectural
  debt introduced by the PR
- an existing failing check, benchmark, or runtime signal tied to the change
- strong cleanup evidence such as zero references, a clearly superseded
  implementation, or a temporary file or script with a completed one-time
  purpose

If the proof does not clear this bar, do not mention it as a finding.

Do not pad the review with "might be a problem", "could be an issue", or other
speculative comments.

## Cleanup Standard

Treat these as in-scope cleanup when they are part of the PR or directly
adjacent to it:

- redundant helpers or duplicate logic made obsolete by the new implementation
- completed plan docs or checklists that were only meant to guide this work
- one-off scripts such as backfills, fixups, manual investigation tools, or
  temporary migrations whose purpose is complete and that are no longer
  referenced
- debug logging, dead flags, temporary comments, and throwaway fixtures

Do not delete durable artifacts such as real migrations, reusable operational
scripts, or living design docs unless the evidence shows they are obsolete.

## Validation

For remote PR state, prefer GitHub MCP:

- read PR details, files, diff, checks, comments, and review threads
- read the linked issue and relevant issue comments

For local inspection, prefer `git` and targeted workspace commands:

```bash
git remote get-url origin
git fetch origin <base-branch> <head-branch>
git merge-base origin/<base-branch> HEAD
git diff --stat origin/<base-branch>...HEAD
git diff origin/<base-branch>...HEAD
npm run test -- --filter=<workspace> -- <target>
npm run lint -- --filter=<workspace>
npm run build -- --filter=<workspace>
```

If the PR branch is not checked out locally, use the GitHub diff and only read
local files when the checkout matches the PR head.

## Output

When using this skill:

- start by stating the PR, linked issue or spec, base branch, and review scope
- for review-only requests, lead with validated findings ordered by severity
  and include file references
- never present guesses, suspicions, or broad "things to watch" as findings
- for fix requests, mention the regression tests added or updated before the
  production change when behavior changed
- explicitly separate true blockers from nice-to-have cleanup
- say when the issue linkage was missing or ambiguous
- report the exact validation commands run and whether they passed
- state clearly whether the PR is ready to merge
- if no findings clear the evidence bar, say that explicitly instead of
  manufacturing comments
