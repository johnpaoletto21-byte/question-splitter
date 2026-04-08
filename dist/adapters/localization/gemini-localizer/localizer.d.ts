/**
 * adapters/localization/gemini-localizer/localizer.ts
 *
 * Main Gemini localization adapter — the public entry point for Agent 2.
 *
 * Responsibilities:
 *   1. Filter prepared pages to only those relevant to the target.
 *   2. Read and base64-encode the relevant page images (local files).
 *   3. Build the localization prompt text.
 *   4. Call the Gemini generateContent REST endpoint with structured output.
 *   5. Parse the raw JSON response via parser.ts into a normalized
 *      LocalizationResult (no raw Gemini objects escape this boundary).
 *
 * The HttpPostFn is injectable so tests can mock the network call without
 * importing any provider SDK into core (INV-9 / PO-8).
 *
 * This adapter processes ONE target per call. The orchestrator's localization
 * step calls it once per SegmentationTarget in the reading order produced by
 * Agent 1 — Agent 2 never drives target order.
 */
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationTarget } from '../../../core/segmentation-contract/types';
import type { LocalizationResult } from '../../../core/localization-contract/types';
import type { GeminiLocalizerConfig, HttpPostFn } from './types';
/**
 * Reads a prepared page image from disk and returns a base64-encoded string.
 * Kept isolated and testable (same pattern as the segmentation adapter).
 */
export declare function encodePageImageAsBase64(imagePath: string): string;
/**
 * Builds the Gemini generateContent request body for one localization target.
 *
 * Sends: text prompt + one inlineData image part per relevant page (in region order).
 */
export declare function buildGeminiLocalizationRequest(promptText: string, relevantPages: PreparedPageImage[], encodeFn?: (path: string) => string): Record<string, unknown>;
/**
 * Extracts the text content from a Gemini generateContent response envelope.
 * The structured JSON output is embedded as a string in:
 *   response.candidates[0].content.parts[0].text
 */
export declare function unwrapGeminiLocalizationResponse(raw: unknown): unknown;
/**
 * Filters the full prepared-pages list to only the pages relevant to this target.
 * Pages are returned in the order the target's regions specify (reading order).
 *
 * If a required page is not found in the prepared list, an error is thrown
 * so the orchestrator can handle the missing-page failure cleanly.
 */
export declare function selectPagesForTarget(target: SegmentationTarget, allPages: PreparedPageImage[]): PreparedPageImage[];
/**
 * Localizes a single segmentation target using the Gemini API.
 *
 * This is the function that implements the `Localizer` type in the orchestrator.
 * It is the only place where Gemini API specifics (endpoint, auth header,
 * request format) are known for Agent 2 — none of that leaks into core.
 *
 * @param runId          The current run_id (added to the normalized result).
 * @param target         The Agent 1 SegmentationTarget to localize.
 * @param allPages       All prepared pages for the run (filtered internally to relevant pages).
 * @param profile        Active crop target profile (target_type, max regions).
 * @param promptSnapshot Session prompt override (empty string = use built-in prompt).
 * @param config         Gemini API key and optional model name.
 * @param httpPost       Injectable HTTP client (defaults to native fetch).
 * @param encodeFn       Injectable image encoder (defaults to readFileSync+base64).
 * @returns              Normalized LocalizationResult for this target.
 */
export declare function localizeTarget(runId: string, target: SegmentationTarget, allPages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, config: GeminiLocalizerConfig, httpPost?: HttpPostFn, encodeFn?: (path: string) => string): Promise<LocalizationResult>;
//# sourceMappingURL=localizer.d.ts.map