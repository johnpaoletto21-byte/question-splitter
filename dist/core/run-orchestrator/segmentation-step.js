"use strict";
/**
 * core/run-orchestrator/segmentation-step.ts
 *
 * Orchestrator step that invokes Agent 1 segmentation and returns
 * the normalized SegmentationResult.
 *
 * The actual segmenter is injected as a `Segmenter` function so that
 * core stays free of provider SDK imports (INV-9 / PO-8).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSegmentationStep = runSegmentationStep;
/**
 * Runs the Agent 1 segmentation step.
 */
async function runSegmentationStep(runId, pages, profile, promptSnapshot, segmenter, options = {}) {
    const result = await segmenter(runId, pages, profile, promptSnapshot, options);
    return result;
}
//# sourceMappingURL=segmentation-step.js.map