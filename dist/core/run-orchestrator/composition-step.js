"use strict";
/**
 * core/run-orchestrator/composition-step.ts
 *
 * Orchestrator step that composes crop outputs into final result rows.
 *
 * Design (mirrors crop-step.ts pattern):
 *   - Image I/O is injected via ImageStackerFn (keeps core I/O-free, INV-9).
 *   - Emits exactly one FinalResultRow per CropStepTargetResult (INV-5).
 *   - Targets that failed the crop step are forwarded as failed rows without
 *     attempting composition (INV-8 continuation).
 *   - Targets where composeOutput throws CompositionError are emitted as
 *     failed rows; remaining targets continue (INV-8).
 *   - review_comment never enters FinalResultRow (INV-4).
 *   - source_pages are derived from localizedTargets (Agent 2 region order).
 *
 * TASK-401 adds this module.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCompositionStep = runCompositionStep;
const composer_1 = require("../output-composer/composer");
const types_1 = require("../output-composer/types");
/**
 * Runs the composition step for all crop results.
 *
 * For each CropStepTargetResult:
 *  - `status: 'failed'` → emit a failed FinalResultRow (INV-8 continuation).
 *  - `status: 'ok'`     → build ComposerInput, call composeOutput, emit ok row.
 *     If composeOutput throws CompositionError, emit failed row and continue (INV-8).
 *
 * @param runId             Current run_id (for traceability).
 * @param cropResults       Ordered CropStepTargetResult[] from runCropStep.
 * @param localizedTargets  LocalizationResult[] used to derive source_pages.
 * @param profile           Active CropTargetProfile (composition_mode read here).
 * @param imageStacker      Injected function for two-region pixel stacking.
 * @returns                 FinalResultRow[] — one per crop result, same order.
 */
async function runCompositionStep(runId, cropResults, localizedTargets, profile, imageStacker) {
    // Build a lookup: targetId -> sourcePages (from localization region order).
    const sourcePagesMap = new Map(localizedTargets.map((lt) => [
        lt.target_id,
        lt.regions.map((r) => r.page_number),
    ]));
    const results = [];
    for (const cropResult of cropResults) {
        const { targetId } = cropResult;
        const sourcePages = sourcePagesMap.get(targetId) ?? [];
        if (cropResult.status === 'failed') {
            // Crop step already failed this target — forward as failed row (INV-8).
            results.push({
                target_id: targetId,
                source_pages: sourcePages,
                output_file_name: '',
                status: 'failed',
                failure_code: cropResult.code,
                failure_message: cropResult.message,
            });
            continue;
        }
        // Map ok crop regions to ComposerRegion shape.
        const composerRegions = cropResult.regions.map((r) => ({
            page_number: r.page_number,
            cropFilePath: r.cropFilePath,
        }));
        try {
            const composed = await (0, composer_1.composeOutput)({
                targetId,
                sourcePages,
                regions: composerRegions,
                compositionMode: profile.composition_mode,
            }, imageStacker);
            results.push({
                target_id: composed.targetId,
                source_pages: composed.sourcePages,
                output_file_name: composed.outputFileName,
                status: 'ok',
                local_output_path: composed.localOutputPath,
            });
        }
        catch (err) {
            if (err instanceof types_1.CompositionError) {
                // Per INV-8: composition failure for one target must not kill the run.
                results.push({
                    target_id: targetId,
                    source_pages: sourcePages,
                    output_file_name: '',
                    status: 'failed',
                    failure_code: err.code,
                    failure_message: err.message,
                });
            }
            else {
                // Unexpected error — re-throw so the outer run handler can decide.
                throw err;
            }
        }
    }
    return results;
}
//# sourceMappingURL=composition-step.js.map