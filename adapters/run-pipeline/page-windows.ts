/**
 * adapters/run-pipeline/page-windows.ts
 *
 * Chunked page windowing for multi-page document processing.
 *
 * Replaces the old 3-page sliding window approach with configurable
 * 10-page overlapping chunks that give agents much more context.
 */

import type { PreparedPageImage } from '../../core/source-model/types';

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
    let chunkPages = sorted.slice(startIdx, endIdx);

    // If the remaining pages beyond this chunk are ≤ overlap, absorb them
    // into this chunk instead of creating a tiny next chunk with mostly
    // overlapping content.  E.g. 12 pages with chunkSize=10, overlap=3:
    // without this, chunk 0 = pages 1-10, chunk 1 = pages 8-12 (3 overlap).
    // With this, chunk 0 = pages 1-12 (single chunk, no dedup needed).
    const remaining = sorted.length - endIdx;
    if (remaining > 0 && remaining <= overlap) {
      chunkPages = sorted.slice(startIdx);
    }

    chunks.push({
      chunkIndex,
      pages: chunkPages,
      startPage: chunkPages[0].page_number,
      endPage: chunkPages[chunkPages.length - 1].page_number,
    });

    // If we absorbed remaining pages, we're done
    if (remaining > 0 && remaining <= overlap) break;

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
// Localization sliding windows
// ---------------------------------------------------------------------------

export interface LocalizationWindow {
  /** Zero-based window index. */
  windowIndex: number;
  /** Pages in this window (sorted by page_number, up to windowSize). */
  pages: PreparedPageImage[];
}

/**
 * Builds overlapping sliding windows for localization.
 *
 * Creates windows of `windowSize` consecutive pages with a stride of 1,
 * so each window overlaps with the next by (windowSize - 1) pages.
 *
 * Examples (windowSize=3):
 *   4 pages → [1,2,3], [2,3,4]
 *   6 pages → [1,2,3], [2,3,4], [3,4,5], [4,5,6]
 *   2 pages → [1,2] (single window, fewer than windowSize)
 *
 * @param pages      All prepared page images (will be sorted by page_number).
 * @param windowSize Number of pages per window (default 3).
 * @returns          Array of LocalizationWindow objects.
 */
export function buildLocalizationWindows(
  pages: ReadonlyArray<PreparedPageImage>,
  windowSize: number = 3,
): LocalizationWindow[] {
  const sorted = [...pages].sort(byPageNumber);
  if (sorted.length === 0) return [];

  // For short documents, single window with all pages
  if (sorted.length <= windowSize) {
    return [{ windowIndex: 0, pages: sorted }];
  }

  const windows: LocalizationWindow[] = [];
  for (let i = 0; i <= sorted.length - windowSize; i++) {
    windows.push({
      windowIndex: i,
      pages: sorted.slice(i, i + windowSize),
    });
  }
  return windows;
}
