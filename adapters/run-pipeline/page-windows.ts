/**
 * adapters/run-pipeline/page-windows.ts
 *
 * Chunked page windowing for multi-page document processing.
 *
 * Replaces the old 3-page sliding window approach with configurable
 * 10-page overlapping chunks that give agents much more context.
 */

import type { PreparedPageImage } from '../../core/source-model/types';
import type { SegmentationTarget } from '../../core/segmentation-contract/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChunkWindow {
  /** Zero-based chunk index. */
  chunkIndex: number;
  /** Pages included in this chunk (sorted by page_number). */
  pages: PreparedPageImage[];
  /** First page number in this chunk (1-based). */
  startPage: number;
  /** Last page number in this chunk (1-based). */
  endPage: number;
}

export interface OverlapZone {
  chunkAIndex: number;
  chunkBIndex: number;
  overlapPages: number[];
}

// ---------------------------------------------------------------------------
// Chunk building
// ---------------------------------------------------------------------------

function byPageNumber(a: PreparedPageImage, b: PreparedPageImage): number {
  return a.page_number - b.page_number;
}

/**
 * Builds overlapping page chunks for segmentation.
 *
 * @param pages     All prepared page images (will be sorted by page_number).
 * @param chunkSize Number of pages per chunk (default 10).
 * @param overlap   Number of overlapping pages between consecutive chunks (default 3).
 * @returns         Array of ChunkWindow objects.
 */
export function buildChunkedPageWindows(
  pages: ReadonlyArray<PreparedPageImage>,
  chunkSize: number = 10,
  overlap: number = 3,
): ChunkWindow[] {
  const sorted = [...pages].sort(byPageNumber);
  if (sorted.length === 0) return [];

  const stride = chunkSize - overlap;
  const chunks: ChunkWindow[] = [];
  let startIdx = 0;
  let chunkIndex = 0;

  while (startIdx < sorted.length) {
    const endIdx = Math.min(startIdx + chunkSize, sorted.length);
    const chunkPages = sorted.slice(startIdx, endIdx);

    chunks.push({
      chunkIndex,
      pages: chunkPages,
      startPage: chunkPages[0].page_number,
      endPage: chunkPages[chunkPages.length - 1].page_number,
    });

    chunkIndex++;
    startIdx += stride;

    // If the next chunk would start past the end, stop
    if (startIdx >= sorted.length) break;
  }

  return chunks;
}

/**
 * Computes the overlap zones between consecutive chunks.
 * Each zone describes which pages are shared between two adjacent chunks.
 */
export function getOverlapZones(chunks: ReadonlyArray<ChunkWindow>): OverlapZone[] {
  const zones: OverlapZone[] = [];

  for (let i = 0; i < chunks.length - 1; i++) {
    const a = chunks[i];
    const b = chunks[i + 1];
    const aPages = new Set(a.pages.map((p) => p.page_number));
    const overlapPages = b.pages
      .map((p) => p.page_number)
      .filter((pn) => aPages.has(pn))
      .sort((x, y) => x - y);

    if (overlapPages.length > 0) {
      zones.push({
        chunkAIndex: a.chunkIndex,
        chunkBIndex: b.chunkIndex,
        overlapPages,
      });
    }
  }

  return zones;
}

// ---------------------------------------------------------------------------
// Localization page selection (kept from old code, still needed per-target)
// ---------------------------------------------------------------------------

/**
 * Filters the prepared-pages list to only pages referenced by the target's regions.
 * Used by the localizer to determine which page images to send for a single target.
 */
export function selectLocalizationContextPages(
  target: SegmentationTarget,
  pages: ReadonlyArray<PreparedPageImage>,
): PreparedPageImage[] {
  const sorted = [...pages].sort(byPageNumber);
  const wanted = new Set(target.regions.map((region) => region.page_number));
  return sorted.filter((page) => wanted.has(page.page_number));
}
