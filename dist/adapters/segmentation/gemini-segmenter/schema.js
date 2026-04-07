"use strict";
/**
 * adapters/segmentation/gemini-segmenter/schema.ts
 *
 * Gemini structured output response schema for Agent 1.
 *
 * This JSON schema is sent in generationConfig.responseSchema so that
 * Gemini returns a predictable JSON object that the parser can validate
 * against the normalized segmentation contract.
 *
 * Note: target_id is intentionally absent — the parser assigns sequential
 * IDs in reading order after the response arrives.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEMINI_SEGMENTATION_SCHEMA = void 0;
/** JSON schema object for Gemini's responseSchema field. */
exports.GEMINI_SEGMENTATION_SCHEMA = {
    type: 'object',
    properties: {
        targets: {
            type: 'array',
            description: 'Ordered list of identified question targets in reading order.',
            items: {
                type: 'object',
                properties: {
                    target_type: {
                        type: 'string',
                        description: 'The type of this target. Use "question" for a parent question.',
                    },
                    regions: {
                        type: 'array',
                        description: 'Ordered page references for this target. 1 entry if the question fits ' +
                            'on one page, 2 entries if it spans two pages. Maximum 2 entries.',
                        minItems: 1,
                        maxItems: 2,
                        items: {
                            type: 'object',
                            properties: {
                                page_number: {
                                    type: 'integer',
                                    description: '1-based page number where part of this target appears.',
                                    minimum: 1,
                                },
                            },
                            required: ['page_number'],
                        },
                    },
                    review_comment: {
                        type: 'string',
                        description: 'Optional note when the segmentation result is uncertain or ambiguous. ' +
                            'Use this to flag targets that may need manual review.',
                    },
                },
                required: ['target_type', 'regions'],
            },
        },
    },
    required: ['targets'],
};
//# sourceMappingURL=schema.js.map