/**
 * adapters/localization/gemini-localizer/types.ts
 *
 * Adapter-internal types for the Gemini localization adapter.
 *
 * Agent 3 now uses a sliding window approach: it receives 1-3 page images
 * and identifies which questions from the known list appear in them,
 * returning bounding boxes for each.
 */
/** Configuration required to call the Gemini generateContent REST endpoint. */
export interface GeminiLocalizerConfig {
    /** Gemini API key (from LocalConfig.GEMINI_API_KEY). */
    apiKey: string;
    /**
     * Gemini model name.
     * Defaults to 'gemini-3.1-flash-lite-preview' if not provided.
     */
    model?: string;
}
/**
 * A single target entry as Gemini returns it for a window localization call.
 * Agent 3 identifies which question appears on which image and provides bbox.
 */
export interface GeminiRawWindowTarget {
    /** The question_number from the known question list (e.g. "1", "問3"). */
    question_number: string;
    /** Which image in the window (1, 2, or 3). */
    image_position: number;
    /** Normalized bounding box [y_min, x_min, y_max, x_max] on 0-1000 scale. */
    bbox_1000: number[];
}
/**
 * Top-level shape of the Gemini structured JSON output for a window localization call.
 */
export interface GeminiRawWindowLocalizationOutput {
    targets: GeminiRawWindowTarget[];
    review_comment?: string;
}
/**
 * Minimal HTTP POST abstraction.
 *
 * The default implementation uses native fetch (Node.js 18+).
 * Tests inject a mock to avoid real network calls.
 */
export type HttpPostFn = (url: string, body: unknown, headers: Record<string, string>) => Promise<unknown>;
//# sourceMappingURL=types.d.ts.map