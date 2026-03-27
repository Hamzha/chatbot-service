---
name: improve-codebase-architecture
description: Analyze and improve the structure of the codebase. Use when the user asks to simplify architecture, reduce coupling, improve module boundaries, remove duplication, extract shared logic, or make the system easier to maintain. Trigger when Codex should inspect the current design, identify real architectural pain points, and propose or implement incremental refactors with clear tradeoffs.
---

# Improve Codebase Architecture

Focus on real structural problems that are visible in the codebase. Prefer
incremental improvements over rewrites.

## Workflow

1. Inspect the relevant parts of the codebase and gather evidence.
2. Identify concrete pain points such as duplication, poor boundaries,
   oversized modules, cross-layer leakage, weak typing, or dependency tangles.
3. Summarize the current state briefly.
4. Propose a small set of realistic improvements with tradeoffs.
5. If the user wants implementation, apply the smallest change that proves the
   improvement and protect it with tests.

## What to Look For

- duplicated logic that should live in `packages/*`
- domain logic mixed into UI or transport layers
- modules that have grown too large to reason about
- unnecessary abstractions that can be removed
- unstable dependency direction or circular coupling
- data shapes that leak across unrelated layers

## Standards

- Base recommendations on evidence from the repo, not generic best practices.
- Prefer simplification and extraction over inventing new abstractions.
- Keep scope tight and avoid turning a cleanup into a rewrite.
- Present tradeoffs honestly, including migration cost and risk.
- If acting as a review, lead with findings and risks before summaries.

## Implementation Rules

When the user asks for changes:

- choose the smallest viable architectural improvement
- preserve behavior unless the user asked to change it
- update tests in the touched area
- stop and ask before taking on large cross-cutting refactors
