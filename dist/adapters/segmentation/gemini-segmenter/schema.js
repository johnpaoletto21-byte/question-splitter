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
exports.buildGeminiSegmentationSchema = buildGeminiSegmentationSchema;
function buildExtractionFieldsSchema(extractionFields) {
    const properties = {};
    for (const field of extractionFields) {
        properties[field.key] = {
            type: 'boolean',
            description: field.description,
        };
    }
    return {
        type: 'object',
        description: 'Run-scoped boolean extraction field values for this target.',
        properties,
        required: extractionFields.map((field) => field.key),
    };
}
function buildGeminiSegmentationSchema(input = {}) {
    const extractionFields = input.extractionFields ?? [];
    const allowedRegionPageNumbers = input.allowedRegionPageNumbers ?? [];
    const pageNumberSchema = allowedRegionPageNumbers.length > 0
        ? {
            type: 'string',
            description: '1-based page number where part of this target appears.',
            enum: allowedRegionPageNumbers.map(String),
        }
        : {
            type: 'integer',
            description: '1-based page number where part of this target appears.',
            minimum: 1,
        };
    const targetProperties = {
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
                    page_number: pageNumberSchema,
                },
                required: ['page_number'],
            },
        },
        review_comment: {
            type: 'string',
            description: 'Optional note when the segmentation result is uncertain or ambiguous. ' +
                'Use this to flag targets that may need manual review.',
        },
    };
    const targetRequired = ['target_type', 'regions'];
    if (input.requireFinishPage === true) {
        const finishPageSchema = input.focusPageNumber !== undefined
            ? {
                type: 'string',
                description: 'The 1-based page number where this target finishes.',
                enum: [String(input.focusPageNumber)],
            }
            : {
                type: 'integer',
                description: 'The 1-based page number where this target finishes.',
                minimum: 1,
            };
        targetProperties['finish_page_number'] = finishPageSchema;
        targetRequired.push('finish_page_number');
    }
    if (extractionFields.length > 0) {
        targetProperties['extraction_fields'] = buildExtractionFieldsSchema(extractionFields);
        targetRequired.push('extraction_fields');
    }
    const classificationPageNumberSchema = allowedRegionPageNumbers.length > 0
        ? {
            type: 'string',
            description: '1-based page number.',
            enum: allowedRegionPageNumbers.map(String),
        }
        : {
            type: 'integer',
            description: '1-based page number.',
            minimum: 1,
        };
    return {
        type: 'object',
        properties: {
            page_classifications: {
                type: 'array',
                description: 'Classification for each provided page. One entry per page, in the same order as pages provided.',
                items: {
                    type: 'object',
                    properties: {
                        page_number: classificationPageNumberSchema,
                        classification: {
                            type: 'string',
                            description: 'The classification assigned to this page.',
                            enum: ['question_content', 'figure_only', 'blank', 'cover', 'answer_sheet'],
                        },
                    },
                    required: ['page_number', 'classification'],
                },
            },
            targets: {
                type: 'array',
                description: 'Ordered list of identified question targets in reading order.',
                items: {
                    type: 'object',
                    properties: targetProperties,
                    required: targetRequired,
                },
            },
        },
        required: ['page_classifications', 'targets'],
    };
}
/** JSON schema object for Gemini's responseSchema field. */
exports.GEMINI_SEGMENTATION_SCHEMA = buildGeminiSegmentationSchema();
//# sourceMappingURL=schema.js.map