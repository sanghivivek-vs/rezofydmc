# ADR 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

The Build guide (§0, §9) mandates a 1-page ADR for any significant architectural
choice (DB engine, queue, auth scheme, API style, etc.). We need a lightweight,
consistent format kept in version control.

## Decision

We record architecture decisions as numbered Markdown files in `/docs/adr/`,
using the format: Context → Decision → Consequences. Each file is immutable once
Accepted; a later decision that supersedes it gets a new ADR that references the
old one (and the old one is marked `Superseded by ADR-XXXX`).

## Consequences

- Decisions are discoverable and reviewable in PRs alongside code.
- The history of _why_ is preserved, not just _what_.
- Numbering is sequential; integration payload schemas live separately in
  `/docs/integration/`.
