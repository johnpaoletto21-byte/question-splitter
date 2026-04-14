/**
 * core/run-orchestrator/localization-step.ts
 *
 * Orchestrator step that runs sliding window localization (Agent 3)
 * and assembles the per-window results into per-target LocalizationResults.
 *
 * Design:
 *   - The actual localizer is injected as a `WindowLocalizer` function so that
 *     core stays free of provider SDK imports (INV-9 / PO-8).
 *   - Windows are built by the caller and passed in.
 *   - Assembly groups regions by question_number, matches to segmentation targets,
 *     deduplicates overlapping pages, and produces LocalizationResult[].
 */
import type { PreparedPageImage } from '../source-model/types';
import type { CropTargetProfile } from '../crop-target-profile/types';
import type { SegmentationTarget } from '../segmentation-contract/types';
import type { LocalizationResult } from '../localization-contract/types';
/**
 * Intermediate result from a single window localization call.
 * Matches the shape produced by the adapter parser.
 */
export interface WindowLocalizationRegion {
    question_number: string;
    page_number: number;
    bbox_1000: [number, number, number, number];
}
export interface WindowLocalizationResult {
    run_id: string;
    regions: WindowLocalizationRegion[];
    review_comment?: string;
}
/**
 * Contract for a window localizer function.
 * Implemented in `adapters/localization/gemini-localizer`.
 */
export type WindowLocalizer = (runId: string, questionList: ReadonlyArray<SegmentationTarget>, windowPages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string) => Promise<WindowLocalizationResult>;
/**
 * Assembles per-window results into per-target LocalizationResults.
 *
 * For each question in the segmentation targets:
 *   1. Collect all regions across all windows that match by question_number.
 *   2. Deduplicate by page_number — when the same page appears in multiple
 *      windows, keep the bbox from the window where the page was most central
 *      (farthest from the window edge).
 *   3. Sort regions by page_number ascending.
 *   4. Build LocalizationResult with target_id from the matched SegmentationTarget.
 *
 * @param runId           The current run_id.
 * @param questionList    The segmentation targets (question inventory).
 * @param windowResults   Results from all window localization calls.
 * @param windows         The windows that were used (for centrality scoring).
 * @returns               LocalizationResult[] — one per target that was found.
 *                        Targets not found in any window are omitted.
 */
export declare function assembleLocalizationResults(runId: string, questionList: ReadonlyArray<SegmentationTarget>, windowResults: ReadonlyArray<WindowLocalizationResult>, windows: ReadonlyArray<{
    pages: ReadonlyArray<PreparedPageImage>;
}>): LocalizationResult[];
/**
 * Expands a bbox by `pad` units on each side (clamped to [0, 1000]).
 * Acts as a safety net for minor edge clipping by the model.
 */
export declare function padBbox(bbox: [number, number, number, number], pad?: number): [number, number, number, number];
//# sourceMappingURL=localization-step.d.ts.map