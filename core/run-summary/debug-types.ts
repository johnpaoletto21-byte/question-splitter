/**
 * core/run-summary/debug-types.ts
 *
 * Temporary debug data types for pipeline internals.
 * Carried on RunSummaryState.debugData so the summary renderer can
 * display agent inputs/outputs, filtering, and validation info.
 *
 * To remove: delete this file, remove the debugData field from
 * RunSummaryState, and remove renderDebugPanel from summary-renderer.ts.
 */

import type { SegmentationResult, SegmentationTarget } from '../segmentation-contract/types';
import type { LocalizationResult } from '../localization-contract/types';

/** Per-window Agent 1 segmentation result for debug display. */
export interface SegmentationWindowDebug {
  focusPageNumber: number;
  contextPageNumbers: number[];
  allowedRegionPageNumbers: number[];
  targets: SegmentationTarget[];
}

/** A ghost target removed during merge dedup. */
export interface GhostTargetDebug {
  /** The target that was removed (strict subset of another). */
  target: SegmentationTarget;
  /** The wider target that subsumed it. */
  keptBy: SegmentationTarget;
}

/** A target that failed Agent 2 localization. */
export interface LocalizationFailureDebug {
  targetId: string;
  sourcePages: number[];
  failureCode: string;
  failureMessage: string;
}

/** Temporary debug data for the full pipeline run. */
export interface DebugData {
  /** Agent 1: per-window raw segmentation results before merge. */
  agent1WindowResults: SegmentationWindowDebug[];

  /** Agent 1: merged segmentation result (after ghost dedup, before review). */
  agent1MergedSegmentation: SegmentationResult;

  /** Targets removed during merge as strict subsets of wider targets. */
  ghostTargetsRemoved: GhostTargetDebug[];

  /** Agent 1.5: reviewed/corrected segmentation output. */
  reviewStepOutput: SegmentationResult;

  /** Whether Agent 1.5 made corrections (true) or passed through (false). */
  reviewStepCorrected: boolean;

  /** Agent 2: per-target localization results. */
  localizationResults: LocalizationResult[];

  /** Targets that failed Agent 2 localization. */
  localizationFailures: LocalizationFailureDebug[];
}
