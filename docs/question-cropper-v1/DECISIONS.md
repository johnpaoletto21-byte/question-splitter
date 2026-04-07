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

## DEC-005 — PDF rendering library: pdfjs-dist 3.x (CJS legacy) + canvas 3.x

**Task:** TASK-102
**Decision:** Use `pdfjs-dist@3` (`legacy/build/pdf.js` CJS path) together with the `canvas`
(node-canvas) package for rendering PDF pages to PNG in Node.js.
pdfjs-dist 5.x dropped CommonJS support and the project uses `"module": "CommonJS"`.
Downgrading to the last supported 3.x CJS build avoids the project-wide ESM migration
that would be required by v5.
`canvas` 3.x ships pre-built N-API binaries for macOS and ships cleanly without manual
source compilation on a typical macOS developer machine with Xcode CLI tools.
**Why recorded:** This is not the latest pdfjs-dist version, and `canvas` has native
bindings — both are non-obvious choices that affect future maintenance.

---

## DEC-006 — PDF render scale is 1.5× (72 DPI base)

**Task:** TASK-102
**Decision:** `renderPdfSource` applies a scale factor of 1.5 to the native PDF viewport
(72 DPI base → ~108 effective DPI).  A US Letter page (612×792 pt) renders to 918×1188 px.
This is sufficient quality for downstream AI segmentation and localization while keeping
per-page PNG file sizes small.  The scale constant is defined in a named constant
`RENDER_SCALE` at the top of `renderer.ts` so it can be changed without searching code.
**Why recorded:** Scale choice affects image_width/image_height values consumed by
the crop engine's bbox-to-pixel conversion (TASK-302); the exact scale must be documented.

---

## DEC-004 — PreparedPageImage page_number is 1-based

**Task:** TASK-101
**Decision:** `PreparedPageImage.page_number` uses 1-based page indexing.
**Why recorded:** The Layer B contract says "each region has `page_number`" without specifying
base. 1-based is the natural human-readable convention for PDF pages and matches common
PDF library conventions (e.g. pdf-lib, pdfjs). This must be preserved by TASK-102.
