"use strict";
/**
 * adapters/deduplication/gemini-deduplicator/parser.ts
 *
 * Parses the raw Gemini deduplication output into a DeduplicationResult.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGeminiDeduplicationResponse = parseGeminiDeduplicationResponse;
function makeTargetId(index) {
    return `q_${String(index + 1).padStart(4, '0')}`;
}
function isObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function parseGeminiDeduplicationResponse(raw, runId) {
    if (!isObject(raw)) {
        throw new Error('Gemini deduplication response must be an object');
    }
    if (!Array.isArray(raw['targets'])) {
        throw new Error('Gemini deduplication response must have a targets array');
    }
    if (!Array.isArray(raw['merge_log'])) {
        throw new Error('Gemini deduplication response must have a merge_log array');
    }
    const rawOutput = raw;
    const targets = rawOutput.targets.map((t, i) => {
        const regions = t.regions.map((r) => ({
            page_number: typeof r.page_number === 'string' ? Number(r.page_number) : r.page_number,
            bbox_1000: r.bbox_1000,
        }));
        // Sort regions by page_number ascending
        regions.sort((a, b) => a.page_number - b.page_number);
        const target = {
            target_id: makeTargetId(i),
            target_type: t.target_type,
            regions,
            source_chunk_indices: t.source_chunk_indices ?? [],
        };
        if (typeof t.question_number === 'string') {
            target.question_number = t.question_number;
        }
        if (typeof t.question_text === 'string') {
            target.question_text = t.question_text;
        }
        if (Array.isArray(t.sub_questions)) {
            target.sub_questions = t.sub_questions;
        }
        if (typeof t.finish_page_number === 'number') {
            target.finish_page_number = t.finish_page_number;
        }
        else {
            // Derive from regions if not provided
            target.finish_page_number = Math.max(...regions.map((r) => r.page_number));
        }
        if (t.extraction_fields !== undefined && typeof t.extraction_fields === 'object') {
            target.extraction_fields = t.extraction_fields;
        }
        return target;
    });
    const mergeLog = rawOutput.merge_log.map((entry) => {
        const action = entry.action;
        return {
            action: ['kept', 'merged', 'removed_duplicate'].includes(action) ? action : 'kept',
            result_target_id: entry.result_target_id ?? '',
            source_target_ids: entry.source_target_ids ?? [],
            source_chunks: entry.source_chunks ?? [],
            reason: entry.reason ?? '',
        };
    });
    return {
        run_id: runId,
        targets,
        merge_log: mergeLog,
    };
}
//# sourceMappingURL=parser.js.map