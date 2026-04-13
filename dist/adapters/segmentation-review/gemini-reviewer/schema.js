"use strict";
/**
 * adapters/segmentation-review/gemini-reviewer/schema.ts
 *
 * Gemini structured output response schema for Agent 1.5 (reviewer).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGeminiReviewSchema = buildGeminiReviewSchema;
const schema_1 = require("../../segmentation/gemini-segmenter/schema");
function buildGeminiReviewSchema(input = {}) {
    const segSchema = (0, schema_1.buildGeminiSegmentationSchema)({
        extractionFields: input.extractionFields,
        requireFinishPage: true,
    });
    const targetsSchema = segSchema['properties']['targets'];
    return {
        type: 'object',
        properties: {
            verdict: {
                type: 'string',
                description: 'Set to "pass" if Agent 1\'s segmentation is correct. ' +
                    'Set to "corrected" if you made any changes to the targets.',
                enum: ['pass', 'corrected'],
            },
            targets: {
                ...targetsSchema,
                description: 'Corrected ordered list of targets. Required when verdict is "corrected". ' +
                    'Omit or leave empty when verdict is "pass".',
            },
        },
        required: ['verdict'],
    };
}
//# sourceMappingURL=schema.js.map