---
name: create-pr-from-changes
description: Create a pull request from the current local git changes in the active repository. Use when the user asks to create or open a PR from the current checkout, commit and push the current work, submit the current diff, or turn local changes into a GitHub pull request. If the current branch is the default branch such as master or main, create a new feature branch before committing.
---

# Create PR From Changes

Turn the current checkout into a pull request with the smallest safe set of git
operations. Use local git commands to inspect status, branch, commits, and
remotes. Use GitHub MCP tools to create the pull request.

## Workflow

1. Inspect the repository state before changing anything.
2. Create a feature branch when the current branch is the default branch.
3. Commit the intended local changes with a conventional commit message.
4. Push the branch to `origin`, or mirror it with GitHub MCP if git auth is not
   available.
5. Create the pull request with a concise summary and test notes.

## Inspect First

Run local git commands to establish:

- current branch
- whether the working tree has staged or unstaged changes
- whether local commits already exist and are ahead of the remote
- the `origin` remote URL so the GitHub repository can be derived

Prefer commands such as:

```bash
git status --short --branch
git branch --show-current
git remote get-url origin
git rev-parse --abbrev-ref origin/HEAD
git log --oneline --decorate --max-count=10
```

If the working tree contains changes that are not clearly part of the user's
request, stop and ask before committing them. Do not silently include unrelated
changes and do not discard them.

## Branch Rules

If the current branch is the default branch, create a new branch before making a
commit. Treat `master`, `main`, or the branch pointed to by `origin/HEAD` as
default branches.

Prefer a short kebab-case branch name derived from the work, for example:

```text
codex/create-pr-skill
fix/header-menu-tests
```

Use a non-interactive git command:

```bash
git switch -c <branch-name>
```

If the user is already on a non-default branch, reuse it unless they ask for a
different branch.

## Commit Rules

If there are uncommitted changes:

- stage only the files that belong in the PR
- write a conventional commit message such as `feat: ...`, `fix: ...`, or
  `refactor: ...`
- avoid creating multiple commits unless the user asks for that

Use non-interactive commands:

```bash
git add <files>
git commit -m "fix: concise summary"
```

If the working tree is clean but there are local commits not yet pushed, do not
create an extra commit.

## Push Rules

Push the branch to `origin`. If the branch has no upstream yet, set it on the
first push.

Prefer:

```bash
git push -u origin <branch-name>
```

If the branch already tracks a remote branch, a normal push is sufficient.

If `git push` fails because GitHub credentials are unavailable in the current
environment, do not stop at that point. Create or update the remote branch with
GitHub MCP tools and continue to PR creation. Surface clearly that the remote
branch was created via GitHub tooling rather than the local git transport.

## Pull Request Rules

Create the PR with GitHub MCP tools instead of browser flows.

Derive the repository from `git remote get-url origin`. Prefer the repository's
default branch as the PR base unless the user requested a different base.

The PR title should usually match the commit summary or a cleaned-up equivalent.
The PR body should be brief and concrete:

- what changed
- why it changed
- tests run, if any

If the user asked only to create the PR from current changes, perform the full
sequence end to end:

1. branch if needed
2. commit if needed
3. push
4. open the PR

## GitHub Interface Rules

Split responsibilities cleanly:

- use local git for working tree inspection, staging, commits, branch naming,
  commit logs, and remote URL inspection
- use the configured `gh auth git-credential` HTTPS path when local git auth is
  needed
- use GitHub MCP for remote GitHub objects such as branches, pull requests,
  review requests, PR comments, and issue links
- use `gh` for auth and credential setup only; do not rely on it as the primary
  way to create PRs when GitHub MCP tools are available
- do not rely on shell-exported plaintext PATs or interactive credential
  prompts
- do not use browser-based GitHub flows if the GitHub MCP tools can do the job

When deriving the GitHub repository:

- read `origin` with `git remote get-url origin`
- extract `owner/repo` from either HTTPS or SSH remote formats
- use the repository default branch, or the branch pointed to by `origin/HEAD`,
  as the PR base unless the user asked for another base

Preferred GitHub MCP flow:

1. If local `git push` works, use it and then open the PR with
   `create_pull_request`.
2. If local `git push` fails due to missing auth, use `create_branch` to create
   the remote branch from the base branch.
3. Use `push_files` or other repo-write GitHub MCP tools to mirror the intended
   committed files to that remote branch.
4. Open the PR with `create_pull_request`.

When using the GitHub MCP fallback path:

- keep the PR title aligned with the local commit summary
- ensure the PR body still includes what changed, why, and tests run
- tell the user if the remote branch commit SHA differs from the local commit
  SHA, because the branch was recreated remotely
- tell the user if the local branch is not tracking the remote branch yet
- do not claim a successful `git push` if the branch was created through GitHub
  MCP instead

## Safety Rules

- Do not use destructive git commands such as `git reset --hard`.
- Do not amend commits unless the user asked for it.
- Do not push, merge, or open a PR unless the user explicitly asked for that
  outcome.
- Surface conflicts between local and remote state clearly instead of guessing.
