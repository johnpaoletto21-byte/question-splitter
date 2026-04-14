/**
 * adapters/hint-annotation/gemini-hint-overlay/annotator.ts
 *
 * Gemini adapter that returns structured annotation instructions as JSON.
 * Used by Method 2 (JSON + Canvas overlay) and Method 3 step 1 (blend).
 *
 * The model analyzes the diagram and the teacher's hint, then returns
 * drawing instructions (lines, arrows, arcs, text) in bbox_1000 coordinates.
 */
import type { GeminiHintOverlayConfig, HttpPostFn, HintOverlayResult } from './types';
export declare const DEFAULT_HINT_OVERLAY_MODEL = "gemini-2.5-flash-preview";
export declare function encodeImageAsBase64(imagePath: string): string;
export declare function buildGeminiHintOverlayRequest(promptText: string, imagePath: string, encodeFn?: (path: string) => string, responseSchema?: Record<string, unknown>): Record<string, unknown>;
export declare function unwrapGeminiOverlayResponse(raw: unknown): unknown;
/**
 * Calls Gemini to get structured annotation instructions for a diagram.
 *
 * @param sourceImagePath  Absolute path to the source PNG.
 * @param promptText       Final prompt text (with hint already appended by caller).
 * @param config           Gemini API key and optional model name.
 * @param httpPost         Injectable HTTP client.
 * @param encodeFn         Injectable image encoder.
 */
export declare function getHintAnnotations(sourceImagePath: string, promptText: string, config: GeminiHintOverlayConfig, httpPost?: HttpPostFn, encodeFn?: (path: string) => string): Promise<HintOverlayResult>;
//# sourceMappingURL=annotator.d.ts.map