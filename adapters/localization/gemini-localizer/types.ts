/**
 * adapters/localization/gemini-localizer/types.ts
 *
 * Adapter-internal types for the Gemini localization adapter.
 *
 * All provider-specific shapes live here and must NOT cross the adapter boundary.
 * The adapter translates these into the normalized LocalizationResult before
 * returning anything to the orchestrator (INV-9 / PO-8).
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Configuration required to call the Gemini generateContent REST endpoint. */
export interface GeminiLocalizerConfig {
  /** Gemini API key (from LocalConfig.GEMINI_API_KEY). */
  apiKey: string;

  /**
   * Gemini model name.
   * Defaults to 'gemini-2.0-flash' if not provided.
   */
  model?: string;
}

// ---------------------------------------------------------------------------
// Raw Gemini structured output shapes (adapter-internal only)
// ---------------------------------------------------------------------------

/**
 * A single region as Gemini returns it for a localization call.
 * Contains page_number (which we cross-validate against Agent 1 output)
 * and the bbox_1000 bounding box.
 */
export interface GeminiRawLocalizationRegion {
  page_number: number;
  bbox_1000: number[];
}

/**
 * Top-level shape of the Gemini structured JSON output for one localization target.
 * Note: target_id is NOT in this shape — the parser carries it from the
 * incoming SegmentationTarget (Agent 2 must not invent or change target identity).
 */
export interface GeminiRawLocalizationOutput {
  regions: GeminiRawLocalizationRegion[];
  review_comment?: string;
}

// ---------------------------------------------------------------------------
// HTTP client abstraction for testability
// ---------------------------------------------------------------------------

/**
 * Minimal HTTP POST abstraction.
 *
 * The default implementation uses native fetch (Node.js 18+).
 * Tests inject a mock to avoid real network calls.
 */
export type HttpPostFn = (
  url: string,
  body: unknown,
  headers: Record<string, string>,
) => Promise<unknown>;
