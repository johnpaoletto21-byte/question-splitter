"use strict";
/**
 * core/run-orchestrator/segmentation-step.ts
 *
 * Orchestrator step that invokes Agent 1 segmentation and returns
 * the normalized SegmentationResult.
 *
 * Design (mirrors render-step.ts pattern):
 *   - The actual segmenter is injected as a `Segmenter` function so that
 *     core stays free of provider SDK imports (INV-9 / PO-8).
 *   - `adapters/segmentation/gemini-segmenter` implements the Segmenter type.
 *   - Target order from the normalized result is preserved exactly.
 *
 * TASK-502 will wire promptSnapshot from the prompt-config-store.
 * For TASK-201 the caller passes an empty string to use the adapter's
 * built-in prompt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSegmentationStep = runSegmentationStep;
/**
 * Runs the Agent 1 segmentation step.
 *
 * Calls the injected segmenter with the run's prepared pages and active
 * profile. Returns the normalized SegmentationResult with targets in
 * reading order — the orchestrator must preserve that order downstream.
 *
 * @param runId          The current run_id (from RunContext).
 * @param pages          Prepared pages from the render step (INV-1 gate
 *                       must have run before this is called).
 * @param profile        The active crop target profile.
 * @param promptSnapshot Session prompt override (TASK-502 will populate this).
 * @param segmenter      The adapter function that performs the actual call.
 * @returns              Normalized SegmentationResult; target order is authoritative.
 * @throws               Re-throws any error from the segmenter.
 */
async function runSegmentationStep(runId, pages, profile, promptSnapshot, segmenter) {
    const result = await segmenter(runId, pages, profile, promptSnapshot);
    // Target order from the normalized result is authoritative — no re-sorting.
    return result;
}
//# sourceMappingURL=segmentation-step.js.map