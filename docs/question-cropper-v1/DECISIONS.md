# DECISIONS — Question Cropper V1

Initiative: `question_cropper_v1`
ID: `1775585265501_1`

This file records every implementation-shaping decision that materially affected
the implementation or resolved an important ambiguity not covered by the routed docs.

---

## DEC-001 — Validation command names match npm defaults

**Task:** TASK-101
**Decision:** The repo uses standard npm scripts: `npm run typecheck`, `npm run build`, `npm test`.
These match the Layer C playbook defaults exactly.  No substitution needed.
**Why recorded:** Layer C requires deviation from defaults to be documented in DECISIONS.md.
Since these match, this entry confirms they were verified and chosen deliberately.

---

## DEC-002 — Config resolution order: JSON file < env vars

**Task:** TASK-101
**Decision:** `loadConfig` merges values from an optional `.question-cropper.json` file first,
then overlays environment variables (env vars win). This supports both CI/CD (env vars only)
and local dev workflows (JSON file with optional env overrides).
**Why recorded:** The routed docs specify "local config loading" without prescribing the
exact resolution strategy. Env-var-over-file is the safe, common pattern for single-user
local tools and avoids accidental secret commit via config file.

---

## DEC-003 — Input PDF order preserved; no sorting applied

**Task:** TASK-101
**Decision:** `bootstrapRun` preserves `pdfFilePaths` in the exact caller-provided order.
`source_id` embeds the zero-padded index so lexicographic sort of IDs ≡ input order.
No alphabetic/mtime sorting is applied.
**Why recorded:** The task spec says "preserves file order". If callers want a sorted order,
they sort before calling `bootstrapRun`. This keeps bootstrap deterministic from the caller's
perspective.

---

## DEC-004 — PreparedPageImage page_number is 1-based

**Task:** TASK-101
**Decision:** `PreparedPageImage.page_number` uses 1-based page indexing.
**Why recorded:** The Layer B contract says "each region has `page_number`" without specifying
base. 1-based is the natural human-readable convention for PDF pages and matches common
PDF library conventions (e.g. pdf-lib, pdfjs). This must be preserved by TASK-102.
