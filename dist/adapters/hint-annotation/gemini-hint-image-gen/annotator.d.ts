/**
 * adapters/hint-annotation/gemini-hint-image-gen/annotator.ts
 *
 * Gemini adapter for hint annotation via image generation.
 * Sends a source PNG + prompt to Gemini and receives an annotated image back.
 *
 * Used by Method 1 (pure image generation) and Method 3 step 2 (blend render).
 * The model accepts a reference image and returns a modified version with
 * annotations drawn on top.
 */
import type { GeminiHintImageGenConfig, HttpPostFn, HintImageGenResult } from './types';
export declare const DEFAULT_HINT_IMAGE_GEN_MODEL = "gemini-3-pro-image-preview";
export declare function encodeImageAsBase64(imagePath: string): string;
export declare function buildGeminiHintImageGenRequest(promptText: string, imagePath: string, encodeFn?: (path: string) => string): Record<string, unknown>;
export interface GeminiImagePart {
    mimeType: string;
    data: Buffer;
}
export declare function unwrapGeminiImageResponse(raw: unknown): GeminiImagePart;
/**
 * Calls Gemini to generate an annotated version of a source image.
 *
 * @param sourceImagePath  Absolute path to the source PNG.
 * @param promptText       Final prompt text (with hint already appended by caller).
 * @param config           Gemini API key and optional model name.
 * @param outputPath       Where to write the generated image.
 * @param httpPost         Injectable HTTP client.
 * @param encodeFn         Injectable image encoder.
 */
export declare function generateHintImage(sourceImagePath: string, promptText: string, config: GeminiHintImageGenConfig, outputPath: string, httpPost?: HttpPostFn, encodeFn?: (path: string) => string): Promise<HintImageGenResult>;
//# sourceMappingURL=annotator.d.ts.map