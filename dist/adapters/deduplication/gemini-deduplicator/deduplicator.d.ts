/**
 * adapters/deduplication/gemini-deduplicator/deduplicator.ts
 *
 * Main Gemini deduplication adapter — the public entry point for Agent 4.
 *
 * This is a text-only agent (no images). It receives JSON describing all
 * localized targets from all chunks and returns a deduplicated list.
 * No repair loops — relies on Gemini structured output mode.
 */
import type { DeduplicationInput, DeduplicationResult } from '../../../core/deduplication-contract/types';
import type { GeminiDeduplicatorConfig, HttpPostFn } from './types';
export declare const DEFAULT_GEMINI_DEDUPLICATOR_MODEL = "gemini-3.1-flash-lite-preview";
/**
 * Deduplicates targets across chunks using the Gemini API.
 * Text-only — no images are sent.
 */
export declare function deduplicateTargets(input: DeduplicationInput, promptSnapshot: string, config: GeminiDeduplicatorConfig, httpPost?: HttpPostFn): Promise<DeduplicationResult>;
//# sourceMappingURL=deduplicator.d.ts.map