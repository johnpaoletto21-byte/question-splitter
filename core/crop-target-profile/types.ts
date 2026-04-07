/**
 * core/crop-target-profile — active crop target policy for this run.
 *
 * V1 policy: target_type = 'question', max_regions_per_target = 2,
 * composition_mode = 'top_to_bottom'.  All three values are centralized here;
 * no other module may hardcode them (supports INV-3 / PO-3).
 *
 * No provider SDK types appear in this module (supports INV-9 / PO-8).
 */

/** The category of target being cropped.  V1 supports 'question' only. */
export type TargetType = 'question';

/**
 * How multi-region outputs are composed into a single file.
 * V1 supports 'top_to_bottom' only (INV-6).
 */
export type CompositionMode = 'top_to_bottom';

/**
 * Active policy profile for one run.
 *
 * Consumed by:
 *  - segmentation / localization (region count guard)
 *  - output composer (composition_mode)
 *  - run orchestrator (attached at run start)
 */
export interface CropTargetProfile {
  /** What kind of target is being cropped this run. */
  target_type: TargetType;

  /**
   * Maximum regions allowed per target.  V1 maximum is 2.
   * Consumers must reject targets that report more regions than this limit.
   */
  max_regions_per_target: number;

  /** How regions are combined into the final output image. */
  composition_mode: CompositionMode;
}

/**
 * Error thrown when a CropTargetProfile value violates a structural rule.
 */
export class ProfileValidationError extends Error {
  public readonly code = 'PROFILE_INVALID' as const;

  constructor(reason: string) {
    super(`PROFILE_INVALID: ${reason}`);
    this.name = 'ProfileValidationError';
  }
}
