"use strict";
/**
 * core/run-orchestrator/localization-step.ts
 *
 * Orchestrator step that invokes Agent 2 localization for each target and
 * returns the ordered array of normalized LocalizationResults.
 *
 * Design (mirrors segmentation-step.ts pattern):
 *   - The actual localizer is injected as a `Localizer` function so that
 *     core stays free of provider SDK imports (INV-9 / PO-8).
 *   - `adapters/localization/gemini-localizer` implements the Localizer type.
 *   - Targets are processed in the order Agent 1 produced them (reading order).
 *     Agent 2 never drives target order — it only localizes what Agent 1 found.
 *   - LocalizationResult[] preserves the same index order as
 *     SegmentationResult.targets so downstream steps can zip them safely.
 *
 * TASK-502 will wire promptSnapshot from the prompt-config-store.
 * For TASK-301 the caller passes an empty string to use the adapter's
 * built-in prompt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLocalizationStep = runLocalizationStep;
/**
 * Runs the Agent 2 localization step for all targets in the segmentation result.
 *
 * Calls the injected localizer once per target, in the reading order from
 * Agent 1. Returns results in the same order so downstream steps can rely on
 * index alignment between SegmentationResult.targets and LocalizationResult[].
 *
 * Agent 2 cannot add, remove, or reorder targets — those decisions were made
 * by Agent 1. Any attempt to drift is rejected by the parser/contract layer.
 *
 * @param runId              The current run_id (from RunContext).
 * @param segmentationResult The normalized Agent 1 result (source of target order).
 * @param pages              Prepared pages from the render step (INV-1 gate must
 *                           have run before this is called).
 * @param profile            The active crop target profile.
 * @param promptSnapshot     Session prompt override (TASK-502 will populate this).
 * @param localizer          The adapter function that performs the actual API call.
 * @returns                  Ordered LocalizationResult[] — one per target, same order
 *                           as SegmentationResult.targets.
 * @throws                   Re-throws any error from the localizer (caller handles
 *                           per-target failure continuation if needed).
 */
async function runLocalizationStep(runId, segmentationResult, pages, profile, promptSnapshot, localizer) {
    const results = [];
    for (const target of segmentationResult.targets) {
        // Process targets sequentially in reading order.
        // Target order from segmentation is authoritative — no sorting applied.
        const result = await localizer(runId, target, pages, profile, promptSnapshot);
        results.push(result);
    }
    return results;
}
//# sourceMappingURL=localization-step.js.map