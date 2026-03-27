---
name: tdd
description: Implement changes with test-driven development. Use when the user asks for TDD, wants a bug fixed with a regression test, needs new behavior covered by tests, or wants an incremental red-green-refactor workflow. Trigger when Codex should write the failing test first, make the smallest code change to pass it, and then refactor safely.
---

# TDD

Use a disciplined red-green-refactor loop. Keep the feedback cycle tight and
the production changes small.

## Workflow

1. Identify the externally visible behavior to change.
2. Write the smallest failing test that captures that behavior.
3. Run the targeted test to confirm it fails for the expected reason.
4. Make the smallest code change that passes the test.
5. Refactor only after the test is green.
6. Repeat until the requested behavior is complete.

## Standards

- For bug fixes, start with a regression test that reproduces the bug.
- Prefer targeted tests first, then run the broader relevant suite.
- Keep mocks sparse and only where isolation is necessary.
- Do not change production code before expressing the behavior in a test unless
  a test seam truly does not exist. In that case, explain why and create the
  smallest safe seam first.
- Avoid broad refactors in the same step as introducing new behavior.

## Repo-specific Guidance

This repo expects automated tests for behavior changes where appropriate.

- Jest drives unit and integration coverage.
- UI tests use Testing Library.
- Co-locate tests near the code as `*.test.ts` or `*.test.tsx`.
- Favor fixtures from shared packages over heavy mocking when possible.

Prefer commands such as:

```bash
npm run test -- --filter=<workspace>
```

Use narrower test targets when available so the loop stays fast. After the
targeted test passes, run the broader affected suite before finishing.

## Output

When working with this skill:

- mention the failing test you are adding first
- keep each implementation step small
- report the tests you ran and whether they passed
