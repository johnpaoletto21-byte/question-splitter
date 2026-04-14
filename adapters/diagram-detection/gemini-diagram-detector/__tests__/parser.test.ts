/**
 * adapters/diagram-detection/gemini-diagram-detector/__tests__/parser.test.ts
 *
 * Unit tests for the Gemini diagram-detection JSON parser.
 */

import { parseGeminiDiagramDetectionResponse } from '../parser';

describe('parseGeminiDiagramDetectionResponse', () => {
  const SRC = '/tmp/source.png';

  function expectSchemaError(fn: () => unknown): void {
    let caught: unknown;
    try {
      fn();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect((caught as { code?: string }).code).toBe('DIAGRAM_DETECTION_SCHEMA_INVALID');
  }

  it('parses a well-formed response with multiple diagrams', () => {
    const raw = {
      diagrams: [
        { diagram_index: 1, bbox_1000: [100, 50, 400, 500], label: '図1' },
        { diagram_index: 2, bbox_1000: [500, 50, 800, 500] },
      ],
    };
    const result = parseGeminiDiagramDetectionResponse(raw, SRC);
    expect(result.source_image_path).toBe(SRC);
    expect(result.diagrams).toHaveLength(2);
    expect(result.diagrams[0]).toEqual({
      diagram_index: 1,
      bbox_1000: [100, 50, 400, 500],
      label: '図1',
    });
    expect(result.diagrams[1]).toEqual({
      diagram_index: 2,
      bbox_1000: [500, 50, 800, 500],
    });
  });

  it('returns empty diagrams for a no-diagrams response', () => {
    const raw = { diagrams: [] };
    const result = parseGeminiDiagramDetectionResponse(raw, SRC);
    expect(result.diagrams).toEqual([]);
  });

  it('sorts diagrams by diagram_index defensively', () => {
    const raw = {
      diagrams: [
        { diagram_index: 3, bbox_1000: [700, 50, 900, 500] },
        { diagram_index: 1, bbox_1000: [100, 50, 300, 500] },
        { diagram_index: 2, bbox_1000: [400, 50, 600, 500] },
      ],
    };
    const result = parseGeminiDiagramDetectionResponse(raw, SRC);
    expect(result.diagrams.map((d) => d.diagram_index)).toEqual([1, 2, 3]);
  });

  it('drops empty/whitespace labels', () => {
    const raw = {
      diagrams: [
        { diagram_index: 1, bbox_1000: [100, 50, 400, 500], label: '   ' },
      ],
    };
    const result = parseGeminiDiagramDetectionResponse(raw, SRC);
    expect(result.diagrams[0].label).toBeUndefined();
  });

  it('throws DIAGRAM_DETECTION_SCHEMA_INVALID when diagrams is missing', () => {
    expectSchemaError(() => parseGeminiDiagramDetectionResponse({} as unknown, SRC));
  });

  it('throws when bbox_1000 is wrong length', () => {
    const raw = {
      diagrams: [{ diagram_index: 1, bbox_1000: [1, 2, 3] }],
    };
    expectSchemaError(() => parseGeminiDiagramDetectionResponse(raw, SRC));
  });

  it('throws when diagram_index is not a positive integer', () => {
    const raw = {
      diagrams: [{ diagram_index: 0, bbox_1000: [1, 2, 3, 4] }],
    };
    expectSchemaError(() => parseGeminiDiagramDetectionResponse(raw, SRC));
  });

  it('throws when bbox values are not numbers', () => {
    const raw = {
      diagrams: [{ diagram_index: 1, bbox_1000: [1, 2, 'three', 4] }],
    };
    expectSchemaError(() => parseGeminiDiagramDetectionResponse(raw, SRC));
  });
});
