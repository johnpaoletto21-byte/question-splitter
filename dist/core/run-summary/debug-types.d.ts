/**
 * core/run-summary/debug-types.ts
 *
 * Debug data types for pipeline internals.
 * Carried on RunSummaryState.debugData so the summary renderer can
 * display agent inputs/outputs, filtering, and validation info.
 */
import type { SegmentationTarget } from '../segmentation-contract/types';
import type { LocalizationResult } from '../localization-contract/types';
import type { DeduplicationResult, MergeLogEntry } from '../deduplication-contract/types';
/** Per-chunk Agent 1 segmentation result for debug display. */
export interface SegmentationChunkDebug {
    chunkIndex: number;
    startPage: number;
    endPage: number;
    contextPageNumbers: number[];
    targets: SegmentationTarget[];
}
/** Per-chunk reviewed segmentation result for debug display. */
export interface ReviewChunkDebug {
    chunkIndex: number;
    corrected: boolean;
    targets: SegmentationTarget[];
}
/** A target that failed Agent 3 localization. */
export interface LocalizationFailureDebug {
    targetId: string;
    sourcePages: number[];
    failureCode: string;
    failureMessage: string;
}
/** Temporary debug data for the full pipeline run. */
export interface DebugData {
    /** Agent 1: per-chunk raw segmentation results. */
    agent1ChunkResults: SegmentationChunkDebug[];
    /** Agent 2: per-chunk reviewed segmentation results. */
    reviewChunkResults: ReviewChunkDebug[];
    /** Agent 3: per-target localization results. */
    localizationResults: LocalizationResult[];
    /** Targets that failed Agent 3 localization. */
    localizationFailures: LocalizationFailureDebug[];
    /** Agent 4: deduplication result. */
    deduplicationResult?: DeduplicationResult;
    /** Agent 4: merge log for audit trail. */
    deduplicationMergeLog?: MergeLogEntry[];
}
//# sourceMappingURL=debug-types.d.ts.map