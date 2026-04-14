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
export type WindowLocalizer = (
  runId: string,
  questionList: ReadonlyArray<SegmentationTarget>,
  windowPages: PreparedPageImage[],
  profile: CropTargetProfile,
  promptSnapshot: string,
) => Promise<WindowLocalizationResult>;

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
export function assembleLocalizationResults(
  runId: string,
  questionList: ReadonlyArray<SegmentationTarget>,
  windowResults: ReadonlyArray<WindowLocalizationResult>,
  windows: ReadonlyArray<{ pages: ReadonlyArray<PreparedPageImage> }>,
  excludePages?: ReadonlySet<number>,
): LocalizationResult[] {
  // Build a map: for each (question_number, page_number), collect all bbox entries
  // with a centrality score (how far from the edge of the window the page was).
  const regionMap = new Map<string, Map<number, { bbox: [number, number, number, number]; centrality: number }>>();

  for (let wi = 0; wi < windowResults.length; wi++) {
    const wr = windowResults[wi];
    const windowPages = windows[wi]?.pages ?? [];
    const windowSize = windowPages.length;

    for (const region of wr.regions) {
      // Skip regions on excluded pages (e.g. answer sheets)
      if (excludePages?.has(region.page_number)) continue;

      // Centrality: how far from the edge. For a 3-page window:
      // page at position 0 (first) → centrality 0
      // page at position 1 (middle) → centrality 1
      // page at position 2 (last) → centrality 0
      const pageIndex = windowPages.findIndex((p) => p.page_number === region.page_number);
      const distFromEdge = Math.min(pageIndex, windowSize - 1 - pageIndex);

      if (!regionMap.has(region.question_number)) {
        regionMap.set(region.question_number, new Map());
      }
      const pageMap = regionMap.get(region.question_number)!;

      const existing = pageMap.get(region.page_number);
      if (!existing || distFromEdge > existing.centrality) {
        pageMap.set(region.page_number, {
          bbox: region.bbox_1000,
          centrality: distFromEdge,
        });
      }
    }
  }

  // Build LocalizationResult for each target
  const results: LocalizationResult[] = [];

  for (const target of questionList) {
    const qn = target.question_number;
    if (!qn) continue;

    const pageMap = regionMap.get(qn);
    if (!pageMap || pageMap.size === 0) continue;

    const regions = [...pageMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([pageNumber, { bbox }]) => ({
        page_number: pageNumber,
        bbox_1000: padBbox(bbox),
      }));

    results.push({
      run_id: runId,
      target_id: target.target_id,
      regions,
    });
  }

  return results;
}

/**
 * Expands a bbox by `pad` units on each side (clamped to [0, 1000]).
 * Acts as a safety net for minor edge clipping by the model.
 */
export function padBbox(
  bbox: [number, number, number, number],
  pad: number = 30,
): [number, number, number, number] {
  return [
    Math.max(0, bbox[0] - pad),
    Math.max(0, bbox[1] - pad),
    Math.min(1000, bbox[2] + pad),
    Math.min(1000, bbox[3] + pad),
  ];
}
