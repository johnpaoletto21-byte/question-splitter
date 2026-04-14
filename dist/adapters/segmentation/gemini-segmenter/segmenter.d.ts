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
 *      SegmentationResult (question inventory — no regions).
 *
 * No repair loops — relies on Gemini structured output mode for valid JSON.
 */
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import type { GeminiSegmenterConfig, HttpPostFn } from './types';
export declare const DEFAULT_GEMINI_SEGMENTER_MODEL = "gemini-3.1-flash-lite-preview";
/**
 * Reads a prepared page image from disk and returns a base64-encoded string.
 */
export declare function encodePageImageAsBase64(imagePath: string): string;
/**
 * Builds the Gemini generateContent request body.
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
 * Returns a question inventory (no regions — localization is separate).
 */
export declare function segmentPages(runId: string, pages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, config: GeminiSegmenterConfig, httpPost?: HttpPostFn, encodeFn?: (path: string) => string, options?: {
    extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
    chunkStartPage?: number;
    chunkEndPage?: number;
}): Promise<SegmentationResult>;
//# sourceMappingURL=segmenter.d.ts.map