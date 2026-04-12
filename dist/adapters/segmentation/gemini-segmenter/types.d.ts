/**
 * adapters/segmentation/gemini-segmenter/types.ts
 *
 * Adapter-internal types for the Gemini segmentation adapter.
 *
 * All provider-specific shapes live here and must NOT cross the adapter boundary.
 * The adapter translates these into the normalized SegmentationResult before
 * returning anything to the orchestrator (INV-9 / PO-8).
 */
/** Configuration required to call the Gemini generateContent REST endpoint. */
export interface GeminiSegmenterConfig {
    /** Gemini API key (from LocalConfig.GEMINI_API_KEY). */
    apiKey: string;
    /**
     * Gemini model name.
     * Defaults to 'gemini-3.1-flash-lite-preview' if not provided.
     */
    model?: string;
}
/**
 * A single region as Gemini returns it in structured output.
 * Only page_number — no bbox (that is Agent 2 scope).
 */
export interface GeminiRawRegion {
    page_number: number;
}
/**
 * A single target as Gemini returns it.
 * Note: target_id is NOT in this shape — the parser assigns sequential IDs
 * based on reading order after the response arrives.
 */
export interface GeminiRawTarget {
    target_type: string;
    regions: GeminiRawRegion[];
    review_comment?: string;
}
/** Top-level shape of the Gemini structured JSON output. */
export interface GeminiRawSegmentationOutput {
    targets: GeminiRawTarget[];
}
/**
 * Minimal HTTP POST abstraction.
 *
 * The default implementation uses native fetch (Node.js 18+).
 * Tests inject a mock to avoid real network calls.
 */
export type HttpPostFn = (url: string, body: unknown, headers: Record<string, string>) => Promise<unknown>;
//# sourceMappingURL=types.d.ts.map