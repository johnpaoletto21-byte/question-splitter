"use strict";
/**
 * core/run-orchestrator/crop-step.ts
 *
 * Orchestrator step that validates and converts bbox coordinates for each
 * localized target, then invokes a CropExecutor for the actual image crop.
 *
 * Design (mirrors localization-step.ts pattern):
 *   - Pure bbox validation and conversion are performed by `core/crop-engine`
 *     (validateBbox + bboxToPixelRect) before any crop I/O is attempted.
 *   - The actual image-cropping I/O is injected as a `CropExecutor` function,
 *     keeping core free of canvas/image library specifics (INV-9 / PO-8).
 *   - Targets are processed in the order Agent 2 produced them (reading order).
 *   - BBOX_INVALID failures are caught per-target so other targets continue
 *     processing (INV-8 / PO-7).
 *   - The caller receives one CropEngineTargetResult per localized target.
 *
 * TASK-302 adds this module.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCropStep = runCropStep;
const index_1 = require("../crop-engine/index");
/**
 * Runs the crop-engine validation+conversion step for all localized targets.
 *
 * For each target:
 *   1. Iterates over its regions (in Agent 2 order).
 *   2. Finds the matching PreparedPageImage by page_number.
 *   3. Validates the region's bbox_1000 with `validateBbox` (BBOX_INVALID guard).
 *   4. Converts to pixel coordinates with `bboxToPixelRect`.
 *   5. Calls the injected `cropExecutor` for the actual image crop.
 *   6. If validation fails for any region, marks the entire target as `failed`
 *      with code `BBOX_INVALID` and continues to the next target (INV-8).
 *
 * @param runId               The current run_id (from RunContext).
 * @param localizedTargets    Ordered LocalizationResult[] from the localization step.
 * @param pages               All PreparedPageImages for the run (INV-1 gate enforced upstream).
 * @param cropExecutor        Injected function that writes the cropped image file.
 * @returns                   CropStepTargetResult[] — one entry per localized target,
 *                            in the same order as `localizedTargets`.
 */
async function runCropStep(runId, localizedTargets, pages, cropExecutor) {
    const results = [];
    for (const localized of localizedTargets) {
        const { target_id: targetId, regions } = localized;
        try {
            const cropRegions = [];
            for (const region of regions) {
                const { page_number, bbox_1000 } = region;
                // Validate bbox at crop time (TASK-302 acceptance bar).
                // BboxInvalidError is thrown here if the bbox is out-of-range or inverted.
                (0, index_1.validateBbox)(bbox_1000, targetId);
                // Find the PreparedPageImage for this region's page.
                const page = pages.find((p) => p.page_number === page_number);
                if (!page) {
                    // Missing page: surface as a BBOX_INVALID-category error to the same
                    // failure path so the target is skipped without killing the run.
                    throw new index_1.BboxInvalidError(targetId, bbox_1000, `no PreparedPageImage found for page_number ${page_number}`);
                }
                // Convert normalized bbox to pixel coordinates using rendered dimensions.
                const pixelRect = (0, index_1.bboxToPixelRect)(bbox_1000, page.image_width, page.image_height);
                // Execute the actual image crop via the injected adapter.
                const cropFilePath = await cropExecutor(runId, targetId, page, pixelRect);
                cropRegions.push({ page_number, pixelRect, cropFilePath });
            }
            results.push({ status: 'ok', targetId, regions: cropRegions });
        }
        catch (err) {
            if (err instanceof index_1.BboxInvalidError) {
                // Per INV-8: one target failure must not abort remaining targets.
                results.push({
                    status: 'failed',
                    targetId,
                    code: 'BBOX_INVALID',
                    message: err.message,
                });
            }
            else {
                // Unexpected error — re-throw so the orchestrator's outer handler
                // can decide whether to abort the run.
                throw err;
            }
        }
    }
    return results;
}
//# sourceMappingURL=crop-step.js.map