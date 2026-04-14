/**
 * adapters/segmentation-review/gemini-reviewer/schema.ts
 *
 * Gemini structured output response schema for Agent 2 (reviewer).
 */

import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import { buildGeminiSegmentationSchema } from '../../segmentation/gemini-segmenter/schema';

export function buildGeminiReviewSchema(input: {
  extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
} = {}): Record<string, unknown> {
  const segSchema = buildGeminiSegmentationSchema({
    extractionFields: input.extractionFields,
  }) as Record<string, Record<string, Record<string, unknown>>>;

  const targetsSchema = segSchema['properties']['targets'];

  return {
    type: 'object',
    properties: {
      verdict: {
        type: 'string',
        description:
          'Set to "pass" if Agent 1\'s segmentation is correct. ' +
          'Set to "corrected" if you made any changes to the targets.',
        enum: ['pass', 'corrected'],
      },
      targets: {
        ...targetsSchema,
        description:
          'Corrected ordered list of targets. Required when verdict is "corrected". ' +
          'Omit or leave empty when verdict is "pass".',
      },
      answer_sheet_pages: {
        type: 'array',
        description:
          'List of 1-based page numbers that are dedicated answer sheets ' +
          '(pages containing mostly answer boxes/grids for multiple questions, not question content). ' +
          'Empty array if none. These pages will be excluded from question crops.',
        items: { type: 'integer' },
      },
    },
    required: ['verdict'],
  };
}
