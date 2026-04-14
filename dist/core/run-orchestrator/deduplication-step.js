"use strict";
/**
 * core/run-orchestrator/deduplication-step.ts
 *
 * Orchestrator step that invokes Agent 4 deduplication across all chunks
 * and returns the final deduplicated target list.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDeduplicationStep = runDeduplicationStep;
/**
 * Runs the Agent 4 deduplication step.
 */
async function runDeduplicationStep(input, promptSnapshot, deduplicator) {
    return deduplicator(input, promptSnapshot);
}
//# sourceMappingURL=deduplication-step.js.map