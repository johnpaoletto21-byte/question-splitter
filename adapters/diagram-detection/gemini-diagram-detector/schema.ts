/**
 * adapters/diagram-detection/gemini-diagram-detector/schema.ts
 *
 * Gemini structured-output response schema for Agent D (Diagram Detector).
 *
 * The detector receives ONE image (a previously cropped exam question) and
 * returns one bbox per diagram found. bbox_1000 follows the same convention
 * as Agent 3's schema: [y_min, x_min, y_max, x_max] integers in 0-1000.
 */

export const GEMINI_DIAGRAM_DETECTOR_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    diagrams: {
      type: 'array',
      description:
        'Ordered list of diagrams found in the image (top-to-bottom, then left-to-right). ' +
        'Empty array if no diagrams are present (e.g. text-only crop or answer-box-only orphan).',
      items: {
        type: 'object',
        properties: {
          diagram_index: {
            type: 'integer',
            description:
              '1-based reading-order index. First diagram is 1, second is 2, etc.',
            minimum: 1,
          },
          bbox_1000: {
            type: 'array',
            description:
              'Normalized bounding box [y_min, x_min, y_max, x_max] on a 0-1000 scale. ' +
              '(0,0) is top-left of the image, (1000,1000) is bottom-right. ' +
              'y_min must be less than y_max; x_min must be less than x_max. ' +
              'Include the diagram itself plus any caption (e.g. 図1), axis labels, units, ' +
              'arrows, point labels, and a small whitespace margin on every side.',
            minItems: 4,
            maxItems: 4,
            items: {
              type: 'integer',
              minimum: 0,
              maximum: 1000,
            },
          },
          label: {
            type: 'string',
            description:
              'Optional caption text spotted near the diagram (e.g. "図1", "Fig. 2"). ' +
              'Omit if no caption is visible.',
          },
        },
        required: ['diagram_index', 'bbox_1000'],
      },
    },
  },
  required: ['diagrams'],
};
