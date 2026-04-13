/**
 * adapters/deduplication/gemini-deduplicator/types.ts
 *
 * Adapter-internal types for the Gemini deduplication adapter.
 */

export interface GeminiDeduplicatorConfig {
  apiKey: string;
  model?: string;
}

export interface GeminiRawDeduplicatedTarget {
  target_type: string;
  question_number?: string;
  question_text?: string;
  sub_questions?: string[];
  finish_page_number?: number;
  regions: Array<{
    page_number: number;
    bbox_1000: number[];
  }>;
  extraction_fields?: Record<string, unknown>;
  source_chunk_indices: number[];
}

export interface GeminiRawMergeLogEntry {
  action: string;
  result_target_id: string;
  source_target_ids: string[];
  source_chunks: number[];
  reason: string;
}

export interface GeminiRawDeduplicationOutput {
  targets: GeminiRawDeduplicatedTarget[];
  merge_log: GeminiRawMergeLogEntry[];
}

export type HttpPostFn = (
  url: string,
  body: unknown,
  headers: Record<string, string>,
) => Promise<unknown>;
