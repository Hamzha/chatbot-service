---
name: grill-me
description: Pressure-test a request before implementation. Use when a task is ambiguous, risky, architectural, underspecified, or likely to hide edge cases, tradeoffs, rollout concerns, or hidden dependencies. Trigger when Codex should inspect the codebase, ask sharp clarifying questions, challenge assumptions, and, when the task warrants it, turn the resolved decisions into a single Markdown spec for the final implementation job before writing code.
---

# Grill Me

Interrogate the request until the important unknowns are exposed. Use this
skill to improve the quality of the problem definition, not to show off.

## Workflow

1. Restate the request in concrete terms and decide whether the task needs a
   durable Markdown spec. Prefer a spec when the task is ambiguous, multi-step,
   risky, or likely to hand off to a later implementation pass. If the task is
   tightly scoped and low risk, keep it lightweight in chat.
2. If a spec is warranted, choose one Markdown spec path for the task. Prefer
   an existing planning/spec folder; in this repo default to
   `docs/plans/<task-slug>.md` unless the user gives a different path.
3. If a spec is warranted, create or update that file immediately from
   `assets/final-job-spec-template.md`. Keep firm decisions in the workspace;
   do not leave them only in chat.
4. Inspect the relevant code, docs, tests, and configuration before asking
   questions whose answers are discoverable locally.
5. Ask focused clarifying questions about goals, constraints, scope, affected
   users, interfaces, failure modes, data shape, rollout, and validation.
6. Challenge assumptions, surface tradeoffs, and call out missing decisions.
7. If a spec is in use, update the same file after each user answer or
   important local discovery: move confirmed items into `Firm Decisions`, keep
   unresolved items under `Open Questions`, and record constraints, rollout
   notes, and validation in place.
8. Once the critical unknowns are resolved, turn the result into either the
   concise implementation spec the final job should execute from or, for
   lightweight tasks, a brief in-chat plan and decision summary.

## Standards

- Create a decision/spec file only when it materially improves execution,
  clarity, or handoff.
- Keep exactly one active decision/spec file per task when using a spec unless
  the user asks to split it.
- Prefer repo conventions for the file location and name; otherwise choose a
  short kebab-case path another agent can find easily.
- Prefer durable spec files for handoff-worthy decisions; avoid creating them
  for trivial low-risk tasks unless the user asks.
- Record durable conclusions, not conversational transcripts.
- Separate firm decisions from open questions and tentative assumptions.
- Keep the file current before handing off or switching from discovery to
  implementation.
- If no spec file is used, summarize firm decisions, open questions, and the
  next implementation steps explicitly in chat before moving on.
- Ask sharp, concrete questions instead of generic discovery prompts.
- Ask in small batches unless the request is broad enough to justify more.
- Prefer questions that change implementation strategy, data model, testing, or
  rollout.
- Surface contradictions between the request and the current codebase.
- If the task is already tightly scoped and low risk, keep this lightweight.

## Spec Contents

When a spec file is warranted, use
`assets/final-job-spec-template.md` or an equivalent structure that keeps:

- the concrete objective and scope
- the firm decisions already made
- the open questions that still block implementation
- the intended implementation outline
- the validation plan
- the key file or doc references

## Good Question Areas

- What problem are we solving and for whom?
- What is explicitly in scope and out of scope?
- What behavior is required versus merely nice to have?
- What existing flows, contracts, or schemas must remain compatible?
- What should happen on invalid input, partial failure, or missing data?
- What is the acceptable rollout strategy and blast radius?
- How will the result be verified?

## Output

End with one of these:

- the path to the Markdown spec plus a short list of unanswered questions that
  must be resolved before coding
- the path to the Markdown spec plus a recommendation with tradeoffs
- the path to the Markdown spec plus a concrete implementation plan once the
  key unknowns are closed
- for lightweight tasks, the same outputs directly in chat plus a brief summary
  of the firm decisions already made

Do not move into implementation until the riskier unknowns are addressed unless
the user explicitly asks for a fast provisional pass. If implementation starts
anyway, keep the spec file current and treat it as the source of truth when a
spec file exists.
