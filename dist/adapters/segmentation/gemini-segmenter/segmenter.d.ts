/**
 * adapters/segmentation/gemini-segmenter/segmenter.ts
 *
 * Main Gemini segmentation adapter — the public entry point for Agent 1.
 *
 * Responsibilities:
 *   1. Read and base64-encode prepared page images (local files).
 *   2. Build the prompt text.
 *   3. Call the Gemini generateContent REST endpoint with structured output.
 *   4. Parse the raw JSON response via parser.ts into a normalized
 *      SegmentationResult (no raw Gemini objects escape this boundary).
 *
 * The HttpPostFn is injectable so tests can mock the network call without
 * importing any provider SDK into core (INV-9 / PO-8).
 *
 * Provider-specific details (endpoint format, request/response envelope,
 * base64 encoding, schema field) are all contained here.
 */
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import type { GeminiSegmenterConfig, HttpPostFn } from './types';
export declare const DEFAULT_GEMINI_SEGMENTER_MODEL = "gemini-3.1-flash-lite-preview";
/**
 * Reads a prepared page image from disk and returns a base64-encoded string.
 * This keeps the encoding logic isolated and testable.
 */
export declare function encodePageImageAsBase64(imagePath: string): string;
/**
 * Builds the Gemini generateContent request body.
 *
 * Uses multimodal content parts: text prompt first, then one inlineData
 * image part per page in order.
 */
export declare function buildGeminiRequest(promptText: string, pages: PreparedPageImage[], encodeFn?: (path: string) => string, responseSchema?: Record<string, unknown>): Record<string, unknown>;
/**
 * Extracts the text content from a Gemini generateContent response envelope.
 * The structured JSON output is embedded as a string in:
 *   response.candidates[0].content.parts[0].text
 */
export declare function unwrapGeminiResponse(raw: unknown): unknown;
/**
 * Segments a set of prepared page images using the Gemini API.
 *
 * This is the function that implements the `Segmenter` type in the orchestrator.
 * It is the only place where Gemini API specifics (endpoint, auth header,
 * request format) are known — none of that leaks into core.
 *
 * @param runId          The current run_id (added to the normalized result).
 * @param pages          Prepared page images to include in this segmentation call.
 * @param profile        Active crop target profile (target_type, max regions).
 * @param promptSnapshot Session prompt override (empty string = use built-in prompt).
 * @param config         Gemini API key and optional model name.
 * @param httpPost       Injectable HTTP client (defaults to native fetch).
 * @param encodeFn       Injectable image encoder (defaults to readFileSync+base64).
 * @returns              Normalized SegmentationResult with targets in reading order.
 */
export declare function segmentPages(runId: string, pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, config: GeminiSegmenterConfig, httpPost?: HttpPostFn, encodeFn?: (path: string) => string, options?: {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
    focusPageNumber?: number;
    allowedRegionPageNumbers?: ReadonlyArray<number>;
    maxRepairRetries?: number;
}): Promise<SegmentationResult>;
//# sourceMappingURL=segmenter.d.ts.map