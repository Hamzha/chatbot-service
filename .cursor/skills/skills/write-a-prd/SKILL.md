---
name: write-a-prd
description: Write a concise product requirements document for a new feature, flow, or project. Use when the user asks for a PRD, feature spec, product brief, scoping doc, or a structured definition of goals, requirements, success metrics, and rollout. Trigger before implementation when product intent needs to be clarified and documented.
---

# Write a PRD

Turn a rough product idea into a concise document that engineers and product
stakeholders can actually execute against.

## Workflow

1. Gather the source material: the user request, relevant code or docs, related
   issues, and any existing behavior that this feature changes.
2. Ask clarifying questions if the problem, audience, scope, or success metrics
   are unclear.
3. Draft a PRD in markdown.
4. If the user asks to save it, write it to an appropriate docs path or a
   user-specified location.
5. If the user asks to turn it into a tracking issue, use GitHub MCP tools
   rather than browser or `gh` flows.

## PRD Shape

Keep the document concise and concrete. Prefer sections like:

- Title
- Problem
- Goals
- Non-goals
- Users or personas
- User flows or use cases
- Functional requirements
- Acceptance criteria
- Risks and dependencies
- Metrics or definition of success
- Rollout notes
- Open questions

## Standards

- Write in clear product language, not implementation trivia.
- Separate requirements from possible solutions when the implementation is still
  flexible.
- Call out scope boundaries explicitly.
- Prefer measurable acceptance criteria over vague statements.
- If the brief is too vague, produce a draft PRD plus open questions rather than
  pretending certainty.

## Saving and Follow-through

If saving to the repo:

- prefer an existing docs location if one is obvious
- otherwise propose a path before creating a new docs convention

If creating a GitHub issue from the PRD:

- derive the target repository from `git remote get-url origin` if needed
- use GitHub MCP tools for issue creation
- include a concise summary, success criteria, and a link to the saved PRD when
  available

## GitHub Interface Rules

Split responsibilities cleanly:

- use local git for repository discovery and related local context only
- use GitHub MCP for remote GitHub objects such as tracking issues and comments
- use `gh` only for HTTPS git auth setup when needed, not as the primary path
  for creating GitHub issues when MCP tools can do the job

When turning the PRD into a GitHub issue:

- derive `owner/repo` from `git remote get-url origin` when the user did not
  specify the repository
- support both HTTPS and SSH remote formats when extracting `owner/repo`
- if there is no usable repository context, ask for `owner/repo` before
  creating the issue
- create the issue directly when the user asked for it; do not stop at a draft
  unless the user asked for a draft first
