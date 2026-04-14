/**
 * core/deduplication-contract/types.ts
 *
 * Normalized Agent 4 (Deduplicator) contract types.
 *
 * The deduplicator receives localized targets from all chunks and
 * produces a final deduplicated list by merging overlapping questions.
 */
import type { LocalizationRegion } from '../localization-contract/types';
/**
 * Input for a single chunk's results, including localized targets.
 */
export interface DeduplicationChunkInput {
    chunk_index: number;
    start_page: number;
    end_page: number;
    targets: DeduplicationTargetInput[];
}
/**
 * A single target as input to the deduplicator.
 * Combines segmentation metadata with localization bboxes.
 */
export interface DeduplicationTargetInput {
    target_id: string;
    target_type: string;
    question_number?: string;
    question_text?: string;
    sub_questions?: string[];
    finish_page_number?: number;
    regions: LocalizationRegion[];
    extraction_fields?: Record<string, boolean>;
    review_comment?: string;
}
export interface OverlapZoneInput {
    chunkAIndex: number;
    chunkBIndex: number;
    overlapPages: number[];
}
/**
 * Complete input to the deduplication agent.
 */
export interface DeduplicationInput {
    run_id: string;
    chunks: DeduplicationChunkInput[];
    overlap_zones: OverlapZoneInput[];
}
/**
 * A single deduplicated target in the final output.
 */
export interface DeduplicatedTarget {
    target_id: string;
    target_type: string;
    question_number?: string;
    question_text?: string;
    sub_questions?: string[];
    finish_page_number?: number;
    regions: LocalizationRegion[];
    extraction_fields?: Record<string, boolean>;
    /** Which chunk indices contributed to this target. */
    source_chunk_indices: number[];
}
/**
 * Audit trail entry for a dedup action.
 */
export interface MergeLogEntry {
    action: 'kept' | 'merged' | 'removed_duplicate';
    result_target_id: string;
    source_target_ids: string[];
    source_chunks: number[];
    reason: string;
}
/**
 * Complete deduplication result.
 */
export interface DeduplicationResult {
    run_id: string;
    targets: DeduplicatedTarget[];
    merge_log: MergeLogEntry[];
}
//# sourceMappingURL=types.d.ts.map