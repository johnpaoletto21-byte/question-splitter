/**
 * core/segmentation-contract/types.ts
 *
 * Normalized Agent 1 output contract — the shape that all segmentation
 * adapters must produce and all orchestrator steps must consume.
 *
 * Design constraints (from Layer B):
 *   - INV-2: Agent 1 defines targets only (no bbox_1000 — that is Agent 2 scope).
 *   - INV-3: max regions per target is profile-driven (default 10 for chunked processing).
 *   - INV-4: review_comment stays in agent outputs and summary; not in final result rows.
 *   - INV-9: No provider SDK types here — this is core, adapter-clean.
 */

/**
 * A single page reference within a segmentation target.
 *
 * Contains only page identity — no crop coordinates.
 * bbox_1000 is explicitly forbidden here (INV-2 / PO-2).
 */
export interface SegmentationRegion {
  /** 1-based page number (matches PreparedPageImage.page_number). */
  page_number: number;
}

/**
 * One identified question target produced by Agent 1.
 *
 * - target_id: stable, ordered identifier assigned by the adapter parser
 *   (format: q_0001, q_0002, …) so reading order is encoded in the ID.
 * - target_type: matches the active profile's target_type (e.g. 'question').
 * - finish_page_number: page where the target's final visible content ends.
 * - regions: ordered list of page references (count limited by profile max_regions_per_target).
 * - extraction_fields: run-scoped custom boolean values from Agent 1.
 * - review_comment: optional agent note when the result is uncertain.
 *   MUST NOT appear in final result rows (INV-4).
 */
export interface SegmentationTarget {
  target_id: string;
  target_type: string;
  finish_page_number?: number;
  regions: SegmentationRegion[];
  extraction_fields?: Record<string, boolean>;
  review_comment?: string;
  /** The question number as shown in the document (e.g. "1", "2(a)", "問3"). */
  question_number?: string;
  /** First ~200 chars of the question body text, with diagram notes inline e.g. "[diagram on the right]". */
  question_text?: string;
  /** Sub-question labels e.g. ["(1)", "(2)", "(3)"]. */
  sub_questions?: string[];
}

/**
 * The complete normalized segmentation result for one run.
 *
 * targets are in reading order — the order returned by the adapter parser
 * is authoritative; orchestrator must preserve it exactly.
 */
export interface SegmentationResult {
  run_id: string;
  targets: SegmentationTarget[];
}

/**
 * Error thrown when a raw value fails segmentation schema validation.
 */
export interface SegmentationValidationError {
  code: 'SEGMENTATION_SCHEMA_INVALID';
  message: string;
  details?: string;
}
