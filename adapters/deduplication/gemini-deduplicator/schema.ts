/**
 * adapters/deduplication/gemini-deduplicator/schema.ts
 *
 * Gemini structured output response schema for Agent 4 (Deduplicator).
 * This is a text-only agent (no images).
 */

export function buildGeminiDeduplicationSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      targets: {
        type: 'array',
        description: 'Final deduplicated list of targets in reading order.',
        items: {
          type: 'object',
          properties: {
            target_type: {
              type: 'string',
              description: 'The type of this target (e.g. "question").',
            },
            question_number: {
              type: 'string',
              description: 'The question number from the original segmentation.',
            },
            question_text: {
              type: 'string',
              description: 'The question text from the best version.',
            },
            sub_questions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Sub-question labels.',
            },
            finish_page_number: {
              type: 'integer',
              description: 'Last page with visible content for this target.',
              minimum: 1,
            },
            regions: {
              type: 'array',
              description: 'Localized regions with bbox, sorted by page_number.',
              items: {
                type: 'object',
                properties: {
                  page_number: {
                    type: 'integer',
                    minimum: 1,
                  },
                  bbox_1000: {
                    type: 'array',
                    minItems: 4,
                    maxItems: 4,
                    items: {
                      type: 'integer',
                      minimum: 0,
                      maximum: 1000,
                    },
                  },
                },
                required: ['page_number', 'bbox_1000'],
              },
            },
            source_chunk_indices: {
              type: 'array',
              items: { type: 'integer' },
              description: 'Which chunk indices contributed to this target.',
            },
          },
          required: ['target_type', 'regions', 'source_chunk_indices', 'question_number', 'question_text', 'sub_questions', 'finish_page_number'],
        },
      },
      merge_log: {
        type: 'array',
        description: 'Audit trail of dedup actions taken.',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['kept', 'merged', 'removed_duplicate'],
            },
            result_target_id: {
              type: 'string',
              description: 'Target ID in the output that this action produced.',
            },
            source_target_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Original target IDs from chunks that were involved.',
            },
            source_chunks: {
              type: 'array',
              items: { type: 'integer' },
              description: 'Chunk indices involved.',
            },
            reason: {
              type: 'string',
              description: 'Brief explanation of the action.',
            },
          },
          required: ['action', 'result_target_id', 'source_target_ids', 'source_chunks', 'reason'],
        },
      },
    },
    required: ['targets', 'merge_log'],
  };
}

export const GEMINI_DEDUPLICATION_SCHEMA = buildGeminiDeduplicationSchema();
