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
import type { PreparedPageImage } from '../source-model/types';
import type { LocalizationResult } from '../localization-contract/types';
import type { CropEngineTargetResult, CropRegionPixels, PixelRect } from '../crop-engine/types';
export type { CropEngineTargetResult, CropRegionPixels, PixelRect };
/**
 * Contract for a function that executes the actual image crop for one region.
 *
 * Implemented outside `core/**` (e.g. in `adapters/` or a future image-crop
 * adapter). Injected here so core/crop-engine stays I/O-free.
 *
 * @param runId       The current run_id (for traceability).
 * @param targetId    The target this region belongs to.
 * @param page        The PreparedPageImage that contains the region.
 * @param pixelRect   Validated, converted pixel rectangle to crop.
 * @returns           Absolute path to the cropped image file on disk.
 */
export type CropExecutor = (runId: string, targetId: string, page: PreparedPageImage, pixelRect: PixelRect) => Promise<string>;
/**
 * Outcome of `runCropStep` for a single target when crop execution also runs.
 * Extends `CropEngineTargetResult` with the output file paths from the executor.
 */
export type CropStepTargetResult = {
    status: 'ok';
    targetId: string;
    regions: Array<CropRegionPixels & {
        cropFilePath: string;
    }>;
} | {
    status: 'failed';
    targetId: string;
    code: 'BBOX_INVALID';
    message: string;
};
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
export declare function runCropStep(runId: string, localizedTargets: LocalizationResult[], pages: PreparedPageImage[], cropExecutor: CropExecutor): Promise<CropStepTargetResult[]>;
//# sourceMappingURL=crop-step.d.ts.map