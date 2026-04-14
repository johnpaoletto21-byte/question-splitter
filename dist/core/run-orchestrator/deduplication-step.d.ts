/**
 * core/run-orchestrator/deduplication-step.ts
 *
 * Orchestrator step that invokes Agent 4 deduplication across all chunks
 * and returns the final deduplicated target list.
 */
import type { DeduplicationInput, DeduplicationResult } from '../deduplication-contract/types';
/**
 * Contract for a deduplicator function.
 * Implemented in `adapters/deduplication/gemini-deduplicator`.
 */
export type Deduplicator = (input: DeduplicationInput, promptSnapshot: string) => Promise<DeduplicationResult>;
/**
 * Runs the Agent 4 deduplication step.
 */
export declare function runDeduplicationStep(input: DeduplicationInput, promptSnapshot: string, deduplicator: Deduplicator): Promise<DeduplicationResult>;
//# sourceMappingURL=deduplication-step.d.ts.map