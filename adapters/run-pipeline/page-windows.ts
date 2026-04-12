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

function getPageSet(target: SegmentationTarget): Set<number> {
  return new Set(target.regions.map((r) => r.page_number));
}

function isStrictSubset(a: Set<number>, b: Set<number>): boolean {
  if (a.size >= b.size) return false;
  for (const page of a) {
    if (!b.has(page)) return false;
  }
  return true;
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
  const collected: SegmentationTarget[] = [];

  for (const result of results) {
    for (const target of result.targets) {
      collected.push(target);
    }
  }

  // Remove ghost targets: if target A's pages are a strict subset of target B's
  // pages, A is likely a truncated duplicate produced by a window that couldn't
  // see the full page span. Keep the wider target, discard the subset.
  const pageSets = collected.map(getPageSet);
  const deduped = collected.filter((_, i) => {
    for (let j = 0; j < collected.length; j++) {
      if (i !== j && isStrictSubset(pageSets[i], pageSets[j])) {
        return false;
      }
    }
    return true;
  });

  // Reassign sequential target_ids after dedup.
  const targets = deduped.map((target, index) => ({
    ...target,
    target_id: makeTargetId(index),
  }));

  return { run_id: runId, targets };
}
