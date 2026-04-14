"use strict";
/**
 * adapters/run-pipeline/full-pipeline-runner.ts
 *
 * Adapter-layer glue for the full local PDF-to-Drive pipeline.
 *
 * New flow:
 *   Render → [per chunk: Segment → Review → Localize (sliding windows)] → Dedup → Crop → Compose → Upload
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFullPipeline = runFullPipeline;
const fs = __importStar(require("fs"));
const pdf_renderer_1 = require("../source-preparation/pdf-renderer");
const gemini_segmenter_1 = require("../segmentation/gemini-segmenter");
const gemini_reviewer_1 = require("../segmentation-review/gemini-reviewer");
const gemini_localizer_1 = require("../localization/gemini-localizer");
const gemini_deduplicator_1 = require("../deduplication/gemini-deduplicator");
const google_drive_1 = require("../upload/google-drive");
const image_processing_1 = require("../image-processing");
const run_orchestrator_1 = require("../../core/run-orchestrator");
const summary_1 = require("../../core/run-summary/summary");
const page_windows_1 = require("./page-windows");
function emit(onLog, stage, message) {
    onLog?.({ stage, message, timestamp: new Date().toISOString() });
}
function formatUnknownError(err) {
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    try {
        return JSON.stringify(err);
    }
    catch {
        return String(err);
    }
}
function errorCode(err, fallback) {
    if (typeof err === 'object' &&
        err !== null &&
        typeof err['code'] === 'string') {
        return err['code'];
    }
    return fallback;
}
/**
 * Runs the complete local pipeline and returns the final summary state.
 */
async function runFullPipeline(input, deps = {}) {
    fs.mkdirSync(input.config.OUTPUT_DIR, { recursive: true });
    emit(input.onLog, 'bootstrap', 'Starting run');
    const context = (0, run_orchestrator_1.bootstrapRun)({
        pdfFilePaths: input.pdfFilePaths,
        config: input.config,
        runLabel: input.runLabel,
        promptSnapshot: input.promptSnapshot,
    });
    emit(input.onLog, 'bootstrap', `Run ID: ${context.run_id}`);
    emit(input.onLog, 'render', 'Rendering PDF pages');
    const rendered = await (0, run_orchestrator_1.renderAllSources)(context, deps.renderer ?? pdf_renderer_1.renderPdfSource);
    emit(input.onLog, 'render', `Rendered ${rendered.preparedPages.length} page image(s)`);
    const extractionFields = input.extractionFields ?? [];
    const chunkSize = input.chunkSize ?? 10;
    const chunkOverlap = input.chunkOverlap ?? 3;
    // Build segmenter function
    const segmenter = deps.segmenter ?? ((runId, pages, profile, promptSnapshot, options) => (0, gemini_segmenter_1.segmentPages)(runId, pages, profile, promptSnapshot, { apiKey: input.config.GEMINI_API_KEY }, undefined, undefined, options));
    // Build reviewer function
    const reviewer = deps.reviewer ?? ((runId, segResult, allPages, profile, promptSnapshot, opts) => (0, gemini_reviewer_1.reviewSegmentation)(runId, segResult, allPages, profile, promptSnapshot, { apiKey: input.config.GEMINI_API_KEY }, undefined, undefined, opts));
    // Build window localizer function
    const windowLocalizer = deps.windowLocalizer ?? ((runId, questionList, windowPages, profile, promptSnapshot) => (0, gemini_localizer_1.localizeWindow)(runId, questionList, windowPages, profile, promptSnapshot, { apiKey: input.config.GEMINI_API_KEY }));
    // ---------------------------------------------------------------------------
    // Phase 1: Per-chunk processing (Segment → Review → Localize via sliding windows)
    // ---------------------------------------------------------------------------
    emit(input.onLog, 'segmentation', `Building ${chunkSize}-page chunks with ${chunkOverlap}-page overlap`);
    const chunks = (0, page_windows_1.buildChunkedPageWindows)(rendered.preparedPages, chunkSize, chunkOverlap);
    emit(input.onLog, 'segmentation', `Created ${chunks.length} chunk(s)`);
    const agent1ChunkResults = [];
    const reviewChunkResults = [];
    const allLocalized = [];
    const localizationFailureRows = [];
    const dedupChunkInputs = [];
    for (const chunk of chunks) {
        emit(input.onLog, 'segmentation', `Chunk ${chunk.chunkIndex}: pages ${chunk.startPage}-${chunk.endPage}`);
        // Agent 1: Segment this chunk (produces question inventory, no regions)
        let segmentation;
        try {
            segmentation = await (0, run_orchestrator_1.runSegmentationStep)(rendered.run_id, chunk.pages, rendered.activeProfile, rendered.promptSnapshot.agent1Prompt, segmenter, {
                extractionFields,
                chunkStartPage: chunk.startPage,
                chunkEndPage: chunk.endPage,
            });
        }
        catch (err) {
            const message = formatUnknownError(err);
            emit(input.onLog, 'segmentation', `Agent 1 failed for chunk ${chunk.chunkIndex}: ${message}`);
            throw {
                code: errorCode(err, 'SEGMENTATION_FAILED'),
                message,
                chunk: { chunkIndex: chunk.chunkIndex, startPage: chunk.startPage, endPage: chunk.endPage },
            };
        }
        emit(input.onLog, 'segmentation', `Chunk ${chunk.chunkIndex}: Agent 1 found ${segmentation.targets.length} target(s)`);
        agent1ChunkResults.push({
            chunkIndex: chunk.chunkIndex,
            startPage: chunk.startPage,
            endPage: chunk.endPage,
            contextPageNumbers: chunk.pages.map((p) => p.page_number),
            targets: segmentation.targets,
        });
        // Agent 2: Review this chunk's segmentation
        emit(input.onLog, 'review', `Chunk ${chunk.chunkIndex}: running review`);
        let reviewedSegmentation;
        try {
            reviewedSegmentation = await (0, run_orchestrator_1.runReviewStep)(rendered.run_id, segmentation, chunk.pages, rendered.activeProfile, rendered.promptSnapshot.reviewerPrompt, reviewer, { extractionFields });
        }
        catch (err) {
            const message = formatUnknownError(err);
            emit(input.onLog, 'review', `Agent 2 review failed for chunk ${chunk.chunkIndex}: ${message}`);
            // Use segmentation result as fallback if review fails
            reviewedSegmentation = segmentation;
        }
        const wasCorrected = reviewedSegmentation !== segmentation;
        emit(input.onLog, 'review', `Chunk ${chunk.chunkIndex}: ${wasCorrected ? 'corrected' : 'pass'} (${reviewedSegmentation.targets.length} target(s))`);
        reviewChunkResults.push({
            chunkIndex: chunk.chunkIndex,
            corrected: wasCorrected,
            targets: reviewedSegmentation.targets,
        });
        // Agent 3: Localize via sliding windows
        emit(input.onLog, 'localization', `Chunk ${chunk.chunkIndex}: building localization windows`);
        const locWindows = (0, page_windows_1.buildLocalizationWindows)(chunk.pages);
        emit(input.onLog, 'localization', `Chunk ${chunk.chunkIndex}: ${locWindows.length} window(s)`);
        const windowResults = [];
        for (const win of locWindows) {
            try {
                const result = await windowLocalizer(rendered.run_id, reviewedSegmentation.targets, win.pages, rendered.activeProfile, rendered.promptSnapshot.agent2Prompt);
                windowResults.push(result);
                emit(input.onLog, 'localization', `Chunk ${chunk.chunkIndex}, window ${win.windowIndex}: found ${result.regions.length} region(s)`);
            }
            catch (err) {
                const message = formatUnknownError(err);
                emit(input.onLog, 'localization', `Chunk ${chunk.chunkIndex}, window ${win.windowIndex}: localization failed: ${message}`);
                // Window failures are not fatal — other windows may still cover the same questions
            }
        }
        // Assemble per-window results into per-target LocalizationResults
        const chunkLocalized = (0, run_orchestrator_1.assembleLocalizationResults)(rendered.run_id, reviewedSegmentation.targets, windowResults, locWindows);
        // Track targets that weren't found in any window
        const localizedTargetIds = new Set(chunkLocalized.map((l) => l.target_id));
        for (const target of reviewedSegmentation.targets) {
            if (!localizedTargetIds.has(target.target_id)) {
                localizationFailureRows.push({
                    target_id: target.target_id,
                    source_pages: [],
                    output_file_name: '',
                    status: 'failed',
                    failure_code: 'LOCALIZATION_NOT_FOUND',
                    failure_message: `Question ${target.question_number ?? target.target_id} not found in any localization window`,
                });
            }
        }
        for (const loc of chunkLocalized) {
            allLocalized.push(loc);
        }
        emit(input.onLog, 'localization', `Chunk ${chunk.chunkIndex}: localized ${chunkLocalized.length} target(s)`);
        // Build dedup input for this chunk
        const chunkTargets = chunkLocalized.map((loc) => {
            const segTarget = reviewedSegmentation.targets.find((t) => t.target_id === loc.target_id);
            return {
                target_id: `chunk${chunk.chunkIndex}_${loc.target_id}`,
                target_type: segTarget?.target_type ?? 'question',
                question_number: segTarget?.question_number,
                question_text: segTarget?.question_text,
                sub_questions: segTarget?.sub_questions,
                regions: loc.regions,
                extraction_fields: segTarget?.extraction_fields,
                review_comment: segTarget?.review_comment,
            };
        });
        dedupChunkInputs.push({
            chunk_index: chunk.chunkIndex,
            start_page: chunk.startPage,
            end_page: chunk.endPage,
            targets: chunkTargets,
        });
    }
    emit(input.onLog, 'localization', `All chunks: ${allLocalized.length} localized, ${localizationFailureRows.length} failed`);
    // ---------------------------------------------------------------------------
    // Phase 2: Deduplication (if multiple chunks)
    // ---------------------------------------------------------------------------
    let dedupResult;
    let finalLocalized;
    if (chunks.length <= 1) {
        // Single chunk — no dedup needed, use localized results directly
        finalLocalized = allLocalized;
        emit(input.onLog, 'deduplication', 'Single chunk — skipping deduplication');
    }
    else {
        emit(input.onLog, 'deduplication', 'Running Agent 4 deduplication across all chunks');
        const overlapZones = (0, page_windows_1.getOverlapZones)(chunks);
        const dedupInput = {
            run_id: rendered.run_id,
            chunks: dedupChunkInputs,
            overlap_zones: overlapZones,
        };
        const deduplicator = deps.deduplicator ?? ((dedupIn, promptSnapshot) => (0, gemini_deduplicator_1.deduplicateTargets)(dedupIn, promptSnapshot, { apiKey: input.config.GEMINI_API_KEY }));
        try {
            dedupResult = await (0, run_orchestrator_1.runDeduplicationStep)(dedupInput, rendered.promptSnapshot.deduplicatorPrompt, deduplicator);
        }
        catch (err) {
            const message = formatUnknownError(err);
            emit(input.onLog, 'deduplication', `Agent 4 failed: ${message}`);
            throw {
                code: errorCode(err, 'DEDUPLICATION_FAILED'),
                message,
            };
        }
        emit(input.onLog, 'deduplication', `Dedup: ${dedupResult.targets.length} target(s) from ${allLocalized.length} pre-dedup`);
        // Convert deduplicated targets into LocalizationResult format for crop/compose
        finalLocalized = dedupResult.targets.map((dt) => ({
            run_id: rendered.run_id,
            target_id: dt.target_id,
            regions: dt.regions,
        }));
    }
    // ---------------------------------------------------------------------------
    // Phase 3: Build summary from final target list
    // ---------------------------------------------------------------------------
    // Build a synthetic SegmentationResult from the final targets for summary
    const finalSegmentation = {
        run_id: rendered.run_id,
        targets: finalLocalized.map((loc) => {
            const dedupTarget = dedupResult?.targets.find((t) => t.target_id === loc.target_id);
            return {
                target_id: loc.target_id,
                target_type: dedupTarget?.target_type ?? 'question',
                question_number: dedupTarget?.question_number,
                question_text: dedupTarget?.question_text,
                sub_questions: dedupTarget?.sub_questions,
                extraction_fields: dedupTarget?.extraction_fields,
            };
        }),
    };
    let summary = (0, summary_1.buildRunSummaryFromSegmentation)(finalSegmentation, extractionFields, finalLocalized);
    for (const result of finalLocalized) {
        summary = (0, summary_1.applyLocalizationToSummary)(summary, result);
    }
    // ---------------------------------------------------------------------------
    // Phase 4: Crop → Compose → Upload (unchanged)
    // ---------------------------------------------------------------------------
    const cropExecutor = deps.cropExecutor ?? (0, image_processing_1.makeCanvasCropExecutor)(input.config.OUTPUT_DIR);
    emit(input.onLog, 'crop', 'Cropping target regions');
    const cropResults = await (0, run_orchestrator_1.runCropStep)(rendered.run_id, finalLocalized, rendered.preparedPages, cropExecutor);
    emit(input.onLog, 'crop', `Crop step produced ${cropResults.length} target result(s)`);
    const imageStacker = deps.imageStacker ?? (0, image_processing_1.makeCanvasImageStacker)(input.config.OUTPUT_DIR, rendered.run_id);
    emit(input.onLog, 'composition', 'Composing final output images');
    const composedRows = await (0, run_orchestrator_1.runCompositionStep)(rendered.run_id, cropResults, finalLocalized, rendered.activeProfile, imageStacker);
    emit(input.onLog, 'composition', `Composition produced ${composedRows.length} result row(s)`);
    emit(input.onLog, 'upload', 'Uploading outputs to Google Drive');
    const finalRows = await (0, run_orchestrator_1.runUploadStep)(rendered.run_id, composedRows, input.config.DRIVE_FOLDER_ID, input.config.OAUTH_TOKEN_PATH, deps.driveUploader ?? google_drive_1.uploadToDrive);
    emit(input.onLog, 'upload', 'Drive upload step finished');
    const finalRowMap = new Map([...finalRows, ...localizationFailureRows].map((row) => [row.target_id, row]));
    const orderedFinalRows = finalSegmentation.targets
        .map((target) => finalRowMap.get(target.target_id))
        .filter((row) => row !== undefined);
    summary = (0, summary_1.applyFinalResultsToSummary)(summary, orderedFinalRows);
    const debugData = {
        agent1ChunkResults,
        reviewChunkResults,
        localizationResults: allLocalized,
        localizationFailures: localizationFailureRows.map((row) => ({
            targetId: row.target_id,
            sourcePages: row.source_pages,
            failureCode: row.status === 'failed' ? row.failure_code : 'UNKNOWN',
            failureMessage: row.status === 'failed' ? row.failure_message : '',
        })),
        deduplicationResult: dedupResult,
        deduplicationMergeLog: dedupResult?.merge_log,
    };
    summary = { ...summary, debugData };
    emit(input.onLog, 'summary', 'Summary ready');
    return summary;
}
//# sourceMappingURL=full-pipeline-runner.js.map