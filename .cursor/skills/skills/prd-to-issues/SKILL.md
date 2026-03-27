---
name: prd-to-issues
description: Break a PRD or feature spec into implementation issues. Use when the user asks to turn a product document into GitHub issues, an execution plan, a backlog, or an ordered implementation sequence. Trigger when Codex should decompose scope into thin slices, identify dependencies, and optionally create the issues directly in GitHub.
---

# PRD to Issues

Turn a product document into the smallest useful set of implementation issues.
Optimize for execution, not ceremony.

## Workflow

1. Read the whole PRD or source document before drafting issues.
2. Identify the minimal vertical slices required to ship the work.
3. Group tightly coupled work together and separate work that can move in
   parallel.
4. Capture ordering and dependencies explicitly.
5. If the user asked for actual GitHub issues, create them with GitHub MCP
   tools.

## Standards

- Prefer thin vertical slices over backend/frontend phase buckets.
- Keep the issue count small enough to be manageable.
- Make each issue independently understandable.
- Include acceptance criteria that make completion testable.
- Call out cross-cutting prerequisites only when they are real blockers.
- Ask before creating issues if the PRD is too vague to decompose cleanly.

## Issue Shape

For each issue, include:

- Title
- Why this issue exists
- Scope
- Acceptance criteria
- Dependencies, if any
- Notes on testing or rollout when relevant

## Creation Rules

If the user asks only for a plan, provide the issue list in chat or markdown
first.

If the user asks to create issues:

- derive the target repository from `git remote get-url origin` when needed
- use GitHub MCP issue tools instead of browser flows
- keep titles concise and imperative
- create issues in dependency order

If the user wants an epic or parent issue, create the parent first and then
link or sequence the child issues using the available GitHub tooling.

## GitHub Interface Rules

Split responsibilities cleanly:

- use local git only for repository discovery or related local context such as
  `git remote get-url origin`, branches, and recent commits
- use GitHub MCP for remote GitHub objects such as issues, labels, comments,
  and issue sequencing
- use `gh` only for HTTPS git auth setup when needed, not as the primary path
  for issue creation if MCP tools can do the job

When creating issues on GitHub:

- derive `owner/repo` from `origin` when the user did not specify it
- support both HTTPS and SSH remote formats when extracting `owner/repo`
- if there is no usable `origin` and the user did not specify a repository, ask
  for `owner/repo` before creating anything
- if the user asked for real GitHub issues, create them directly instead of
  stopping at draft text
- if partial issue creation succeeds, tell the user exactly which issues were
  created and what still needs to be done
