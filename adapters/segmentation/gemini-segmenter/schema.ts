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
  focusPageNumber?: number;
  allowedRegionPageNumbers?: ReadonlyArray<number>;
  requireFinishPage?: boolean;
} = {}): Record<string, unknown> {
  const extractionFields = input.extractionFields ?? [];
  const allowedRegionPageNumbers = input.allowedRegionPageNumbers ?? [];
  const pageNumberSchema: Record<string, unknown> = allowedRegionPageNumbers.length > 0
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
  const targetProperties: Record<string, unknown> = {
    target_type: {
      type: 'string',
      description: 'The type of this target. Use "question" for a parent question.',
    },
    regions: {
      type: 'array',
      description:
        'Ordered page references for this target. 1 entry if the question fits ' +
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
      description:
        'Optional note when the segmentation result is uncertain or ambiguous. ' +
        'Use this to flag targets that may need manual review.',
    },
  };

  const targetRequired = ['target_type', 'regions'];

  if (input.requireFinishPage === true) {
    const finishPageSchema: Record<string, unknown> = input.focusPageNumber !== undefined
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
