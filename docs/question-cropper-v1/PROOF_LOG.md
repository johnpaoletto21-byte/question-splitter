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

*Batch 1 closeout statement will be added at end of Batch 1 (after TASK-102 and TASK-103).*
