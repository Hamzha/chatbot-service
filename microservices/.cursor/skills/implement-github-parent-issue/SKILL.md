---
name: implement-github-parent-issue
description: Implement a parent or epic GitHub issue in the current repository by executing its ordered child issues sequentially, using a fresh worker context per child, repeating review and repair passes after each child, and finishing with full-repo validation. Use when the user wants one prompt to drive an entire dependency chain end to end without manually restarting context for each issue.
---

# Implement GitHub Parent Issue

Use this skill when the user wants one prompt to drive a whole parent issue or
epic through completion.

This skill is an orchestrator. It does not replace
`$implement-github-issue`; it uses that worker workflow one child issue at a
time.

## Workflow

1. Inspect the local repository state before making changes. Confirm the
   current branch, existing user changes, and the `origin` remote.
2. Resolve the target repository and fetch the parent GitHub issue. Prefer
   GitHub MCP tools when available. If they are not, derive `owner/repo` from
   `git remote get-url origin` and use `gh issue view`.
3. Read the full parent issue and identify the ordered child issue list. Use,
   in order of preference:
   - explicit ordered checklist in the parent body
   - direct dependency references in the parent text
   - GitHub sub-issue relationships when they are unambiguous
4. Fail fast if there is no clear ordered child list. Ask one focused question
   rather than guessing the execution order.
5. Restate the overall plan, sequencing, and non-goals before starting child
   work.
6. Execute the child issues sequentially, never in parallel.
7. For each child issue:
   - use a fresh worker context if subagents are available
   - explicitly use `$implement-github-issue` for that child
   - keep scope limited to that child issue only
8. When the child worker finishes, review the resulting local changes through a
   fresh reviewer context if subagents are available. Do not trust a single
   green pass.
9. If the reviewer context finds a problem, fix it with `$tdd`, rerun the
   relevant checks, and review again.
10. Perform one more main-agent review pass yourself after the reviewer context
    returns clean.
11. Move to the next child issue only when the worker pass, reviewer pass, and
    main-agent review pass are all clean.
12. After the final child issue, run one more end-to-end review pass across the
    combined change, again preferring a fresh reviewer context if available.
13. Format touched TypeScript and Markdown files if needed.
14. Finish with final repo checks in this order:
    - `npm run lint`
    - `npm run test`
    - `npm run build`

Prefer commands such as:

```bash
git status --short --branch
git remote get-url origin
gh issue view <parent-number> --repo <owner/repo> \
  --json number,title,body,labels,assignees,url
```

## Child Issue Execution Rules

- Work strictly in dependency order.
- Do not implement multiple child issues in one worker pass unless the parent
  issue explicitly treats them as one inseparable slice.
- Do not parallelize implementation across phases.
- Do not broaden into sibling issues or backlog cleanup.
- If a child issue is blocked by missing dependency work, stop and report the
  exact blocker.
- If a child issue is already completed in the local branch, verify that claim
  against the acceptance criteria before skipping it.

## Required Review Discipline

This skill is for high-confidence, multi-step execution. The review standard is
stricter than a normal single-issue pass.

After each child issue:

1. Compare the result against the child issue acceptance criteria.
2. Run a fresh-context review if subagents are available. The reviewer should
   inspect the touched diff, tests, and acceptance criteria with no assumption
   that the worker is correct.
3. Inspect the touched code yourself for missed requirements, regressions,
   stale tests, broken types, and edge cases.
4. Run the narrowest relevant validation.
5. Fix anything found.
6. Repeat until a full reviewer pass and a full main-agent pass both find no
   new issues.

After the final child issue:

1. Review the combined diff for cross-phase regressions.
2. Run final repo validation.
3. Only then report completion.

Do not skip the independent post-worker review pass. Prefer a fresh reviewer
subagent whenever the tool is available.

## Progress Tracking

Keep a compact execution ledger in the response stream. For each child issue,
record:

- status: `pending`, `in_progress`, `completed`, or `blocked`
- key assumption if any
- validation performed
- review result

If the task spans many turns, periodically restate the ledger so progress is
recoverable without re-reading the whole history.

## Validation

During iteration, prefer narrow reruns:

```bash
npm run lint -- --filter=<workspace>
npm run test -- --filter=<workspace>
npm run build -- --filter=<workspace>
```

Before finishing, always run:

```bash
npm run lint
npm run test
npm run build
```

Format touched files before the final reruns:

```bash
git diff --name-only --diff-filter=ACMRTUB HEAD -- '*.ts' '*.tsx' '*.md' |
  xargs -r npx prettier --write
```

## Standards

- Keep changes minimal and aligned to the parent issue sequence.
- Respect unrelated local changes already in the worktree.
- Use fresh child contexts to limit context bloat when possible.
- Use a separate fresh reviewer context after each child issue when possible.
- Fix root causes rather than patching symptoms.
- Do not silence lint, test, or build failures by weakening checks.
- Do not commit, push, or open a PR unless the user explicitly asks.
- Do not claim the parent issue is done until the full chain is complete and
  final validation passes.

## Output

When working with this skill:

- identify the parent issue number and repository up front
- list the ordered child issues you will execute
- restate the overall in-scope and out-of-scope items before coding
- report each child issue handoff to `$implement-github-issue`
- report each reviewer-subagent pass and what it found, or that it found
  nothing
- report each main-agent review pass and what it found, or that it found
  nothing
- keep the execution ledger visible
- end with final `lint`, `test`, and `build` results or the exact blocker
