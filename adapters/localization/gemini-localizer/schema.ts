/**
 * adapters/localization/gemini-localizer/schema.ts
 *
 * Gemini structured output response schema for Agent 2 (Region Localizer).
 *
 * This JSON schema is sent in generationConfig.responseSchema so that
 * Gemini returns a predictable JSON object that the parser can validate
 * against the normalized localization contract.
 *
 * Design notes:
 *   - target_id is intentionally absent — the parser carries it from the
 *     incoming SegmentationTarget (Agent 2 cannot invent or change target identity).
 *   - The model is scoped to ONE target per call; regions[] here represents
 *     the bbox entries for each page region of that single target.
 *   - bbox_1000 is an array of exactly 4 integers [y_min, x_min, y_max, x_max]
 *     on a 0–1000 normalized scale. The schema enforces the 4-element shape
 *     at the API level; strict validation (inversion, range) is done in the parser.
 */

/** JSON schema object for Gemini's responseSchema field (Agent 2). */
export const GEMINI_LOCALIZATION_SCHEMA = {
  type: 'object',
  properties: {
    regions: {
      type: 'array',
      description:
        'Ordered bounding box entries for each page region of this target. ' +
        'Must have the same count and page order as provided in the prompt.',
      minItems: 1,
      maxItems: 2,
      items: {
        type: 'object',
        properties: {
          page_number: {
            type: 'integer',
            description:
              '1-based page number for this region (must match the page number given in the prompt).',
            minimum: 1,
          },
          bbox_1000: {
            type: 'array',
            description:
              'Normalized bounding box [y_min, x_min, y_max, x_max] on a 0–1000 scale. ' +
              '(0,0) is top-left, (1000,1000) is bottom-right. ' +
              'y_min must be less than y_max; x_min must be less than x_max.',
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
    review_comment: {
      type: 'string',
      description:
        'Optional note when localization is uncertain, the target is partially off-page, ' +
        'or bbox confidence is low. Flag any region that may need manual review.',
    },
  },
  required: ['regions'],
} as const;
