/**
 * core/output-composer/types.ts
 *
 * Input/output types for the output composer.
 *
 * Design constraints (Layer B):
 *   - INV-3: max 2 regions per target (V1 policy); 3+ is explicitly rejected.
 *   - INV-5: one output file per target.
 *   - INV-6: 'top_to_bottom' is the only allowed composition mode.
 *   - INV-9: no provider SDK types appear here.
 *
 * TASK-401 adds this module.
 */

import type { CompositionMode } from '../crop-target-profile/types';

/**
 * One crop region entering the composer.
 * Produced by the crop step and mapped by the composition step.
 */
export interface ComposerRegion {
  /** 1-based page number (from Agent 2 localization order). */
  page_number: number;
  /** Absolute path to the cropped image file for this region. */
  cropFilePath: string;
}

/**
 * Input to composeOutput for one target.
 */
export interface ComposerInput {
  /** Target identifier from Agent 1. */
  targetId: string;
  /**
   * Ordered page numbers covered by this target.
   * Used to populate source_pages in the FinalResultRow.
   */
  sourcePages: number[];
  /**
   * 1 or 2 regions in reading order (Agent 2 order preserved from crop step).
   * composeOutput rejects 0 or 3+ regions (INV-3 guard at composition time).
   */
  regions: ComposerRegion[];
  /**
   * Composition mode from the active profile.
   * Only 'top_to_bottom' is accepted in V1 (INV-6 guard).
   */
  compositionMode: CompositionMode;
}

/**
 * Output of composeOutput for one target.
 */
export interface ComposerResult {
  /** Target identifier — carried through from ComposerInput. */
  targetId: string;
  /** Page numbers covered (for result model assembly). */
  sourcePages: number[];
  /** Basename of the final output file (path.basename of localOutputPath). */
  outputFileName: string;
  /** Absolute path to the final output file. */
  localOutputPath: string;
}

/**
 * Error thrown when composition cannot produce a final output image.
 *
 * Stable contract code: COMPOSITION_FAILED (Layer B §5.2).
 * Triggers: unsupported region count (0 or 3+), unsupported composition_mode,
 *           or downstream image stacking failure wrapped by the caller.
 */
export class CompositionError extends Error {
  public readonly code = 'COMPOSITION_FAILED' as const;

  constructor(
    public readonly targetId: string,
    reason: string,
  ) {
    super(`COMPOSITION_FAILED: target "${targetId}" — ${reason}`);
    this.name = 'CompositionError';
  }
}
