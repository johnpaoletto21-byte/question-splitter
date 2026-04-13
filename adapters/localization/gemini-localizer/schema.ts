/**
 * adapters/localization/gemini-localizer/schema.ts
 *
 * Gemini structured output response schema for Agent 3 (Region Localizer).
 *
 * Agent 3 receives a sliding window of 1-3 images and returns bounding boxes
 * for each question visible in the window.
 *
 * bbox_1000 is an array of exactly 4 integers [y_min, x_min, y_max, x_max]
 * on a 0–1000 normalized scale. The schema enforces the 4-element shape
 * at the API level; strict validation (inversion, range) is done in the parser.
 */

/** Build the JSON schema for window-based localization. */
export function buildGeminiLocalizationSchema(windowSize: number = 3): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      targets: {
        type: 'array',
        description:
          'List of question bounding boxes found in the provided images. ' +
          'One entry per question per image. A question spanning two images has two entries. ' +
          'Empty array if no questions appear in these images.',
        items: {
          type: 'object',
          properties: {
            question_number: {
              type: 'string',
              description:
                'The question number from the provided question list (e.g. "1", "2", "問3"). ' +
                'Must match exactly one entry in the question list.',
            },
            image_position: {
              type: 'integer',
              description:
                `Which image this bounding box is on (1 = first image, 2 = second, 3 = third). ` +
                `Value must be between 1 and ${windowSize}.`,
              minimum: 1,
              maximum: windowSize,
            },
            bbox_1000: {
              type: 'array',
              description:
                'Normalized bounding box [y_min, x_min, y_max, x_max] on a 0–1000 scale. ' +
                '(0,0) is top-left, (1000,1000) is bottom-right. ' +
                'y_min must be less than y_max; x_min must be less than x_max. ' +
                'IMPORTANT: Include the ENTIRE question content including all diagrams and figures.',
              minItems: 4,
              maxItems: 4,
              items: {
                type: 'integer',
                minimum: 0,
                maximum: 1000,
              },
            },
          },
          required: ['question_number', 'image_position', 'bbox_1000'],
        },
      },
      review_comment: {
        type: 'string',
        description:
          'Optional note when localization is uncertain or bbox confidence is low.',
      },
    },
    required: ['targets'],
  };
}

/** Default JSON schema for Gemini's responseSchema field (Agent 3, 3-image window). */
export const GEMINI_LOCALIZATION_SCHEMA = buildGeminiLocalizationSchema(3);
