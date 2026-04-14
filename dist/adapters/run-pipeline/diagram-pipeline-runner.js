"use strict";
/**
 * adapters/run-pipeline/diagram-pipeline-runner.ts
 *
 * Adapter-layer glue for the diagram-only cropper.
 *
 * Flow:
 *   Read source PNG dimensions
 *     → Detect diagrams (Agent D, single Gemini call)
 *     → For each bbox: validate, convert to pixels, crop to file
 *     → Render sanity-overlay PNG with red rectangles around each crop
 *
 * No PDF rendering, no segmentation, no deduplication, no stacking.
 * Mirrors the dependency-injection style of full-pipeline-runner.ts so tests
 * can swap in fakes without network or canvas calls.
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
exports.runDiagramPipeline = runDiagramPipeline;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const gemini_diagram_detector_1 = require("../diagram-detection/gemini-diagram-detector");
const image_processing_1 = require("../image-processing");
const diagram_detection_1 = require("../../core/diagram-detection");
const default_prompts_1 = require("../../core/prompt-config-store/default-prompts");
function emit(onLog, stage, message) {
    onLog?.({ stage, message, timestamp: new Date().toISOString() });
}
/**
 * Runs the diagram-only pipeline end-to-end and returns the result summary.
 */
async function runDiagramPipeline(input, deps = {}) {
    fs.mkdirSync(input.outputDir, { recursive: true });
    if (!fs.existsSync(input.sourceImagePath)) {
        throw new Error(`Source image not found at ${input.sourceImagePath}`);
    }
    const promptText = input.promptOverride?.trim()
        ? input.promptOverride
        : default_prompts_1.DEFAULT_DIAGRAM_DETECTOR_PROMPT;
    emit(input.onLog, 'dimensions', 'Reading source image dimensions');
    const dimensionsFn = deps.imageDimensions ?? image_processing_1.getImageDimensions;
    const { width: sourceWidth, height: sourceHeight } = await dimensionsFn(input.sourceImagePath);
    emit(input.onLog, 'dimensions', `Source image: ${sourceWidth} × ${sourceHeight} px`);
    emit(input.onLog, 'detect', 'Calling Gemini diagram detector (Agent D)');
    const detector = deps.detector ?? defaultDetector;
    const detection = await detector(input.sourceImagePath, promptText, {
        apiKey: input.config.GEMINI_API_KEY,
    });
    emit(input.onLog, 'detect', `Detector returned ${detection.diagrams.length} diagram(s)`);
    emit(input.onLog, 'crop', 'Cropping individual diagrams');
    const cropper = deps.cropper ?? image_processing_1.cropImageToFile;
    const overlayRenderer = deps.overlayRenderer ?? image_processing_1.drawDiagramOverlayToFile;
    const result = await (0, diagram_detection_1.cropDiagrams)({
        detection,
        sourceWidth,
        sourceHeight,
        outputDir: input.outputDir,
    }, cropper, overlayRenderer);
    const okCount = result.diagrams.filter((d) => d.status === 'ok').length;
    const failCount = result.diagrams.length - okCount;
    emit(input.onLog, 'crop', `Wrote ${okCount} diagram crop(s)${failCount > 0 ? `, ${failCount} failed` : ''}`);
    emit(input.onLog, 'overlay', `Sanity overlay written to ${path.relative(input.outputDir, result.overlay_image_path)}`);
    return result;
}
const defaultDetector = (sourceImagePath, promptText, config) => (0, gemini_diagram_detector_1.detectDiagrams)(sourceImagePath, promptText, config);
//# sourceMappingURL=diagram-pipeline-runner.js.map