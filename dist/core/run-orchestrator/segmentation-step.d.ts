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
import type { PreparedPageImage } from '../source-model/types';
import type { CropTargetProfile } from '../crop-target-profile/types';
import type { SegmentationResult } from '../segmentation-contract/types';
/**
 * Contract for a segmenter function.
 * Implemented in `adapters/segmentation/gemini-segmenter`.
 * Kept here so core can type-check the dependency without importing any SDK.
 *
 * @param runId          Run identifier to embed in the result.
 * @param pages          Ordered prepared page images to segment.
 * @param profile        Active crop target profile.
 * @param promptSnapshot Session-scoped prompt override (empty = built-in).
 */
export type Segmenter = (runId: string, pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string) => Promise<SegmentationResult>;
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
export declare function runSegmentationStep(runId: string, pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, segmenter: Segmenter): Promise<SegmentationResult>;
//# sourceMappingURL=segmentation-step.d.ts.map