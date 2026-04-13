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

import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';

function buildExtractionFieldsSchema(
  extractionFields: ReadonlyArray<ExtractionFieldDefinition>,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
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

export function buildGeminiSegmentationSchema(input: {
  extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
  maxRegionsPerTarget?: number;
} = {}): Record<string, unknown> {
  const extractionFields = input.extractionFields ?? [];
  const maxRegions = input.maxRegionsPerTarget ?? 10;

  const targetProperties: Record<string, unknown> = {
    target_type: {
      type: 'string',
      description: 'The type of this target. Use "question" for a parent question.',
    },
    question_number: {
      type: 'string',
      description:
        'The question number as printed in the document (e.g. "1", "2", "問3", "Q4"). ' +
        'Usually found at the top-left of the question.',
    },
    question_text: {
      type: 'string',
      description:
        'The first ~200 characters of the question body text. ' +
        'Include inline notes for diagrams/figures in square brackets, ' +
        'e.g. "[diagram on the right]", "[graph below]".',
    },
    sub_questions: {
      type: 'array',
      description:
        'Sub-question labels like ["(1)", "(2)", "(3)"], ["(a)", "(b)"], or ["①", "②"]. ' +
        'Empty array if the question has no sub-parts.',
      items: {
        type: 'string',
      },
    },
    regions: {
      type: 'array',
      description:
        'Ordered page references for this target. One entry per page the question appears on.',
      minItems: 1,
      maxItems: maxRegions,
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
    finish_page_number: {
      type: 'integer',
      description: 'The 1-based page number where this target\'s final visible content ends.',
      minimum: 1,
    },
    review_comment: {
      type: 'string',
      description:
        'Optional note when the segmentation result is uncertain or ambiguous. ' +
        'Use this to flag targets that may need manual review.',
    },
  };

  const targetRequired = ['target_type', 'regions', 'finish_page_number', 'question_number', 'question_text', 'sub_questions'];

  if (extractionFields.length > 0) {
    targetProperties['extraction_fields'] = buildExtractionFieldsSchema(extractionFields);
    targetRequired.push('extraction_fields');
  }

  return {
    type: 'object',
    properties: {
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
    required: ['targets'],
  };
}

/** JSON schema object for Gemini's responseSchema field. */
export const GEMINI_SEGMENTATION_SCHEMA = buildGeminiSegmentationSchema();
