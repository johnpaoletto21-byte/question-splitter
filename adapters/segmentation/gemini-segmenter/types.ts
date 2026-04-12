/**
 * adapters/segmentation/gemini-segmenter/types.ts
 *
 * Adapter-internal types for the Gemini segmentation adapter.
 *
 * All provider-specific shapes live here and must NOT cross the adapter boundary.
 * The adapter translates these into the normalized SegmentationResult before
 * returning anything to the orchestrator (INV-9 / PO-8).
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Raw Gemini structured output shapes (adapter-internal only)
// ---------------------------------------------------------------------------

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
  finish_page_number?: number;
  regions: GeminiRawRegion[];
  extraction_fields?: Record<string, unknown>;
  review_comment?: string;
}

/**
 * A page classification as Gemini returns it in structured output.
 * Used as a safety net to detect phantom targets on non-content pages.
 */
export interface GeminiRawPageClassification {
  page_number: number;
  classification: string;
}

/** Top-level shape of the Gemini structured JSON output. */
export interface GeminiRawSegmentationOutput {
  targets: GeminiRawTarget[];
  page_classifications?: GeminiRawPageClassification[];
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
