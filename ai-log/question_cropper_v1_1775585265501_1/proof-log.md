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

---

## Run: TASK-402 — Google Drive Upload Adapter + Orchestrator Upload Step (2026-04-08)

### Status: PASS

### Audit summary
TASK-402 had zero prior implementation. `adapters/upload/google-drive/**` did not exist; `core/run-orchestrator/upload-step.ts` did not exist. All required scaffolding was implemented in this run.

### Files created
- `adapters/upload/google-drive/types.ts` — DriveUploadResult interface + DriveUploadError class (UPLOAD_FAILED code, targetId, filePath)
- `adapters/upload/google-drive/uploader.ts` — uploadToDrive() with injectable DriveHttpUploadFn, OAuth token reader, native-fetch multipart Drive upload, 1-retry policy
- `adapters/upload/google-drive/index.ts` — barrel exports
- `adapters/upload/google-drive/__tests__/uploader.test.ts` — 9 tests: happy path, retry-success, exhausted-retry, token-missing, token-invalid-JSON, token-no-access_token, no-httpUpload-call-on-token-error
- `core/run-orchestrator/upload-step.ts` — DriveUploaderFn injection type + runUploadStep()
- `core/run-orchestrator/__tests__/upload-step.test.ts` — 12 tests: failed-row passthrough, ok-no-path passthrough, successful upload, UPLOAD_FAILED with local_output_path preservation, INV-8 continuation, INV-5 order, INV-4 no review_comment

### Files modified
- `core/result-model/types.ts:45-67` — added `local_output_path?: string` to FinalResultFailed; required by UPLOAD_FAILED path to preserve the local composed file path for user recovery (Layer B §5.2)
- `core/run-orchestrator/index.ts` — added `runUploadStep` and `DriveUploaderFn` exports
- `package.json` — added `test:upload-step` and `test:drive-uploader` scripts

### Implementation decisions
- `googleapis` SDK was NOT added as a dependency. The default upload implementation uses native `fetch` (Node 18+, `@types/node ^20.14` provides the type) with a manually composed multipart/related body — same pattern as `adapters/segmentation/gemini-segmenter/segmenter.ts` which also uses native fetch. This avoids adding a large SDK dependency while keeping the adapter fully functional.
- `DriveHttpUploadFn` is injectable in `uploadToDrive()` for test isolation, matching the `HttpPostFn` injection pattern in the segmenter.
- `DriveUploaderFn` is defined in `core/run-orchestrator/upload-step.ts` (not in the adapter) so core never imports from `adapters/**`. The adapter signature matches the injected type structurally.
- `local_output_path` was added to `FinalResultFailed` (optional) to preserve the file path when upload fails after successful composition. This is the cleanest way to satisfy "preserve the local output path where available" without forcing string-embedded path recovery from failure_message.

### Layer B boundary check
- Zero `googleapis`, `@google/genai`, or `vertex` import statements in any `core/**` file (grep confirmed).
- `review_comment` absent from all FinalResultRow shapes (INV-4, test-confirmed).
- One FinalResultRow per target, same order (INV-5, test-confirmed by mixed-row ordering test).
- Failed-row passthrough and UPLOAD_FAILED continuation leave other targets unaffected (INV-8, test-confirmed).
- `adapters/upload/google-drive/**` does not import from `core/crop-engine`, `adapters/segmentation`, or any other forbidden path.

### Validation

#### `npm run typecheck` → exit 0, no errors
#### `npm run build`     → exit 0, no errors
#### `npm test`         → 312/312 tests pass (23 suites; 21 new tests vs. prior baseline of 291)
#### `npm run test:upload-step`    → 12/12 pass
#### `npm run test:drive-uploader` → 9/9 pass

### Required grep evidence

#### `rg -n "drive_file_id|drive_url|status" adapters/upload/google-drive core/result-model core/run-orchestrator`
- `adapters/upload/google-drive/types.ts:19,21` — DriveUploadResult fields
- `adapters/upload/google-drive/uploader.ts:184` — maps result.id → drive_file_id, result.webViewLink → drive_url
- `core/result-model/types.ts:33,35` — optional fields on FinalResultOk
- `core/run-orchestrator/upload-step.ts:40,83,92,93,104` — DriveUploaderFn return shape + row assembly

#### `rg -n "oauth|token|folder" adapters/upload/google-drive adapters/config/local-config`
- `adapters/upload/google-drive/uploader.ts:115-147` — readAccessToken() reads OAUTH_TOKEN_PATH, extracts access_token
- `adapters/config/local-config/types.ts:10-17` — DRIVE_FOLDER_ID and OAUTH_TOKEN_PATH already defined

#### `rg -n "googleapis|@google/genai|vertex|drive" core`
- Zero SDK import statements. Only field name occurrences (`drive_file_id`, `drive_url`) and comment text. INV-9 boundary clean.

### Key diff references
- `core/result-model/types.ts:55-67` — `local_output_path?` added to FinalResultFailed (UPLOAD_FAILED preservation)
- `adapters/upload/google-drive/uploader.ts:115-147` — OAuth token file reader with DriveUploadError on missing/malformed token
- `adapters/upload/google-drive/uploader.ts:155-188` — uploadToDrive(): 2-attempt retry loop, maps result → DriveUploadResult
- `core/run-orchestrator/upload-step.ts:64-107` — runUploadStep(): failed passthrough → no-path passthrough → upload → UPLOAD_FAILED with local_output_path
- `core/run-orchestrator/index.ts` — runUploadStep + DriveUploaderFn added to barrel

### Claims satisfied
- TASK-402 scope: `adapters/upload/google-drive/**` implemented with OAuth token reader + Drive v3 multipart upload + 1-retry policy
- Normalized upload results: drive_file_id and drive_url returned and wired into FinalResultOk
- Upload sequencing wired into `core/run-orchestrator/**` after composition via runUploadStep
- Layer B preserved: no provider SDK in core, no review_comment in result rows, one-file-per-target intact
- UPLOAD_FAILED path: local_output_path preserved on failed row, other targets continue

### Acceptance bar verification
- drive_file_id and drive_url populated on successful upload → PASS (upload-step test)
- retry once on failure, then throw DriveUploadError → PASS (drive-uploader test: 2 calls on exhausted retry)
- UPLOAD_FAILED row preserves local_output_path → PASS (upload-step "preserves local_output_path" test)
- failed-row pass-through (INV-8) → PASS (upload-step "failed row pass-through" tests)
- INV-5 one row per target same order → PASS (upload-step "mixed rows" test)
- INV-4 no review_comment → PASS (upload-step "review_comment absent" test)
- INV-9 no googleapis in core → PASS (grep confirms zero SDK import statements)

### Unresolved / follow-up
- Prompt-config-store (TASK-502) and local UI (TASK-503) not touched — outside TASK-402 scope.
- The default DriveHttpUploadFn uses `fetch` with a manually composed multipart body. No integration test against a real Drive API is included — this is expected for V1 local-pipeline scope; a smoke test with real credentials is a future step.

---

## Run: TASK-402 audit-and-close pass — Permission step (2026-04-08)

### Audit Finding

**(a) Permission-setting state in repo reality:** MISSING before this run.
`adapters/upload/google-drive/uploader.ts` uploaded files and returned `webViewLink` but never called the Drive Permissions API. The file was not made link-accessible.

**(b) Gap closed by this run:** Added `DriveHttpPermissionFn` + `defaultDriveHttpPermission` (calls `POST /drive/v3/files/{id}/permissions` with `{role:'reader',type:'anyone'}`). `uploadToDrive` now calls the permission step after a successful upload. A permission failure throws `DriveUploadError` → `runUploadStep` catches and converts to `UPLOAD_FAILED` (existing behavior, unchanged).

### Result: PASS

### Files touched
- `adapters/upload/google-drive/uploader.ts` — MODIFIED: added `DriveHttpPermissionFn` type, `defaultDriveHttpPermission` impl, 6th param on `uploadToDrive`, separated upload-retry loop from permission step
- `adapters/upload/google-drive/index.ts` — MODIFIED: added `DriveHttpPermissionFn` to exports
- `adapters/upload/google-drive/__tests__/uploader.test.ts` — MODIFIED: updated all upload tests to inject permission fn, added 5 new permission tests (14 total, was 9)
- `ai-log/question_cropper_v1_1775585265501_1/proof-log.md` — this section appended

### Validation
- `npm run typecheck` → exit 0, no errors
- `npm test` → 317/317 tests pass (23 suites)
- Targeted: `npx jest --testPathPattern='google-drive'` → 14/14 pass

### Key diff references
- `adapters/upload/google-drive/uploader.ts:38-56` — `DriveHttpPermissionFn` type + `defaultDriveHttpPermission` calling `POST /drive/v3/files/{id}/permissions` with `{role:'reader',type:'anyone'}`
- `adapters/upload/google-drive/uploader.ts:162-175` — updated `uploadToDrive` signature (6th param `httpPermission`)
- `adapters/upload/google-drive/uploader.ts:185-210` — upload retry loop (upload-only; exits on first success)
- `adapters/upload/google-drive/uploader.ts:212-220` — permission step: runs after upload success; permission failure → `DriveUploadError`
- `adapters/upload/google-drive/__tests__/uploader.test.ts:207-263` — 5 new `uploadToDrive — permission step` tests

### Guard greps
- `rg -n "googleapis|@google/genai|vertex|drive" core` → "drive" appears as normalized field names (`drive_file_id`, `drive_url`) and in comments only — zero SDK imports. PASS (INV-9 intact)
- `rg -n "review_comment|needs_review" core/result-model core/run-orchestrator/upload-step.ts adapters/upload` → `review_comment` appears only in defensive comments/assertions confirming absence. PASS (INV-4 intact)

### Invariants confirmed
- FR-UF6-2 / Layer B Boundary H: permission step now runs after every successful upload
- Permission failure → `DriveUploadError` → `runUploadStep` → `UPLOAD_FAILED` (existing INV-8 path)
- INV-5 (one row per target, same order): unchanged, owned by `runUploadStep`
- INV-4 (no `review_comment` in final rows): unchanged, confirmed by grep
- INV-9 (no provider SDK in `core/**`): unchanged, confirmed by grep

### Unresolved / follow-up
- Same as prior run: no integration test against real Drive API (expected for V1 scope).
- `upload-step.test.ts` already proves permission-failure → UPLOAD_FAILED via the existing `makeFailingUploader` path; no change to that file needed.

---

## Run: TASK-501 audit-and-close pass (2026-04-08)

### Audit Finding

**(a) TASK-501 state before this run:**
- `core/run-summary/types.ts` — `RunSummaryTargetEntry` had agent review fields (`review_comment`, `agent1_status`, `agent2_status`, `agent2_review_comment`) from TASK-201/301. Did NOT have final-result fields: `final_status`, `drive_url`, `failure_code`, `failure_message`.
- `core/run-summary/summary.ts` — `buildRunSummaryFromSegmentation` + `applyLocalizationToSummary` present. `applyFinalResultsToSummary` was missing (noted in file comment: "Later tasks will add final-result fields").
- `adapters/ui/local-app/` — did not exist.
- `core/result-model/`, `core/run-orchestrator/` — fully implemented by TASK-401/402; accepted by reviewer.

**(b) Exact gaps closed this run:**
1. `RunSummaryTargetEntry` extended with `final_status`, `drive_url`, `failure_code`, `failure_message`.
2. `applyFinalResultsToSummary(state, rows)` added to `core/run-summary/summary.ts`.
3. `core/run-summary/index.ts` updated to export `applyFinalResultsToSummary`.
4. `adapters/ui/local-app/summary-renderer.ts` created — HTML renderer with `data-testid` selectors.
5. `adapters/ui/local-app/index.ts` created — barrel export.
6. `core/run-summary/__tests__/summary-final.test.ts` — 15 unit tests for `applyFinalResultsToSummary`.
7. `adapters/ui/local-app/__tests__/summary-renderer.test.ts` — 23 unit tests for HTML rendering.

### Result: PASS

### Files touched
- `core/run-summary/types.ts` — MODIFIED: added `final_status`, `drive_url`, `failure_code`, `failure_message` to `RunSummaryTargetEntry` (lines 62–95)
- `core/run-summary/summary.ts` — MODIFIED: added `applyFinalResultsToSummary` function (lines 101–161); added `FinalResultRow` import
- `core/run-summary/index.ts` — MODIFIED: added `applyFinalResultsToSummary` to exports
- `core/run-summary/__tests__/summary-final.test.ts` — CREATED: 15 tests
- `adapters/ui/local-app/summary-renderer.ts` — CREATED: HTML renderer with `data-testid` selectors
- `adapters/ui/local-app/index.ts` — CREATED: barrel export
- `adapters/ui/local-app/__tests__/summary-renderer.test.ts` — CREATED: 23 tests
- `ai-log/question_cropper_v1_1775585265501_1/proof-log.md` — this section appended

### Validation
- `npm run typecheck` → exit 0, no errors
- `npm test` → 355/355 tests pass (25 suites, was 317/317 in 23 suites)
- New test suites added: `core/run-summary/__tests__/summary-final.test.ts` (15), `adapters/ui/local-app/__tests__/summary-renderer.test.ts` (23)

### Key diff references
- `core/run-summary/types.ts:63–95` — final result fields on `RunSummaryTargetEntry`: `final_status`, `drive_url`, `failure_code`, `failure_message`
- `core/run-summary/summary.ts:101–161` — `applyFinalResultsToSummary` implementation: maps `FinalResultRow[]` into summary state; INV-4 (review_comment preserved, not added to rows); INV-8 (all targets updated, partial failure visible)
- `adapters/ui/local-app/summary-renderer.ts:1–113` — HTML renderer; see lines 14–27 for the UI selector plan
- `adapters/ui/local-app/summary-renderer.ts:43–92` — `renderTargetRow` function: every row always rendered (INV-8)

### UI selector plan (stable data-testid values)
| Element | Selector |
|---------|----------|
| Summary container | `data-testid="run-summary"` |
| Per-row container | `data-testid="summary-row-{target_id}"` |
| Per-row status | `data-testid="summary-row-status-{target_id}"` |
| Drive URL anchor | `data-testid="summary-row-drive-url-{target_id}"` |
| Agent 1 review note | `data-testid="summary-row-review-comment-{target_id}"` |
| Agent 2 review note | `data-testid="summary-row-agent2-review-comment-{target_id}"` |
| Failure code | `data-testid="summary-row-failure-code-{target_id}"` |
| Failure message | `data-testid="summary-row-failure-message-{target_id}"` |

App route/page: `renderSummaryHtml(state)` returns a complete HTML document. The caller writes it to a local `.html` file (e.g. `run-summary.html`) and opens it in a browser. There is no server route — this is a static local report.

### Guard greps (required by task)
- `rg -n "review_comment" core/run-summary adapters/ui/local-app` → present only in summary state (types, functions, tests) — not in result-model or orchestrator output paths. PASS (INV-4).
- `rg -n "review_comment|needs_review" core/result-model core/run-orchestrator` → appears only in defensive comments and `expect('review_comment' in row).toBe(false)` assertions. Zero actual field setters on FinalResultRow. PASS (INV-4).
- `rg -n "failed|status|drive_url" core/run-summary adapters/ui/local-app` → `final_status`, `drive_url`, `failure_code`, `failure_message` all present in summary types, function, and renderer. PASS (PO-4, PO-7).

### Invariants confirmed
- INV-4: `review_comment` visible in summary state and HTML UI; zero leakage into `FinalResultRow` (confirmed by grep + existing tests in result-model + orchestrator).
- INV-8: `applyFinalResultsToSummary` iterates all rows; `renderTargetRow` called for every entry regardless of `final_status`; one failed target does not suppress others.
- INV-9: `adapters/ui/local-app/` imports only `core/run-summary/types` (normalized contracts); no provider SDK types.

### PO claims satisfied
- PO-4 (supports INV-4): `review_comment` present in RunSummaryTargetEntry, absent from FinalResultRow — proven by types + tests + greps.
- PO-7 (supports INV-8): mixed ok/failed target set produces per-target rows in summary state and HTML UI — proven by `summary-final.test.ts` "INV-8: partial failure visible" test + `summary-renderer.test.ts` "INV-8: partial failure stays visible" test.

### Unresolved / follow-up
- No UI framework integration (TASK-503 scope): `renderSummaryHtml` returns a string; caller writes to disk. This is intentional for a local Node.js CLI tool.
- No integration test against real Drive API (unchanged from TASK-402 note).
- TASK-502 (prompt-config-store) not touched — outside this scope.
