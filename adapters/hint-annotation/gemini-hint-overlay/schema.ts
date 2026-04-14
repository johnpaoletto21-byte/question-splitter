/**
 * adapters/hint-annotation/gemini-hint-overlay/schema.ts
 *
 * JSON schema for Gemini's responseSchema constraint — forces the model to
 * return a well-typed array of annotation instructions.
 */

export const GEMINI_HINT_OVERLAY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    annotations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['line', 'arrow', 'arc', 'text'],
          },
          from: {
            type: 'array',
            items: { type: 'number' },
            description: '[x, y] start point in 0-1000 normalized coordinates',
          },
          to: {
            type: 'array',
            items: { type: 'number' },
            description: '[x, y] end point in 0-1000 normalized coordinates',
          },
          center: {
            type: 'array',
            items: { type: 'number' },
            description: '[x, y] arc center in 0-1000 normalized coordinates',
          },
          radius: {
            type: 'number',
            description: 'Arc radius in 0-1000 scale',
          },
          startAngle: {
            type: 'number',
            description: 'Arc start angle in degrees',
          },
          endAngle: {
            type: 'number',
            description: 'Arc end angle in degrees',
          },
          position: {
            type: 'array',
            items: { type: 'number' },
            description: '[x, y] text position in 0-1000 normalized coordinates',
          },
          content: {
            type: 'string',
            description: 'Text label content',
          },
        },
        required: ['type'],
      },
    },
  },
  required: ['annotations'],
};
