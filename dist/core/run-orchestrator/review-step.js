"use strict";
/**
 * core/run-orchestrator/review-step.ts
 *
 * Orchestrator step that invokes Agent 1.5 segmentation review and returns
 * either a corrected SegmentationResult or the original (if the reviewer
 * determined Agent 1's output was correct).
 *
 * Design (mirrors segmentation-step.ts pattern):
 *   - The actual reviewer is injected as a `SegmentationReviewer` function so
 *     that core stays free of provider SDK imports (INV-9 / PO-8).
 *   - `adapters/segmentation-review/gemini-reviewer` implements the type.
 *   - The reviewer sees all pages (no windowing) and the merged Agent 1 result.
 *   - Returns null for "pass" (Agent 1 output correct), or a corrected
 *     SegmentationResult. The orchestrator step converts null → original.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runReviewStep = runReviewStep;
/**
 * Runs the Agent 1.5 segmentation review step.
 *
 * Calls the injected reviewer with the merged Agent 1 result and all prepared
 * pages. If the reviewer returns null ("pass"), the original segmentation is
 * returned unchanged. Otherwise the corrected result replaces it.
 */
async function runReviewStep(runId, segmentationResult, pages, profile, promptSnapshot, reviewer, options = {}) {
    const hasOptions = options.extractionFields !== undefined;
    const result = hasOptions
        ? await reviewer(runId, segmentationResult, pages, profile, promptSnapshot, options)
        : await reviewer(runId, segmentationResult, pages, profile, promptSnapshot);
    return result ?? segmentationResult;
}
//# sourceMappingURL=review-step.js.map