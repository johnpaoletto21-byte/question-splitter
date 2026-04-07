# PROOF LOG — Question Cropper V1

Initiative: `question_cropper_v1`
ID: `1775585265501_1`

---

## TASK-101 — Local Config, Source Model, Run Bootstrap

**Date:** 2026-04-07
**Status: PASS**

---

### 1. Claims Proven

| Claim | Invariant Supported | What was shown |
|-------|--------------------|----|
| PO-1 (partial) | INV-1 | `PreparedPageImage` contract defines `source_id`, `page_number`, `image_path`, `image_width`, `image_height` — the stable fields required before segmentation/localization may start. Validation enforces all fields exist and have legal values. |
| PO-8 (partial) | INV-9 | Zero provider SDK imports in `core/**`. Guard grep returned no matches. Config adapter is the only module that knows about external config keys; core only sees `LocalConfig`. |

*PO-1 is partial for TASK-101 because TASK-102 (PDF renderer) will complete the render path.
PO-8 is partial for TASK-101 because later tasks will add more core modules.*

---

### 2. Required Grep Evidence

#### Guard 1 — config keys in adapters/config

```
$ rg -n "GEMINI|DRIVE|FOLDER_ID|OAUTH|TOKEN|OUTPUT_DIR" adapters/config
```

```
adapters/config/local-config/__tests__/loader.test.ts:8:  GEMINI_API_KEY: 'test-gemini-key',
adapters/config/local-config/__tests__/loader.test.ts:9:  DRIVE_FOLDER_ID: 'test-folder-id',
adapters/config/local-config/__tests__/loader.test.ts:10:  OAUTH_TOKEN_PATH: '/tmp/token.json',
adapters/config/local-config/__tests__/loader.test.ts:11:  OUTPUT_DIR: '/tmp/output',
adapters/config/local-config/types.ts:8:  GEMINI_API_KEY: string;
adapters/config/local-config/types.ts:11:  DRIVE_FOLDER_ID: string;
adapters/config/local-config/types.ts:17:  OAUTH_TOKEN_PATH: string;
adapters/config/local-config/types.ts:23:  OUTPUT_DIR: string;
adapters/config/local-config/loader.ts:7:  'GEMINI_API_KEY',
adapters/config/local-config/loader.ts:8:  'DRIVE_FOLDER_ID',
adapters/config/local-config/loader.ts:9:  'OAUTH_TOKEN_PATH',
adapters/config/local-config/loader.ts:10:  'OUTPUT_DIR',
[... additional test assertion lines ...]
```

**Result:** All four required config keys (GEMINI_API_KEY, DRIVE_FOLDER_ID, OAUTH_TOKEN_PATH, OUTPUT_DIR) appear in `adapters/config/local-config/types.ts` and `loader.ts`. Config is fully isolated from `core/**`.

---

#### Guard 2 — source model fields in core/source-model and core/run-orchestrator

```
$ rg -n "source_id|page_number|image_width|image_height|image_path" core/source-model core/run-orchestrator
```

```
core/source-model/types.ts:17:  source_id: string;
core/source-model/types.ts:41:  source_id: string;
core/source-model/types.ts:44:  page_number: number;
core/source-model/types.ts:47:  image_path: string;
core/source-model/types.ts:50:  image_width: number;
core/source-model/types.ts:53:  image_height: number;
core/source-model/validation.ts:11:  if (!page.source_id || page.source_id.trim() === '') {
core/source-model/validation.ts:17:  if (!Number.isInteger(page.page_number) || page.page_number < 1) {
core/source-model/validation.ts:24:  if (!page.image_path || page.image_path.trim() === '') {
core/source-model/validation.ts:30:  if (!Number.isInteger(page.image_width) || page.image_width <= 0) {
core/source-model/validation.ts:37:  if (!Number.isInteger(page.image_height) || page.image_height <= 0) {
core/run-orchestrator/bootstrap.ts:18: * Derive a stable `source_id` ...
core/run-orchestrator/bootstrap.ts:65:    source_id: deriveSourceId(index, filePath),
core/run-orchestrator/types.ts:40:   * Each entry has a stable `source_id` for downstream traceability.
```

**Result:** All five Boundary A required fields (`source_id`, `page_number`, `image_path`, `image_width`, `image_height`) are defined in `core/source-model/types.ts` and validated in `core/source-model/validation.ts`. `source_id` is assigned in the orchestrator bootstrap and carried in `RunContext.sources`.

---

#### Guard 3 — no provider SDK imports in core

```
$ rg -n "googleapis|@google/genai|vertex|drive" core
```

```
(no output)
```

**Result:** PASS. Zero provider SDK references in `core/**`. INV-9 boundary is intact for TASK-101.

---

### 3. Required Validation Evidence

#### typecheck

```
$ npm run typecheck
> question-cropper-v1@1.0.0 typecheck
> tsc --project tsconfig.json --noEmit

(exit 0 — no errors)
```

#### build

```
$ npm run build
> question-cropper-v1@1.0.0 build
> tsc --project tsconfig.json

(exit 0 — no errors)
```

#### tests (full suite)

```
$ npm test
> question-cropper-v1@1.0.0 test
> jest

PASS core/run-orchestrator/__tests__/bootstrap.test.ts
PASS adapters/config/local-config/__tests__/loader.test.ts
PASS core/source-model/__tests__/validation.test.ts

Test Suites: 3 passed, 3 total
Tests:       41 passed, 41 total
Snapshots:   0 total
Time:        1.781 s
```

#### targeted tests

```
$ npm run test:config
  PASS adapters/config/local-config/__tests__/loader.test.ts (18 tests)

$ npm run test:source-model
  PASS core/source-model/__tests__/validation.test.ts (13 tests)

$ npm run test:bootstrap
  PASS core/run-orchestrator/__tests__/bootstrap.test.ts (10 tests)
```

---

### 4. Change Surface

#### Exact files changed

| File | Purpose |
|------|---------|
| `package.json` | Project scaffold; npm scripts for typecheck/build/test/targeted-tests |
| `tsconfig.json` | TypeScript strict-mode config |
| `jest.config.js` | ts-jest test runner config |
| `adapters/config/local-config/types.ts` | `LocalConfig` interface; `ConfigMissingError` |
| `adapters/config/local-config/loader.ts` | `loadConfig()` — fail-fast config resolution |
| `adapters/config/local-config/index.ts` | Public re-exports |
| `adapters/config/local-config/__tests__/loader.test.ts` | 18 unit tests |
| `core/source-model/types.ts` | `PdfSource`, `PreparedPageImage`, `PreparedPageValidationError` |
| `core/source-model/validation.ts` | `validatePreparedPageImage`, `validatePreparedPageImages` |
| `core/source-model/index.ts` | Public re-exports |
| `core/source-model/__tests__/validation.test.ts` | 13 unit tests |
| `core/run-orchestrator/types.ts` | `RunRequest`, `RunContext`, `RunBootstrapError` |
| `core/run-orchestrator/bootstrap.ts` | `bootstrapRun()` — order-preserving run entry point |
| `core/run-orchestrator/index.ts` | Public re-exports |
| `core/run-orchestrator/__tests__/bootstrap.test.ts` | 10 unit tests |
| `docs/question-cropper-v1/DECISIONS.md` | DEC-001 through DEC-004 |
| `docs/question-cropper-v1/PROOF_LOG.md` | This file |
| `ai-log/question_cropper_v1_1775585265501_1/proof-log.md` | Machine log (pointer) |

#### Key diff references

- `adapters/config/local-config/types.ts:8-23` — four required config keys with types; `ConfigMissingError` with `code = 'CONFIG_MISSING'` and `missingKeys[]`
- `adapters/config/local-config/loader.ts:5-11` — `REQUIRED_KEYS` array (fail-fast source of truth)
- `adapters/config/local-config/loader.ts:72-80` — missing-key collection and `ConfigMissingError` throw before any run work
- `core/source-model/types.ts:40-55` — `PreparedPageImage` interface with all five Boundary A fields (`source_id`, `page_number`, `image_path`, `image_width`, `image_height`)
- `core/source-model/validation.ts:10-42` — field-by-field validation with descriptive errors
- `core/run-orchestrator/bootstrap.ts:17-27` — `deriveSourceId()` builds stable, index-prefixed IDs
- `core/run-orchestrator/bootstrap.ts:45-71` — `bootstrapRun()` validates request, maps `pdfFilePaths` to `PdfSource[]` preserving input order, returns `RunContext`

**Why each diff matters:**
- `loader.ts:72-80` — this is the fail-fast boundary: CONFIG_MISSING fires before any rendering, model call, or upload attempt (supports PO-1 / INV-1 pre-condition and PO-8 / INV-9 isolation)
- `source-model/types.ts:40-55` — canonical shape consumed by every downstream step; must not change without reopening Layer B
- `bootstrap.ts:45-71` — order-preserving map with no sort; the input PDF sequence is the ground truth for page traceability

---

### 5. Result Statement

**PASS — all TASK-101 deliverables are complete.**

- 41/41 tests pass
- `npm run typecheck` exits 0
- `npm run build` exits 0
- Guard grep (no provider SDK in core) returns empty
- All required config keys, source model fields, and bootstrap ordering behavior are implemented and unit-tested

**Approved limitations / follow-ups:**
- PO-1 is partially proven: `PreparedPageImage` contract is established and validated, but the actual PDF-to-image render path is TASK-102 scope.
- PO-8 is partially proven: the boundary is clean for TASK-101 modules; later batches will add more core modules that must maintain this.
- No deviation from Boundary Map.
- No protected module was touched.

---

*Batch 1 closeout statement added below after TASK-103.*

---

## TASK-102 — PDF Rendering to Prepared Page Images + Orchestrator Handoff

**Date:** 2026-04-08
**Status: PASS**

---

### 1. Claims Proven

| Claim | Invariant Supported | What was shown |
|-------|--------------------|----|
| PO-1 (complete for Batch 1) | INV-1 | `renderPdfSource` produces real PNG image files from PDF input, with `source_id`, `page_number` (1-based), `image_path`, `image_width`, `image_height` all populated and validated. `renderAllSources` in the orchestrator accumulates all pages before returning, enforcing the INV-1 gate (no downstream step can begin without a populated `preparedPages` list). |

---

### 2. Required Grep Evidence

#### Grep 1 — pdf/page/image fields in renderer and source-model

```
$ rg -n "pdf|page_number|image_width|image_height|image_path" adapters/source-preparation/pdf-renderer core/source-model
```

Key matches (condensed):
```
adapters/source-preparation/pdf-renderer/renderer.ts:8:   *             image_path, image_width, image_height
adapters/source-preparation/pdf-renderer/renderer.ts:18:const pdfjsLib = require('pdfjs-dist/legacy/build/pdf') ...
adapters/source-preparation/pdf-renderer/renderer.ts:125:      page_number: pageNum,        // 1-based (DEC-004)
adapters/source-preparation/pdf-renderer/renderer.ts:126:      image_path: imagePath,
adapters/source-preparation/pdf-renderer/renderer.ts:127:      image_width: width,
adapters/source-preparation/pdf-renderer/renderer.ts:128:      image_height: height,
core/source-model/types.ts:44:  page_number: number;
core/source-model/types.ts:47:  image_path: string;
core/source-model/types.ts:50:  image_width: number;
core/source-model/types.ts:53:  image_height: number;
```

**Result:** All five Boundary A contract fields are set in the renderer output mapping
(renderer.ts:124-130) and their types are defined in core/source-model/types.ts.

---

#### Grep 2 — render in orchestrator and renderer

```
$ rg -n "render" core/run-orchestrator adapters/source-preparation/pdf-renderer
```

Key matches (condensed):
```
core/run-orchestrator/index.ts:2:export { renderAllSources } from './render-step';
core/run-orchestrator/index.ts:5:export type { PageRenderer } from './render-step';
core/run-orchestrator/render-step.ts:45:export async function renderAllSources(
core/run-orchestrator/render-step.ts:47:  renderer: PageRenderer,
core/run-orchestrator/render-step.ts:52:    const pages = await renderer(source, context.config.OUTPUT_DIR);
adapters/source-preparation/pdf-renderer/renderer.ts:43:export async function renderPdfSource(
adapters/source-preparation/pdf-renderer/renderer.ts:98:      await page.render({ canvasContext: ctx, viewport }).promise;
adapters/source-preparation/pdf-renderer/index.ts:1:export { renderPdfSource } from './renderer';
```

**Result:** `renderPdfSource` (adapter) and `renderAllSources` + `PageRenderer` (orchestrator)
are present and correctly connected via dependency injection.

---

#### Guard — no provider SDK in core

```
$ rg -n "googleapis|@google/genai|vertex|drive" core
(no output)
```

**Result:** PASS. INV-9 boundary clean.

---

### 3. Required Validation Evidence

#### typecheck

```
$ npm run typecheck
> question-cropper-v1@1.0.0 typecheck
> tsc --project tsconfig.json --noEmit

(exit 0 — no errors)
```

#### build

```
$ npm run build
> question-cropper-v1@1.0.0 build
> tsc --project tsconfig.json

(exit 0 — no errors)
```

#### tests — full suite

```
$ npm test
> question-cropper-v1@1.0.0 test
> jest

PASS adapters/config/local-config/__tests__/loader.test.ts
PASS core/run-orchestrator/__tests__/render-step.test.ts
PASS core/source-model/__tests__/validation.test.ts
PASS core/run-orchestrator/__tests__/bootstrap.test.ts
PASS adapters/source-preparation/pdf-renderer/__tests__/renderer.test.ts

Test Suites: 5 passed, 5 total
Tests:       60 passed, 60 total
Snapshots:   0 total
Time:        2.539 s
```

#### targeted — PDF renderer integration test

```
$ npm run test:pdf-renderer
> jest --testPathPattern='adapters/source-preparation/pdf-renderer'

PASS adapters/source-preparation/pdf-renderer/__tests__/renderer.test.ts
  renderPdfSource — integration
    ✓ renders a 1-page PDF into exactly 1 PreparedPageImage (531 ms)
    ✓ renders a 3-page PDF into exactly 3 PreparedPageImages (62 ms)
    ✓ assigns 1-based page_number to each rendered page (63 ms)
    ✓ records positive integer image_width and image_height for each page (43 ms)
    ✓ reflects non-square page dimensions correctly (A4 vs Letter) (43 ms)
    ✓ stamps every page with the source_id of the input PdfSource (42 ms)
    ✓ creates PNG files on disk at the reported image_path (52 ms)
    ✓ embeds source_id and page tag in the image file name (44 ms)
    ✓ sets file_name and pdf_path for traceability (21 ms)
    ✓ throws PdfRenderError when the PDF path does not exist
    ✓ PdfRenderError carries code = PDF_RENDER_FAILED and source_id

Tests: 11 passed, 11 total
```

#### targeted — render-step unit test

```
$ npm run test:render-step
> jest --testPathPattern='core/run-orchestrator/__tests__/render-step'

PASS core/run-orchestrator/__tests__/render-step.test.ts
  renderAllSources
    ✓ calls renderer once per source
    ✓ calls renderer with source and OUTPUT_DIR from config
    ✓ accumulates pages from all sources in call order
    ✓ returns all original context fields plus preparedPages
    ✓ does not mutate the input context object
    ✓ processes sources in their input_order (index) order
    ✓ throws PreparedPageValidationError when renderer returns empty list
    ✓ re-throws renderer errors without additional wrapping

Tests: 8 passed, 8 total
```

---

### 4. Sample PDF Fixtures Used and Rendered Page Counts

Test fixtures are created programmatically by `pdf-lib` in `beforeAll` of the renderer integration test.
No static PDF files are committed.

| Fixture PDF | Page size (pt) | Pages rendered | Rendered dimensions (px @ 1.5×) |
|-------------|---------------|----------------|--------------------------------|
| `one-page.pdf` | 612×792 (US Letter) | 1 | 918×1188 |
| `three-page.pdf` | 612×792 (US Letter) | 3 | 918×1188 each |
| `numbered.pdf` | 612×792 | 3 | 918×1188 each |
| `dims.pdf` | 612×792 | 2 | 918×1188 each |
| `letter.pdf` | 612×792 | 1 | 918×1188 |
| `a4.pdf` | 595×842 (A4) | 1 | 892×1263 |
| `linkage.pdf` | 612×792 | 2 | 918×1188 each |
| `files.pdf` | 612×792 | 2 | 918×1188 each |
| `naming.pdf` | 612×792 | 2 | 918×1188 each |
| `trace.pdf` | 612×792 | 1 | 918×1188 |

All PNG files confirmed to exist on disk during test runs.
Render proof via direct Node.js invocation: US Letter → `918 x 1188`, PNG exists: `true`.

---

### 5. Change Surface

#### Exact files changed

| File | Change type | Purpose |
|------|-------------|---------|
| `adapters/source-preparation/pdf-renderer/types.ts` | NEW | `RenderRequest` type; `PdfRenderError` with `code = 'PDF_RENDER_FAILED'` |
| `adapters/source-preparation/pdf-renderer/renderer.ts` | NEW | `renderPdfSource()` — pdfjs-dist + canvas rendering, PNG output, PreparedPageImage production |
| `adapters/source-preparation/pdf-renderer/index.ts` | NEW | Public re-exports |
| `adapters/source-preparation/pdf-renderer/__tests__/renderer.test.ts` | NEW | 11 integration tests using pdf-lib fixtures |
| `core/run-orchestrator/types.ts` | MODIFIED | Added `preparedPages?: PreparedPageImage[]` to `RunContext`; added `PreparedPageImage` import |
| `core/run-orchestrator/render-step.ts` | NEW | `PageRenderer` type; `renderAllSources()` — orchestrator handoff step with DI and validation gate |
| `core/run-orchestrator/index.ts` | MODIFIED | Added `renderAllSources` and `PageRenderer` exports |
| `core/run-orchestrator/__tests__/render-step.test.ts` | NEW | 8 unit tests for render-step orchestration logic |
| `package.json` | MODIFIED | Added `canvas` + `pdfjs-dist` runtime deps; `pdf-lib` devDep; `test:pdf-renderer` + `test:render-step` scripts |
| `docs/question-cropper-v1/DECISIONS.md` | MODIFIED | Added DEC-005 (library choice) and DEC-006 (render scale) |
| `docs/question-cropper-v1/PROOF_LOG.md` | MODIFIED | This section |

#### Key diff references

- `adapters/source-preparation/pdf-renderer/renderer.ts:43-134` — the full `renderPdfSource` function: reads PDF, iterates pages 1-based, renders each to canvas, writes PNG, assembles PreparedPageImage with all five Boundary A fields. **Why it matters:** this is the Boundary A implementation; all five required fields must appear here for PO-1.
- `adapters/source-preparation/pdf-renderer/renderer.ts:125-130` — PreparedPageImage construction with `page_number: pageNum` (1-based, DEC-004), `image_path`, `image_width`, `image_height`. **Why it matters:** these are the exact output fields downstream steps depend on.
- `core/run-orchestrator/types.ts:50-57` — `preparedPages?: PreparedPageImage[]` added to `RunContext`. **Why it matters:** this is the orchestrator's handoff field; downstream code reads `context.preparedPages` instead of raw PDFs.
- `core/run-orchestrator/render-step.ts:23-30` — `PageRenderer` type: `(source, outputDir) => Promise<PreparedPageImage[]>`. **Why it matters:** dependency injection interface that keeps core/ free of provider SDK imports (INV-9).
- `core/run-orchestrator/render-step.ts:45-57` — `renderAllSources`: iterates sources, calls renderer, accumulates pages, calls `validatePreparedPageImages`. **Why it matters:** validation gate enforces INV-1 — all pages pass core validation before being attached to context; return is typed as `RunContext & { preparedPages: PreparedPageImage[] }` making the populated state explicit.

---

### 6. Result Statement

**PASS — all TASK-102 deliverables are complete.**

- 60/60 tests pass (19 new tests added: 11 integration + 8 unit)
- `npm run typecheck` exits 0
- `npm run build` exits 0
- Guard grep (no provider SDK in core) returns empty
- Real PDF rendering confirmed: US Letter 612×792 pt → 918×1188 px PNG
- `renderAllSources` orchestrator handoff wires `PreparedPageImage[]` into `RunContext.preparedPages` via dependency injection
- No mutation of input context (confirmed by test)

**Decisions recorded:** DEC-005 (library: pdfjs-dist 3.x + canvas 3.x), DEC-006 (render scale 1.5×).

**No deviations from Boundary Map.** No protected module touched.
Provider SDK (`pdfjs-dist`, `canvas`) confined to `adapters/source-preparation/pdf-renderer/renderer.ts`.
`core/run-orchestrator/render-step.ts` uses only `PageRenderer` type injection — zero adapter imports in core.

---

## TASK-103 — Crop Target Profile Scaffold + Orchestrator Wiring

**Date:** 2026-04-08
**Status: PASS**

---

### 1. Claims Proven

| Claim | Invariant Supported | What was shown |
|-------|--------------------|----|
| PO-3 | INV-3 | `V1_ACTIVE_PROFILE.max_regions_per_target = 2` is the single centralized source; `validateCropTargetProfile` rejects values > 2. No other module hardcodes this limit. |
| PO-3 | INV-6 | `V1_ACTIVE_PROFILE.composition_mode = 'top_to_bottom'` is the single centralized source; `validateCropTargetProfile` rejects all other modes. |

---

### 2. Required Grep Evidence

#### Grep 1 — policy constants in core

```
$ rg -n "target_type|max_regions_per_target|composition_mode|top_to_bottom" core
```

Key matches (all point to crop-target-profile, not scattered elsewhere):
```
core/crop-target-profile/profile.ts:17:  target_type: 'question',
core/crop-target-profile/profile.ts:18:  max_regions_per_target: 2,
core/crop-target-profile/profile.ts:19:  composition_mode: 'top_to_bottom',
core/crop-target-profile/profile.ts:26:const ALLOWED_COMPOSITION_MODES = new Set<string>(['top_to_bottom']);
core/crop-target-profile/types.ts:18:export type CompositionMode = 'top_to_bottom';
core/crop-target-profile/types.ts:30:  target_type: TargetType;
core/crop-target-profile/types.ts:36:  max_regions_per_target: number;
core/crop-target-profile/types.ts:39:  composition_mode: CompositionMode;
core/run-orchestrator/types.ts:50:   Centralizes target_type, max_regions_per_target, and composition_mode
core/run-orchestrator/__tests__/bootstrap.test.ts:58:    expect(ctx.activeProfile.target_type).toBe('question');
core/run-orchestrator/__tests__/bootstrap.test.ts:63:    expect(ctx.activeProfile.max_regions_per_target).toBe(2);
core/run-orchestrator/__tests__/bootstrap.test.ts:68:    expect(ctx.activeProfile.composition_mode).toBe('top_to_bottom');
```

**Result:** All three policy constants are defined exclusively in `core/crop-target-profile/profile.ts`. Consumed by the orchestrator via `RunContext.activeProfile`; not hardcoded elsewhere.

---

#### Grep 2 — "question" in crop-target-profile and run-orchestrator

```
$ rg -n "question" core/crop-target-profile core/run-orchestrator
```

Key matches:
```
core/crop-target-profile/profile.ts:17:  target_type: 'question',
core/crop-target-profile/profile.ts:23:const ALLOWED_TARGET_TYPES = new Set<string>(['question']);
core/crop-target-profile/types.ts:12:export type TargetType = 'question';
core/run-orchestrator/__tests__/bootstrap.test.ts:56: activeProfile has target_type = "question"
core/run-orchestrator/__tests__/bootstrap.test.ts:58:    expect(ctx.activeProfile.target_type).toBe('question');
```

**Result:** `'question'` appears only in the profile module and in tests that prove the profile is attached to `RunContext`. No scattered hardcoding.

---

#### Guard — no provider SDK in core

```
$ rg -n "googleapis|@google/genai|vertex|drive" core
(no output)
```

**Result:** PASS. INV-9 boundary clean.

---

### 3. Required Validation Evidence

#### typecheck

```
$ npm run typecheck
> tsc --project tsconfig.json --noEmit
(exit 0 — no errors)
```

#### build

```
$ npm run build
> tsc --project tsconfig.json
(exit 0 — no errors)
```

#### tests — full suite

```
$ npm test
> jest

PASS core/source-model/__tests__/validation.test.ts
PASS core/crop-target-profile/__tests__/profile.test.ts
PASS core/run-orchestrator/__tests__/bootstrap.test.ts
PASS adapters/config/local-config/__tests__/loader.test.ts
PASS core/run-orchestrator/__tests__/render-step.test.ts
PASS adapters/source-preparation/pdf-renderer/__tests__/renderer.test.ts

Test Suites: 6 passed, 6 total
Tests:       78 passed, 78 total   (+18 net new tests vs. TASK-102 baseline of 60)
Snapshots:   0 total
Time:        2.436 s
```

#### targeted — profile defaults test

```
$ npm run test:profile
> jest --testPathPattern='core/crop-target-profile'

PASS core/crop-target-profile/__tests__/profile.test.ts
  V1_ACTIVE_PROFILE — centralized V1 policy constants
    ✓ target_type is "question"
    ✓ max_regions_per_target is 2
    ✓ composition_mode is "top_to_bottom"
    ✓ profile object is stable (same reference each import)
  validateCropTargetProfile — valid profiles
    ✓ accepts the V1 active profile without throwing
    ✓ accepts max_regions_per_target = 1 (single-region question)
  validateCropTargetProfile — target_type violations
    ✓ throws ProfileValidationError for an unknown target_type
    ✓ error code is PROFILE_INVALID for unknown target_type
  validateCropTargetProfile — max_regions_per_target violations (INV-3)
    ✓ throws ProfileValidationError for max_regions_per_target = 3 (exceeds V1 limit)
    ✓ throws ProfileValidationError for max_regions_per_target = 0
    ✓ throws ProfileValidationError for non-integer max_regions_per_target
    ✓ error message mentions INV-3 limit
  validateCropTargetProfile — composition_mode violations (INV-6)
    ✓ throws ProfileValidationError for an unknown composition_mode
    ✓ error code is PROFILE_INVALID for unknown composition_mode

Tests: 14 passed, 14 total
```

---

### 4. Change Surface

#### Exact files changed

| File | Change type | Purpose |
|------|-------------|---------|
| `core/crop-target-profile/types.ts` | NEW | `CropTargetProfile` interface; `TargetType`, `CompositionMode` types; `ProfileValidationError` |
| `core/crop-target-profile/profile.ts` | NEW | `V1_ACTIVE_PROFILE` constant; `validateCropTargetProfile()` |
| `core/crop-target-profile/index.ts` | NEW | Public re-exports |
| `core/crop-target-profile/__tests__/profile.test.ts` | NEW | 14 unit tests (defaults + validation) |
| `core/run-orchestrator/types.ts` | MODIFIED | Added `CropTargetProfile` import; added `activeProfile: CropTargetProfile` field to `RunContext` |
| `core/run-orchestrator/bootstrap.ts` | MODIFIED | Added `V1_ACTIVE_PROFILE` import; set `activeProfile: V1_ACTIVE_PROFILE` in returned `RunContext` |
| `core/run-orchestrator/index.ts` | MODIFIED | Added `CropTargetProfile`, `V1_ACTIVE_PROFILE`, `validateCropTargetProfile` re-exports |
| `core/run-orchestrator/__tests__/bootstrap.test.ts` | MODIFIED | Added `V1_ACTIVE_PROFILE` import; added 4 tests asserting profile attachment on `RunContext` |
| `core/run-orchestrator/__tests__/render-step.test.ts` | MODIFIED | Added `V1_ACTIVE_PROFILE` import; added `activeProfile` to `RunContext` fixture (required by updated type) |
| `package.json` | MODIFIED | Added `test:profile` script |
| `docs/question-cropper-v1/PROOF_LOG.md` | MODIFIED | This section |
| `ai-log/question_cropper_v1_1775585265501_1/proof-log.md` | MODIFIED | Machine log section appended |

#### Key diff references

- `core/crop-target-profile/profile.ts:15-20` — `V1_ACTIVE_PROFILE` constant with all three policy values (`target_type = 'question'`, `max_regions_per_target = 2`, `composition_mode = 'top_to_bottom'`). **Why it matters:** this is the single source of truth for V1 policy; all downstream modules must read from here, not hardcode their own values.
- `core/crop-target-profile/profile.ts:38-62` — `validateCropTargetProfile`: rejects unknown target types, rejects `max_regions_per_target` outside [1, 2] (INV-3), rejects unknown composition modes (INV-6). **Why it matters:** structural guard that would catch any future profile mis-construction before it reaches the run.
- `core/run-orchestrator/types.ts:46-56` — `activeProfile: CropTargetProfile` added to `RunContext`. **Why it matters:** profile is now part of the run contract; downstream steps (composer, segmentation guard) can read it from context without reaching back into the profile module.
- `core/run-orchestrator/bootstrap.ts:2,74` — `V1_ACTIVE_PROFILE` import and `activeProfile: V1_ACTIVE_PROFILE` in the returned `RunContext`. **Why it matters:** profile attachment happens exactly once, at run start, before any rendering, agent call, or crop step. This is the wiring required by the task.

---

### 5. Result Statement

**PASS — all TASK-103 deliverables are complete.**

- 78/78 tests pass (14 new in profile suite, 4 new in bootstrap suite)
- `npm run typecheck` exits 0
- `npm run build` exits 0
- `npm run test:profile` exits 0, 14/14 targeted profile tests pass
- Guard grep (no provider SDK in core) returns empty
- All three V1 policy constants centralized in `core/crop-target-profile/profile.ts`
- Profile attached to `RunContext` at bootstrap time via `V1_ACTIVE_PROFILE`
- No scattered hardcoding of policy values in any other module

**No deviations from Boundary Map.** No protected module touched.
3+ region support not added. Provider SDK not imported into core.

---

## Batch 1 Closeout

**Tasks complete:** TASK-101 ✓, TASK-102 ✓, TASK-103 ✓

**POs closed this batch:**
- PO-1 (complete): INV-1 satisfied — render path creates PreparedPageImages before any downstream step
- PO-3 (complete): INV-3 + INV-6 satisfied — V1 profile centralizes max 2 regions and top-to-bottom composition

**PO-8 partial:** boundary clean for all Batch 1 core modules; later batches will add more.

I confirm this batch completed all assigned tasks, recorded all required proof, and did not cross the approved Boundary Map unless explicitly noted.
