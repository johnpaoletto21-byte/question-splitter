"use strict";
/**
 * adapters/run-pipeline/full-pipeline-runner.ts
 *
 * Adapter-layer glue for the full local PDF-to-Drive pipeline.
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
    const segmenter = deps.segmenter ?? ((runId, pages, profile, promptSnapshot, options) => (0, gemini_segmenter_1.segmentPages)(runId, pages, profile, promptSnapshot, { apiKey: input.config.GEMINI_API_KEY }, undefined, undefined, options));
    emit(input.onLog, 'segmentation', 'Running Agent 1 segmentation in page windows');
    const segmentationWindows = (0, page_windows_1.buildSegmentationPageWindows)(rendered.preparedPages);
    const windowResults = [];
    for (const window of segmentationWindows) {
        const allowedRegionPageNumbers = (0, page_windows_1.getAllowedSegmentationRegionPageNumbers)(window.focusPageNumber);
        emit(input.onLog, 'segmentation', `Agent 1 focus page ${window.focusPageNumber} with pages ` +
            `${window.pages.map((page) => page.page_number).join(', ')}; ` +
            `allowed output region pages ${allowedRegionPageNumbers.join(', ')}`);
        try {
            windowResults.push(await (0, run_orchestrator_1.runSegmentationStep)(rendered.run_id, window.pages, rendered.activeProfile, rendered.promptSnapshot.agent1Prompt, segmenter, {
                focusPageNumber: window.focusPageNumber,
                allowedRegionPageNumbers,
                extractionFields,
            }));
        }
        catch (err) {
            const message = formatUnknownError(err);
            const segmentationWindow = {
                focusPageNumber: window.focusPageNumber,
                pageNumbers: window.pages.map((page) => page.page_number),
                allowedRegionPageNumbers,
            };
            emit(input.onLog, 'segmentation', `Agent 1 failed for focus page ${window.focusPageNumber}; ` +
                `allowed output region pages ${allowedRegionPageNumbers.join(', ')}; ${message}`);
            throw {
                code: errorCode(err, 'SEGMENTATION_FAILED'),
                message,
                segmentationWindow,
            };
        }
    }
    const segmentation = (0, page_windows_1.mergeWindowedSegmentationResults)(rendered.run_id, windowResults);
    emit(input.onLog, 'segmentation', `Agent 1 found ${segmentation.targets.length} target(s)`);
    const reviewer = deps.reviewer ?? ((runId, segResult, allPages, profile, promptSnapshot, opts) => (0, gemini_reviewer_1.reviewSegmentation)(runId, segResult, allPages, profile, promptSnapshot, { apiKey: input.config.GEMINI_API_KEY }, undefined, undefined, opts));
    emit(input.onLog, 'review', 'Running Agent 1.5 segmentation review');
    const reviewedSegmentation = await (0, run_orchestrator_1.runReviewStep)(rendered.run_id, segmentation, rendered.preparedPages, rendered.activeProfile, rendered.promptSnapshot.reviewerPrompt, reviewer, { extractionFields });
    const wasCorrected = reviewedSegmentation !== segmentation;
    emit(input.onLog, 'review', wasCorrected
        ? `Agent 1.5 corrected: ${reviewedSegmentation.targets.length} target(s) (Agent 1 had ${segmentation.targets.length})`
        : `Agent 1.5: pass (${segmentation.targets.length} target(s) confirmed)`);
    let summary = (0, summary_1.buildRunSummaryFromSegmentation)(reviewedSegmentation, extractionFields);
    const localizer = deps.localizer ?? ((runId, target, pages, profile, promptSnapshot) => (0, gemini_localizer_1.localizeTarget)(runId, target, pages, profile, promptSnapshot, { apiKey: input.config.GEMINI_API_KEY }));
    emit(input.onLog, 'localization', 'Running Agent 2 localization');
    const localized = [];
    const localizationFailureRows = [];
    for (const target of reviewedSegmentation.targets) {
        try {
            const result = await localizer(rendered.run_id, target, (0, page_windows_1.selectLocalizationContextPages)(target, rendered.preparedPages), rendered.activeProfile, rendered.promptSnapshot.agent2Prompt);
            localized.push(result);
            emit(input.onLog, 'localization', `Localized ${target.target_id}`);
        }
        catch (err) {
            const message = formatUnknownError(err);
            emit(input.onLog, 'localization', `Localization failed for ${target.target_id}: ${message}`);
            localizationFailureRows.push({
                target_id: target.target_id,
                source_pages: target.regions.map((r) => r.page_number),
                output_file_name: '',
                status: 'failed',
                failure_code: errorCode(err, 'LOCALIZATION_FAILED'),
                failure_message: message,
            });
        }
    }
    for (const result of localized) {
        summary = (0, summary_1.applyLocalizationToSummary)(summary, result);
    }
    emit(input.onLog, 'localization', `Localized ${localized.length} target(s); ${localizationFailureRows.length} failed`);
    const cropExecutor = deps.cropExecutor ?? (0, image_processing_1.makeCanvasCropExecutor)(input.config.OUTPUT_DIR);
    emit(input.onLog, 'crop', 'Cropping target regions');
    const cropResults = await (0, run_orchestrator_1.runCropStep)(rendered.run_id, localized, rendered.preparedPages, cropExecutor);
    emit(input.onLog, 'crop', `Crop step produced ${cropResults.length} target result(s)`);
    const imageStacker = deps.imageStacker ?? (0, image_processing_1.makeCanvasImageStacker)(input.config.OUTPUT_DIR, rendered.run_id);
    emit(input.onLog, 'composition', 'Composing final output images');
    const composedRows = await (0, run_orchestrator_1.runCompositionStep)(rendered.run_id, cropResults, localized, rendered.activeProfile, imageStacker);
    emit(input.onLog, 'composition', `Composition produced ${composedRows.length} result row(s)`);
    emit(input.onLog, 'upload', 'Uploading outputs to Google Drive');
    const finalRows = await (0, run_orchestrator_1.runUploadStep)(rendered.run_id, composedRows, input.config.DRIVE_FOLDER_ID, input.config.OAUTH_TOKEN_PATH, deps.driveUploader ?? google_drive_1.uploadToDrive);
    emit(input.onLog, 'upload', 'Drive upload step finished');
    const finalRowMap = new Map([...finalRows, ...localizationFailureRows].map((row) => [row.target_id, row]));
    const orderedFinalRows = reviewedSegmentation.targets
        .map((target) => finalRowMap.get(target.target_id))
        .filter((row) => row !== undefined);
    summary = (0, summary_1.applyFinalResultsToSummary)(summary, orderedFinalRows);
    emit(input.onLog, 'summary', 'Summary ready');
    return summary;
}
//# sourceMappingURL=full-pipeline-runner.js.map