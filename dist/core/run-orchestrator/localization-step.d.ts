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
 * TASK-502 (complete): promptSnapshot is captured by bootstrapRun from
 * core/prompt-config-store and passed here by the caller. The snapshot is
 * immutable — mid-run UI edits do not drift into an active run (INV-7).
 */
import type { PreparedPageImage } from '../source-model/types';
import type { CropTargetProfile } from '../crop-target-profile/types';
import type { SegmentationResult } from '../segmentation-contract/types';
import type { SegmentationTarget } from '../segmentation-contract/types';
import type { LocalizationResult } from '../localization-contract/types';
/**
 * Contract for a localizer function.
 * Implemented in `adapters/localization/gemini-localizer`.
 * Kept here so core can type-check the dependency without importing any SDK.
 *
 * @param runId          Run identifier to embed in the result.
 * @param target         The Agent 1 SegmentationTarget to localize.
 * @param pages          All prepared page images for the run (adapter filters internally).
 * @param profile        Active crop target profile.
 * @param promptSnapshot Session-scoped prompt override (empty = built-in).
 */
export type Localizer = (runId: string, target: SegmentationTarget, pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string) => Promise<LocalizationResult>;
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
 * @param promptSnapshot     Session prompt override (TASK-502: wired from context.promptSnapshot).
 * @param localizer          The adapter function that performs the actual API call.
 * @returns                  Ordered LocalizationResult[] — one per target, same order
 *                           as SegmentationResult.targets.
 * @throws                   Re-throws any error from the localizer (caller handles
 *                           per-target failure continuation if needed).
 */
export declare function runLocalizationStep(runId: string, segmentationResult: SegmentationResult, pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, localizer: Localizer): Promise<LocalizationResult[]>;
//# sourceMappingURL=localization-step.d.ts.map