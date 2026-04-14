/**
 * adapters/localization/gemini-localizer/localizer.ts
 *
 * Main Gemini localization adapter — the public entry point for Agent 3.
 *
 * Processes ONE sliding window (1-3 images) per call. Agent 3 identifies
 * which questions from the known list appear in the window and returns
 * bounding boxes. The localizer keeps repair retries (up to 2x) because
 * bbox values have semantic constraints that the schema can't enforce.
 */
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationTarget } from '../../../core/segmentation-contract/types';
import type { WindowLocalizationResult } from './window-result';
import type { GeminiLocalizerConfig, HttpPostFn } from './types';
export declare const DEFAULT_GEMINI_LOCALIZER_MODEL = "gemini-3.1-flash-lite-preview";
export declare function encodePageImageAsBase64(imagePath: string): string;
export declare function buildGeminiLocalizationRequest(promptText: string, windowPages: PreparedPageImage[], encodeFn?: (path: string) => string, responseSchema?: Record<string, unknown>): Record<string, unknown>;
export declare function unwrapGeminiLocalizationResponse(raw: unknown): unknown;
/**
 * Localizes questions in a sliding window of 1-3 page images.
 *
 * @param runId          The current run_id.
 * @param questionList   Known questions from Agent 1 (question inventory).
 * @param windowPages    The 1-3 PreparedPageImage objects for this window.
 * @param profile        Active crop target profile.
 * @param promptSnapshot Session prompt override (empty = built-in).
 * @param config         Gemini API key and optional model name.
 * @param httpPost       Injectable HTTP client (defaults to native fetch).
 * @param encodeFn       Injectable image encoder (defaults to readFileSync+base64).
 * @returns              WindowLocalizationResult with regions found in this window.
 */
export declare function localizeWindow(runId: string, questionList: ReadonlyArray<SegmentationTarget>, windowPages: PreparedPageImage[], profile: CropTargetProfile, promptSnapshot: string, config: GeminiLocalizerConfig, httpPost?: HttpPostFn, encodeFn?: (path: string) => string): Promise<WindowLocalizationResult>;
//# sourceMappingURL=localizer.d.ts.map