/**
 * core/localization-contract/types.ts
 *
 * Normalized Agent 2 (Region Localizer) output contract.
 *
 * Design constraints (from Layer B):
 *   - INV-2 (complement): bbox_1000 belongs here, NOT in segmentation.
 *   - INV-4: review_comment may appear in localization output and summary state;
 *     it must NOT appear in final result rows (result-model is TASK-401+).
 *   - Agent 2 preserves the target_id and region count/order from Agent 1;
 *     it adds bbox_1000 per region but must not redefine what the target is.
 *   - INV-9: no provider SDK types here — only normalized domain shapes.
 *
 * bbox_1000 format: [y_min, x_min, y_max, x_max] on a 0–1000 normalized scale
 * where (0,0) is top-left and (1000,1000) is bottom-right.
 *
 * TASK-301 adds this contract. Later tasks (TASK-401+) consume it in the
 * crop engine and final result assembly.
 */

/**
 * A single localized region: the page reference carried from Agent 1 plus the
 * normalized bounding box returned by Agent 2.
 *
 * bbox_1000: [y_min, x_min, y_max, x_max] — four integers in [0, 1000].
 * Invariant: y_min < y_max AND x_min < x_max.
 * The crop engine converts these to pixel coordinates using the page dimensions.
 */
export interface LocalizationRegion {
  /** 1-based page number (preserved from the Agent 1 segmentation target). */
  page_number: number;

  /**
   * Normalized bounding box on a 0–1000 scale.
   * Format: [y_min, x_min, y_max, x_max].
   * Invariant: all values are integers in [0, 1000], y_min < y_max, x_min < x_max.
   */
  bbox_1000: [number, number, number, number];
}

/**
 * Normalized Agent 2 result for a single target.
 *
 * target_id is preserved from the Agent 1 SegmentationTarget — Agent 2 must
 * not invent or change it.
 * regions[] carries the same count and page_number order as Agent 1 provided;
 * Agent 2 adds bbox_1000 per region but must not add, remove, or reorder regions.
 */
export interface LocalizationResult {
  /** The run_id from the orchestrator run (for traceability). */
  run_id: string;

  /** Target identifier — must match the Agent 1 SegmentationTarget.target_id. */
  target_id: string;

  /**
   * Localized regions with bbox_1000.
   * Count and page_number order must match the Agent 1 segmentation target's regions.
   */
  regions: LocalizationRegion[];

  /**
   * Optional Agent 2 review note.
   * Present when localization is uncertain or bbox confidence is low.
   * MUST NOT appear in final result rows (INV-4).
   */
  review_comment?: string;
}

/**
 * Validation error thrown when an Agent 2 response does not match the contract.
 */
export interface LocalizationValidationError {
  code: 'LOCALIZATION_SCHEMA_INVALID';
  message: string;
  details?: string;
}
