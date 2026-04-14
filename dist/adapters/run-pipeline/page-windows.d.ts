/**
 * adapters/run-pipeline/page-windows.ts
 *
 * Chunked page windowing for multi-page document processing.
 *
 * Replaces the old 3-page sliding window approach with configurable
 * 10-page overlapping chunks that give agents much more context.
 */
import type { PreparedPageImage } from '../../core/source-model/types';
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
/**
 * Builds overlapping page chunks for segmentation.
 *
 * @param pages     All prepared page images (will be sorted by page_number).
 * @param chunkSize Number of pages per chunk (default 10).
 * @param overlap   Number of overlapping pages between consecutive chunks (default 3).
 * @returns         Array of ChunkWindow objects.
 */
export declare function buildChunkedPageWindows(pages: ReadonlyArray<PreparedPageImage>, chunkSize?: number, overlap?: number): ChunkWindow[];
/**
 * Computes the overlap zones between consecutive chunks.
 * Each zone describes which pages are shared between two adjacent chunks.
 */
export declare function getOverlapZones(chunks: ReadonlyArray<ChunkWindow>): OverlapZone[];
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
export declare function buildLocalizationWindows(pages: ReadonlyArray<PreparedPageImage>, windowSize?: number): LocalizationWindow[];
//# sourceMappingURL=page-windows.d.ts.map