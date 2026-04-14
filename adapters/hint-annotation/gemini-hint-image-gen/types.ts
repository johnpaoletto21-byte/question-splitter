/**
 * adapters/hint-annotation/gemini-hint-image-gen/types.ts
 *
 * Type contracts for the Gemini image-generation hint annotator adapter.
 */

export interface GeminiHintImageGenConfig {
  apiKey: string;
  model?: string;
}

export type HttpPostFn = (
  url: string,
  body: unknown,
  headers: Record<string, string>,
) => Promise<unknown>;

export interface HintImageGenResult {
  /** Absolute path to the generated annotated PNG on disk. */
  outputPath: string;
  /** MIME type of the generated image (e.g. 'image/png'). */
  mimeType: string;
  /** Model used for generation. */
  model: string;
}
