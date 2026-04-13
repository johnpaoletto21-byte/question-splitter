/**
 * core/run-orchestrator/segmentation-step.ts
 *
 * Orchestrator step that invokes Agent 1 segmentation and returns
 * the normalized SegmentationResult.
 *
 * The actual segmenter is injected as a `Segmenter` function so that
 * core stays free of provider SDK imports (INV-9 / PO-8).
 */

import type { PreparedPageImage } from '../source-model/types';
import type { CropTargetProfile } from '../crop-target-profile/types';
import type { SegmentationResult } from '../segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../extraction-fields';

export interface SegmentationCallOptions {
  extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
  chunkStartPage?: number;
  chunkEndPage?: number;
}

/**
 * Contract for a segmenter function.
 * Implemented in `adapters/segmentation/gemini-segmenter`.
 */
export type Segmenter = (
  runId: string,
  pages: PreparedPageImage[],
  profile: CropTargetProfile,
  promptSnapshot: string,
  options?: SegmentationCallOptions,
) => Promise<SegmentationResult>;

/**
 * Runs the Agent 1 segmentation step.
 */
export async function runSegmentationStep(
  runId: string,
  pages: PreparedPageImage[],
  profile: CropTargetProfile,
  promptSnapshot: string,
  segmenter: Segmenter,
  options: SegmentationCallOptions = {},
): Promise<SegmentationResult> {
  const result = await segmenter(runId, pages, profile, promptSnapshot, options);
  return result;
}
