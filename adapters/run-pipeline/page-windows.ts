import type { PreparedPageImage } from '../../core/source-model/types';
import type { SegmentationResult } from '../../core/segmentation-contract/types';
import type { SegmentationTarget } from '../../core/segmentation-contract/types';

export interface SegmentationPageWindow {
  focusPageNumber: number;
  pages: PreparedPageImage[];
}

function byPageNumber(a: PreparedPageImage, b: PreparedPageImage): number {
  return a.page_number - b.page_number;
}

function makeTargetId(index: number): string {
  return `q_${String(index + 1).padStart(4, '0')}`;
}

export function buildSegmentationPageWindows(
  pages: ReadonlyArray<PreparedPageImage>,
): SegmentationPageWindow[] {
  const sorted = [...pages].sort(byPageNumber);

  return sorted.map((focusPage, index) => ({
    focusPageNumber: focusPage.page_number,
    pages: [
      ...(index > 0 ? [sorted[index - 1]] : []),
      focusPage,
      ...(index < sorted.length - 1 ? [sorted[index + 1]] : []),
    ],
  }));
}

export function selectLocalizationContextPages(
  target: SegmentationTarget,
  pages: ReadonlyArray<PreparedPageImage>,
): PreparedPageImage[] {
  const sorted = [...pages].sort(byPageNumber);
  const wanted = new Set(target.regions.map((region) => region.page_number));
  return sorted.filter((page) => wanted.has(page.page_number));
}

export function getAllowedSegmentationRegionPageNumbers(
  focusPageNumber: number,
): number[] {
  return focusPageNumber === 1
    ? [1]
    : [focusPageNumber - 1, focusPageNumber];
}

export function mergeWindowedSegmentationResults(
  runId: string,
  results: ReadonlyArray<SegmentationResult>,
): SegmentationResult {
  const targets: SegmentationTarget[] = [];

  for (const result of results) {
    for (const target of result.targets) {
      targets.push({
        ...target,
        target_id: makeTargetId(targets.length),
      });
    }
  }

  return { run_id: runId, targets };
}
