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
const gemini_localizer_1 = require("../localization/gemini-localizer");
const google_drive_1 = require("../upload/google-drive");
const image_processing_1 = require("../image-processing");
const run_orchestrator_1 = require("../../core/run-orchestrator");
const summary_1 = require("../../core/run-summary/summary");
function emit(onLog, stage, message) {
    onLog?.({ stage, message, timestamp: new Date().toISOString() });
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
    });
    emit(input.onLog, 'bootstrap', `Run ID: ${context.run_id}`);
    emit(input.onLog, 'render', 'Rendering PDF pages');
    const rendered = await (0, run_orchestrator_1.renderAllSources)(context, deps.renderer ?? pdf_renderer_1.renderPdfSource);
    emit(input.onLog, 'render', `Rendered ${rendered.preparedPages.length} page image(s)`);
    const segmenter = deps.segmenter ?? ((runId, pages, profile, promptSnapshot) => (0, gemini_segmenter_1.segmentPages)(runId, pages, profile, promptSnapshot, { apiKey: input.config.GEMINI_API_KEY }));
    emit(input.onLog, 'segmentation', 'Running Agent 1 segmentation');
    const segmentation = await (0, run_orchestrator_1.runSegmentationStep)(rendered.run_id, rendered.preparedPages, rendered.activeProfile, rendered.promptSnapshot.agent1Prompt, segmenter);
    emit(input.onLog, 'segmentation', `Agent 1 found ${segmentation.targets.length} target(s)`);
    let summary = (0, summary_1.buildRunSummaryFromSegmentation)(segmentation);
    const localizer = deps.localizer ?? ((runId, target, pages, profile, promptSnapshot) => (0, gemini_localizer_1.localizeTarget)(runId, target, pages, profile, promptSnapshot, { apiKey: input.config.GEMINI_API_KEY }));
    emit(input.onLog, 'localization', 'Running Agent 2 localization');
    const localized = await (0, run_orchestrator_1.runLocalizationStep)(rendered.run_id, segmentation, rendered.preparedPages, rendered.activeProfile, rendered.promptSnapshot.agent2Prompt, localizer);
    for (const result of localized) {
        summary = (0, summary_1.applyLocalizationToSummary)(summary, result);
    }
    emit(input.onLog, 'localization', `Localized ${localized.length} target(s)`);
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
    summary = (0, summary_1.applyFinalResultsToSummary)(summary, finalRows);
    emit(input.onLog, 'summary', 'Summary ready');
    return summary;
}
//# sourceMappingURL=full-pipeline-runner.js.map