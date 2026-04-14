/**
 * adapters/diagram-detection/gemini-diagram-detector/types.ts
 *
 * Adapter-internal types for the Gemini diagram detector (Agent D).
 * Mirrors the shape used by the existing Agent 3 localizer adapter.
 */
/** Configuration required to call the Gemini generateContent REST endpoint. */
export interface GeminiDiagramDetectorConfig {
    /** Gemini API key (from LocalConfig.GEMINI_API_KEY). */
    apiKey: string;
    /**
     * Gemini model name.
     * Defaults to 'gemini-3.1-flash-lite-preview' if not provided.
     */
    model?: string;
}
/**
 * Raw single-diagram entry as Gemini returns it.
 * Strict validation happens in the parser.
 */
export interface GeminiRawDiagram {
    diagram_index: number;
    bbox_1000: number[];
    label?: string;
}
/** Top-level shape of the Gemini structured JSON output for diagram detection. */
export interface GeminiRawDiagramDetectionOutput {
    diagrams: GeminiRawDiagram[];
}
/**
 * Minimal HTTP POST abstraction (matches the convention used by Agent 1/3 adapters).
 * Tests inject a mock to avoid real network calls.
 */
export type HttpPostFn = (url: string, body: unknown, headers: Record<string, string>) => Promise<unknown>;
//# sourceMappingURL=types.d.ts.map