# AI Proof Log — question_cropper_v1 / 1775585265501_1

---

## Run: TASK-101 — Local Config, Source Model, Run Bootstrap (2026-04-07)

### Result: PASS

### Files touched
- `package.json`, `tsconfig.json`, `jest.config.js` (project scaffold)
- `adapters/config/local-config/types.ts` — LocalConfig interface, ConfigMissingError
- `adapters/config/local-config/loader.ts` — loadConfig() fail-fast loader
- `adapters/config/local-config/index.ts`
- `adapters/config/local-config/__tests__/loader.test.ts` (18 tests)
- `core/source-model/types.ts` — PdfSource, PreparedPageImage, PreparedPageValidationError
- `core/source-model/validation.ts` — validatePreparedPageImage, validatePreparedPageImages
- `core/source-model/index.ts`
- `core/source-model/__tests__/validation.test.ts` (13 tests)
- `core/run-orchestrator/types.ts` — RunRequest, RunContext, RunBootstrapError
- `core/run-orchestrator/bootstrap.ts` — bootstrapRun()
- `core/run-orchestrator/index.ts`
- `core/run-orchestrator/__tests__/bootstrap.test.ts` (10 tests)
- `docs/question-cropper-v1/DECISIONS.md` (DEC-001..DEC-004)
- `docs/question-cropper-v1/PROOF_LOG.md`

### Validation
- `npm run typecheck` → exit 0, no errors
- `npm run build`     → exit 0, no errors
- `npm test`         → 41/41 tests pass (3 suites)

### Key diff references
- `adapters/config/local-config/loader.ts:72-80` — fail-fast CONFIG_MISSING throw
- `core/source-model/types.ts:40-55` — PreparedPageImage contract (all 5 Boundary A fields)
- `core/run-orchestrator/bootstrap.ts:45-71` — order-preserving bootstrapRun

### Guard greps
- `rg -n "googleapis|@google/genai|vertex|drive" core` → (no output) PASS

### Claims
- PO-1 (partial, pending TASK-102 render path)
- PO-8 (partial, boundary clean for TASK-101 modules)

### Unresolved / follow-up
- ~~TASK-102: PDF renderer populates PreparedPageImage at runtime~~ (completed)
- TASK-103: crop-target-profile scaffold (PO-3)

---

## Run: TASK-102 — PDF Rendering + Orchestrator Handoff (2026-04-08)

### Result: PASS

### Files touched (new or modified)
- `adapters/source-preparation/pdf-renderer/types.ts` — NEW: RenderRequest, PdfRenderError
- `adapters/source-preparation/pdf-renderer/renderer.ts` — NEW: renderPdfSource() (pdfjs-dist + canvas)
- `adapters/source-preparation/pdf-renderer/index.ts` — NEW: re-exports
- `adapters/source-preparation/pdf-renderer/__tests__/renderer.test.ts` — NEW: 11 integration tests
- `core/run-orchestrator/render-step.ts` — NEW: PageRenderer type, renderAllSources()
- `core/run-orchestrator/types.ts` — MODIFIED: added preparedPages?: PreparedPageImage[]
- `core/run-orchestrator/index.ts` — MODIFIED: added renderAllSources, PageRenderer exports
- `core/run-orchestrator/__tests__/render-step.test.ts` — NEW: 8 unit tests
- `package.json` — MODIFIED: canvas + pdfjs-dist deps; pdf-lib devDep; new test scripts
- `docs/question-cropper-v1/DECISIONS.md` — DEC-005, DEC-006 added
- `docs/question-cropper-v1/PROOF_LOG.md` — TASK-102 section appended

### Validation
- `npm run typecheck` → exit 0, no errors
- `npm run build`     → exit 0, no errors
- `npm test`         → 60/60 tests pass (5 suites; 19 new tests)
- `npm run test:pdf-renderer` → 11/11 integration tests pass
- `npm run test:render-step`  → 8/8 unit tests pass

### Key diff references
- `adapters/source-preparation/pdf-renderer/renderer.ts:43-134` — renderPdfSource: full render path, all 5 Boundary A fields
- `adapters/source-preparation/pdf-renderer/renderer.ts:125-130` — PreparedPageImage construction (page_number, image_path, image_width, image_height)
- `core/run-orchestrator/types.ts:50-57` — preparedPages field added to RunContext (handoff point)
- `core/run-orchestrator/render-step.ts:23-30` — PageRenderer injection type (keeps core SDK-clean)
- `core/run-orchestrator/render-step.ts:45-57` — renderAllSources: accumulate + validate gate

### Guard greps
- `rg -n "googleapis|@google/genai|vertex|drive" core` → (no output) PASS
- `rg -n "pdf|page_number|image_width|image_height|image_path" adapters/source-preparation/pdf-renderer core/source-model` → all 5 fields present
- `rg -n "render" core/run-orchestrator adapters/source-preparation/pdf-renderer` → renderAllSources + renderPdfSource connected

### Sample PDF rendered
- Fixture: pdf-lib generated US Letter 612×792 pt blank PDF
- Rendered at 1.5× scale → 918×1188 px PNG
- page_number=1 (1-based, DEC-004), PNG file exists on disk

### Claims
- PO-1 (complete for Batch 1) — INV-1 satisfied: render path creates PreparedPageImages before orchestrator returns

### Decisions added
- DEC-005: pdfjs-dist 3.x (CJS legacy) + canvas 3.x (why: pdfjs 5.x ESM-only, incompatible with project's CommonJS module setting)
- DEC-006: RENDER_SCALE = 1.5× (108 DPI effective, US Letter → 918×1188 px)

### Unresolved / follow-up
- TASK-103: crop-target-profile scaffold (PO-3)

---

## Run: TASK-103 — Crop Target Profile Scaffold + Orchestrator Wiring (2026-04-08)

### Result: PASS

### Files touched (new or modified)
- `core/crop-target-profile/types.ts` — NEW: CropTargetProfile interface, TargetType, CompositionMode, ProfileValidationError
- `core/crop-target-profile/profile.ts` — NEW: V1_ACTIVE_PROFILE constant, validateCropTargetProfile()
- `core/crop-target-profile/index.ts` — NEW: re-exports
- `core/crop-target-profile/__tests__/profile.test.ts` — NEW: 14 unit tests
- `core/run-orchestrator/types.ts` — MODIFIED: added CropTargetProfile import; added activeProfile: CropTargetProfile to RunContext
- `core/run-orchestrator/bootstrap.ts` — MODIFIED: added V1_ACTIVE_PROFILE import; set activeProfile at run start
- `core/run-orchestrator/index.ts` — MODIFIED: added CropTargetProfile/V1_ACTIVE_PROFILE/validateCropTargetProfile exports
- `core/run-orchestrator/__tests__/bootstrap.test.ts` — MODIFIED: added V1_ACTIVE_PROFILE import + 4 profile attachment tests
- `core/run-orchestrator/__tests__/render-step.test.ts` — MODIFIED: added activeProfile to RunContext fixture
- `package.json` — MODIFIED: added test:profile script

### Validation
- `npm run typecheck` → exit 0, no errors
- `npm run build`     → exit 0, no errors
- `npm test`         → 78/78 tests pass (6 suites; 18 new tests)
- `npm run test:profile` → 14/14 profile tests pass

### Key diff references
- `core/crop-target-profile/profile.ts:15-20` — V1_ACTIVE_PROFILE with all 3 policy values
- `core/crop-target-profile/profile.ts:38-62` — validateCropTargetProfile enforcing INV-3 (max 2 regions) + INV-6
- `core/run-orchestrator/types.ts:46-56` — activeProfile: CropTargetProfile added to RunContext
- `core/run-orchestrator/bootstrap.ts:2,74` — V1_ACTIVE_PROFILE import + attachment at run start

### Guard greps
- `rg -n "target_type|max_regions_per_target|composition_mode|top_to_bottom" core` → all matches point to crop-target-profile only; no scattered hardcoding PASS
- `rg -n "question" core/crop-target-profile core/run-orchestrator` → profile module + tests only PASS
- `rg -n "googleapis|@google/genai|vertex|drive" core` → (no output) PASS

### Claims
- PO-3 (complete) — INV-3 + INV-6 satisfied

### Unresolved / follow-up
- TASK-201: Agent 1 segmentation adapter (Batch 2)

---

## Run: TASK-201 — Agent 1 Segmentation (2026-04-08)

### Result: PASS

### Files created
- `core/segmentation-contract/types.ts`
- `core/segmentation-contract/validation.ts`
- `core/segmentation-contract/index.ts`
- `core/segmentation-contract/__tests__/validation.test.ts` (28 tests)
- `adapters/segmentation/gemini-segmenter/types.ts`
- `adapters/segmentation/gemini-segmenter/schema.ts`
- `adapters/segmentation/gemini-segmenter/prompt.ts`
- `adapters/segmentation/gemini-segmenter/parser.ts`
- `adapters/segmentation/gemini-segmenter/segmenter.ts`
- `adapters/segmentation/gemini-segmenter/index.ts`
- `adapters/segmentation/gemini-segmenter/__tests__/prompt.test.ts` (7 tests)
- `adapters/segmentation/gemini-segmenter/__tests__/parser.test.ts` (11 tests)
- `adapters/segmentation/gemini-segmenter/__tests__/segmenter.test.ts` (17 tests)
- `core/run-orchestrator/segmentation-step.ts`
- `core/run-orchestrator/__tests__/segmentation-step.test.ts` (6 tests)
- `core/run-summary/types.ts`
- `core/run-summary/summary.ts`
- `core/run-summary/index.ts`
- `core/run-summary/__tests__/summary.test.ts` (13 tests)

### Files modified
- `core/run-orchestrator/index.ts` — added runSegmentationStep + Segmenter exports

### Validation
- `npm run typecheck`: exit 0
- `npm run build`: exit 0
- `npm test`: 160/160 pass (82 new)
- targeted: `npx jest --testPathPattern='segmentation|run-summary'`: 82/82 pass

### Greps
- `rg -n "bbox_1000" core/segmentation-contract adapters/segmentation`: matches only in test fixtures (rejection inputs) and validation guard; zero accepted field occurrences
- `rg -n "review_comment" core/segmentation-contract adapters/segmentation core/run-summary`: present in agent output types and summary state only; absent from result-model
- `rg -n "googleapis|@google/genai|vertex|drive" core`: NO MATCHES — boundary clean

### Claims satisfied
- PO-2 (INV-2): no bbox_1000 in segmentation contract — proven
- PO-4 partial (INV-4): review_comment in agent output and summary, not in result-model — proven for TASK-201 scope
- PO-8 partial (INV-9): zero provider SDK in core — proven


---

## Run: TASK-401 — Output Composer + Result Model + Orchestrator Composition Step (2026-04-08)

### Result: PASS

### Files created
- `core/result-model/types.ts` — FinalResultOk, FinalResultFailed, FinalResultRow discriminated union
- `core/result-model/index.ts` — barrel exports
- `core/result-model/__tests__/types.test.ts` — 7 tests: required fields, INV-4 (no review_comment), discriminated union narrowing
- `core/output-composer/types.ts` — ComposerInput, ComposerRegion, ComposerResult, CompositionError
- `core/output-composer/composer.ts` — composeOutput(), ImageStackerFn injection type
- `core/output-composer/index.ts` — barrel exports
- `core/output-composer/__tests__/composer.test.ts` — 12 tests: 1-region passthrough, 2-region stacker call, 0/3+ region rejection (INV-3), mode guard (INV-6)
- `core/run-orchestrator/composition-step.ts` — runCompositionStep()
- `core/run-orchestrator/__tests__/composition-step.test.ts` — 9 tests: failed-crop passthrough, 1-region, 2-region, CompositionError continuation

### Files modified
- `core/run-orchestrator/index.ts` — added runCompositionStep + ImageStackerFn exports
- `package.json` — added test:output-composer, test:result-model, test:composition-step scripts

### Validation
- `npm run typecheck` → exit 0, no errors
- `npm run build`     → exit 0, no errors
- `npm test`         → 291/291 tests pass (21 suites; 28 new tests vs. prior baseline of 279+)
- `npm run test:output-composer`    → 12/12 pass
- `npm run test:result-model`       → 7/7 pass
- `npm run test:composition-step`   → 9/9 pass

### Guard greps

#### `rg -n "top_to_bottom|composition_mode|output_file_name" core/output-composer core/result-model`
All `top_to_bottom` references land in `core/output-composer/composer.ts:64` (runtime guard) and `types.ts` (doc comments). `output_file_name` is the Layer B contract field name defined in `core/result-model/types.ts:28,49`. No scattered hardcoding.

#### `rg -n "target_id|source_pages|status" core/result-model core/run-orchestrator`
`target_id`, `source_pages`, `status` appear in `core/result-model/types.ts` as required contract fields, and in `core/run-orchestrator/composition-step.ts` where rows are assembled. Correct data flow confirmed.

#### `rg -n "googleapis|@google/genai|vertex|drive" core`
Matches are field names (`drive_file_id`, `drive_url`) in the result-model contract (Layer B required optional fields) and comment text in localization/segmentation contracts. Zero provider SDK import statements in any `core/**` file. INV-9 boundary clean.

### Key diff references
- `core/result-model/types.ts:24-55` — FinalResultOk and FinalResultFailed interfaces; `review_comment` absent from both (INV-4)
- `core/output-composer/composer.ts:63-68` — INV-6 guard: `compositionMode !== 'top_to_bottom'` throws CompositionError
- `core/output-composer/composer.ts:71-76` — INV-3 guard: `regions.length === 0 || regions.length > 2` throws CompositionError (no silent 3+ support)
- `core/output-composer/composer.ts:78-90` — routing: 1-region passthrough vs 2-region imageStacker call
- `core/run-orchestrator/composition-step.ts:66-80` — failed crop → failed FinalResultRow, continue (INV-8)
- `core/run-orchestrator/composition-step.ts:104-116` — CompositionError → failed FinalResultRow, continue (INV-8)

### Claims satisfied
- PO-3 partial (INV-3, INV-6): composer enforces max 2 regions and top_to_bottom-only at composition time — proven by 12 composer tests
- PO-4 complete (INV-4): review_comment absent from FinalResultRow type and all rows assembled in composition-step — proven by result-model tests + composition-step INV-4 assertions
- PO-5 (INV-5): one FinalResultRow per target — proven by composition-step "one row per target in input order" test
- PO-8 (INV-9): zero provider SDK imports in core — guard grep confirms no googleapis/genai/vertex/drive import statements

### Acceptance bar verification
- one-region passthrough → exactly one ok FinalResultRow, stacker not called: PASS (3 tests)
- two-region composition → exactly one ok FinalResultRow, stacker called with top+bottom in order: PASS (2 tests)
- composition is top-to-bottom only → mode guard throws for any other value: PASS (2 tests)
- no silent 3+ region support → 3 regions throws CompositionError immediately: PASS (2 tests, includes continuation proof)
- review_comment absent from result model → INV-4 assertions in result-model and composition-step tests: PASS (4 tests)
- minimal orchestrator continuation behavior → failed crop and CompositionError both continue to next target: PASS (3 tests)
- no provider SDK imports in core → grep confirms zero matches: PASS

### Unresolved / follow-up
- Upload step (TASK-501): drive_file_id and drive_url optional fields are defined in FinalResultRow but not populated yet — correct; upload is TASK-501 scope.
- Prompt-config-store (TASK-502): not touched in TASK-401 scope.
