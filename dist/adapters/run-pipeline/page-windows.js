"use strict";
/**
 * adapters/run-pipeline/page-windows.ts
 *
 * Chunked page windowing for multi-page document processing.
 *
 * Replaces the old 3-page sliding window approach with configurable
 * 10-page overlapping chunks that give agents much more context.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildChunkedPageWindows = buildChunkedPageWindows;
exports.getOverlapZones = getOverlapZones;
exports.buildLocalizationWindows = buildLocalizationWindows;
// ---------------------------------------------------------------------------
// Chunk building
// ---------------------------------------------------------------------------
function byPageNumber(a, b) {
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
function buildChunkedPageWindows(pages, chunkSize = 10, overlap = 3) {
    const sorted = [...pages].sort(byPageNumber);
    if (sorted.length === 0)
        return [];
    const stride = chunkSize - overlap;
    const chunks = [];
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
        if (remaining > 0 && remaining <= overlap)
            break;
        chunkIndex++;
        startIdx += stride;
        // If the next chunk would start past the end, stop
        if (startIdx >= sorted.length)
            break;
    }
    return chunks;
}
/**
 * Computes the overlap zones between consecutive chunks.
 * Each zone describes which pages are shared between two adjacent chunks.
 */
function getOverlapZones(chunks) {
    const zones = [];
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
function buildLocalizationWindows(pages, windowSize = 3) {
    const sorted = [...pages].sort(byPageNumber);
    if (sorted.length === 0)
        return [];
    // For short documents, single window with all pages
    if (sorted.length <= windowSize) {
        return [{ windowIndex: 0, pages: sorted }];
    }
    const windows = [];
    for (let i = 0; i <= sorted.length - windowSize; i++) {
        windows.push({
            windowIndex: i,
            pages: sorted.slice(i, i + windowSize),
        });
    }
    return windows;
}
//# sourceMappingURL=page-windows.js.map