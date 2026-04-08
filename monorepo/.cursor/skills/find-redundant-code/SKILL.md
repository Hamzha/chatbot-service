---
name: find-redundant-code
description: Identify cleanup candidates that are probably obsolete, such as duplicate implementations, dead files, orphaned assets or tests, and one-off scripts that no longer serve a live workflow. Use when the user wants a deletion or tidy-up pass, wants evidence for why something looks unnecessary, or needs a ranked list of redundant code and files with clear reasoning.
---

# Find Redundant Code

Use this skill to produce an evidence-backed cleanup report. The goal is to
find things that are probably unnecessary, not to maximize the number of
candidates.

## Goal

- find high-confidence cleanup candidates: dead code, duplicate logic, obsolete
  files, orphaned tests or assets, and one-off scripts that no longer serve a
  live workflow
- explain each candidate with concrete evidence, not vibe-based guesses
- prefer a short list of defensible findings over a long speculative list
- do not delete anything unless the user explicitly asks for cleanup

## Evidence Standard

Only surface a candidate when the evidence is strong. Prefer at least two
independent signals, unless one signal is decisive.

Strong signals:

- no imports, references, or entrypoints from source, configs, docs, CI, or
  package scripts
- a newer or shared implementation has clearly replaced the old one
- git history or file naming shows a one-time purpose such as `backfill`,
  `fixup`, `tmp`, `manual`, incident-specific cleanup, or a date-specific task
- framework or runtime registration points to a different file while the old
  file remains unused
- tests cover the active path and nothing still exercises the older path

Weak signals on their own are not enough:

- old modification date
- awkward naming
- small file size
- partial similarity to another file
- low commit activity

## Workflow

1. Confirm the scope the user cares about. If none is given, start with common
   cleanup hotspots such as `scripts/`, `src/scripts/`, old utilities,
   duplicate helpers, stale components, fixtures, and dead tests.
2. Build an initial candidate list with fast search. Look for duplicate names,
   unused exports, suspicious script names, and files that appear detached from
   the active dependency graph.
3. Verify every candidate across code references, package scripts, CI,
   deployment config, docs, and known runtime entrypoints. Pay attention to
   dynamic loading and framework conventions before declaring something unused.
4. For duplicate logic, identify the canonical implementation and the exact
   overlap. Only call code redundant when one copy is clearly superseded,
   unused, or should obviously live in a shared helper.
5. For one-off scripts, infer the original purpose from the filename, path,
   flags, surrounding comments, and git history. Confirm that nothing still
   calls the script and that its job was not meant to be recurring.
6. Exclude files that are intentionally rare-touch but required, such as
   migrations, framework entrypoints, generated files, compatibility shims the
   user still needs, and fixtures kept for tests or docs.
7. Rank the remaining candidates by confidence and cleanup type: delete,
   consolidate, move, or document.

## Commands

Use `rg` first and only widen the search when needed:

```bash
rg --files <scope>
rg -n "<name-or-symbol>" <scope> package.json turbo.json .github apps packages
git grep -n "<path-or-basename>"
git log --follow -- <path>
```

When checking scripts, also inspect likely invocation points:

```bash
rg -n "scripts|cron|job|worker|queue|command|backfill|fixup|manual" \
  package.json turbo.json .github apps packages docs
```

## What to Look For

- duplicate helpers where one copy should be removed or extracted into shared
  code
- files with zero inbound references and no framework-driven entrypoint role
- old script directories containing date-stamped or incident-specific utilities
- stale tests, fixtures, or assets that no longer match any live code path
- old implementation files kept after a rename or replacement
- TODO or comment markers that explicitly say a script was temporary

## Output

- Number every finding in the final report as `1.`, `2.`, `3.` and keep those
  numbers stable within the response so the user can refer back to a specific
  finding by number.
- Order numbered findings by confidence and cleanup value.
- If there are no findings, say that explicitly instead of padding the report.

For each numbered finding, include:

- candidate: the file or code path, with file references
- recommendation: delete, consolidate, move, or tidy
- why it looks redundant: the concrete evidence
- what appears to replace it, if anything
- confidence: `high`, `medium`, or `low`
- residual risk: what could still depend on it or what remains unverified

If the evidence is weak, say so and either omit the finding or label it as a
low-confidence tidy-up idea rather than a deletion candidate.

If nothing clears the evidence bar, say that explicitly instead of padding the
report.

## If the User Asks for Cleanup

- remove the highest-confidence items first
- keep changes minimal and scoped
- validate the affected workspace with relevant lint, test, and build commands
- report exactly what was deleted or consolidated and what validation passed
