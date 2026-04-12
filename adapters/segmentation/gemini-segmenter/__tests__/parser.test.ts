/**
 * adapters/segmentation/gemini-segmenter/__tests__/parser.test.ts
 *
 * Unit tests for the Gemini response parser.
 *
 * Proves:
 *   - Sequential target_id assignment in reading order.
 *   - Normalized output ordering preserved.
 *   - review_comment flows through (INV-4).
 *   - Bbox fields rejected (INV-2 / PO-2).
 *   - Invalid raw response rejected with typed error.
 */

import { parseGeminiSegmentationResponse } from '../parser';

const RUN_ID = 'run_2024-01-01_testrun1';

describe('parseGeminiSegmentationResponse', () => {
  it('parses a valid single-target response', () => {
    const raw = {
      targets: [
        { target_type: 'question', regions: [{ page_number: 1 }] },
      ],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID, 2);
    expect(result.run_id).toBe(RUN_ID);
    expect(result.targets).toHaveLength(1);
    expect(result.targets[0].target_id).toBe('q_0001');
    expect(result.targets[0].target_type).toBe('question');
    expect(result.targets[0].regions).toEqual([{ page_number: 1 }]);
  });

  it('assigns sequential target_ids in reading order (q_0001, q_0002, q_0003)', () => {
    const raw = {
      targets: [
        { target_type: 'question', regions: [{ page_number: 1 }] },
        { target_type: 'question', regions: [{ page_number: 2 }] },
        { target_type: 'question', regions: [{ page_number: 3 }] },
      ],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID, 2);
    expect(result.targets[0].target_id).toBe('q_0001');
    expect(result.targets[1].target_id).toBe('q_0002');
    expect(result.targets[2].target_id).toBe('q_0003');
  });

  it('preserves reading order of targets exactly', () => {
    const raw = {
      targets: [
        { target_type: 'question', regions: [{ page_number: 1 }] },
        { target_type: 'question', regions: [{ page_number: 2 }, { page_number: 3 }] },
      ],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID, 2);
    expect(result.targets[0].regions[0].page_number).toBe(1);
    expect(result.targets[1].regions[0].page_number).toBe(2);
    expect(result.targets[1].regions[1].page_number).toBe(3);
  });

  it('propagates review_comment when present (INV-4: visible in agent output)', () => {
    const raw = {
      targets: [
        {
          target_type: 'question',
          regions: [{ page_number: 1 }],
          review_comment: 'Boundary unclear near footer',
        },
      ],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID, 2);
    expect(result.targets[0].review_comment).toBe('Boundary unclear near footer');
  });

  it('does not include review_comment when absent', () => {
    const raw = {
      targets: [{ target_type: 'question', regions: [{ page_number: 1 }] }],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID, 2);
    expect('review_comment' in result.targets[0]).toBe(false);
  });

  it('rejects non-object raw input', () => {
    expect(() => parseGeminiSegmentationResponse(null, RUN_ID, 2)).toThrow();
    expect(() => parseGeminiSegmentationResponse('string', RUN_ID, 2)).toThrow();
  });

  it('rejects raw input missing targets array', () => {
    expect(() => parseGeminiSegmentationResponse({ other: 'field' }, RUN_ID, 2)).toThrow();
  });

  it('rejects a target with 3 regions when maxRegions=2 (INV-3)', () => {
    const raw = {
      targets: [
        {
          target_type: 'question',
          regions: [{ page_number: 1 }, { page_number: 2 }, { page_number: 3 }],
        },
      ],
    };
    expect(() => parseGeminiSegmentationResponse(raw, RUN_ID, 2)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects a region with bbox_1000 (INV-2 / PO-2 guard)', () => {
    const raw = {
      targets: [
        {
          target_type: 'question',
          regions: [{ page_number: 1, bbox_1000: [0, 0, 500, 500] }],
        },
      ],
    };
    expect(() => parseGeminiSegmentationResponse(raw, RUN_ID, 2)).toThrow(
      expect.objectContaining({
        code: 'SEGMENTATION_SCHEMA_INVALID',
        message: expect.stringContaining('bbox_1000'),
      }),
    );
  });

  it('pads target_id to 4 digits (q_0001 not q_1)', () => {
    const raw = {
      targets: [{ target_type: 'question', regions: [{ page_number: 1 }] }],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID, 2);
    expect(result.targets[0].target_id).toMatch(/^q_\d{4}$/);
  });

  it('uses the provided run_id in the result', () => {
    const raw = { targets: [{ target_type: 'question', regions: [{ page_number: 1 }] }] };
    const customRunId = 'run_2024-12-01_custom99';
    const result = parseGeminiSegmentationResponse(raw, customRunId, 2);
    expect(result.run_id).toBe(customRunId);
  });

  it('validates focus page and extraction fields when options are provided', () => {
    const raw = {
      targets: [{
        target_type: 'question',
        finish_page_number: 2,
        regions: [{ page_number: 2 }],
        extraction_fields: { has_diagram: false },
      }],
    };

    const result = parseGeminiSegmentationResponse(raw, RUN_ID, 2, {
      focusPageNumber: 2,
      extractionFields: [{
        key: 'has_diagram',
        label: 'Has Diagram',
        description: 'true if diagram appears',
        type: 'boolean',
      }],
    });

    expect(result.targets[0].finish_page_number).toBe(2);
    expect(result.targets[0].extraction_fields).toEqual({ has_diagram: false });
  });

  it('silently drops targets whose regions do not reach the focus page', () => {
    const raw = {
      targets: [{
        target_type: 'question',
        finish_page_number: 3,
        regions: [{ page_number: 3 }],
      }],
    };

    const result = parseGeminiSegmentationResponse(raw, RUN_ID, 2, {
      focusPageNumber: 2,
    });
    expect(result.targets).toEqual([]);
  });

  it('silently drops focus-page targets whose regions are only on other pages', () => {
    const raw = {
      targets: [{
        target_type: 'question',
        finish_page_number: 5,
        regions: [{ page_number: 1 }],
      }],
    };

    const result = parseGeminiSegmentationResponse(raw, RUN_ID, 2, {
      focusPageNumber: 5,
    });
    expect(result.targets).toEqual([]);
  });

  it('accepts an empty target list for a focus window', () => {
    const result = parseGeminiSegmentationResponse({ targets: [] }, RUN_ID, 2, {
      focusPageNumber: 2,
    });

    expect(result.targets).toEqual([]);
  });

  it('accepts a valid two-page target ending on the focus page', () => {
    const raw = {
      targets: [{
        target_type: 'question',
        finish_page_number: 5,
        regions: [{ page_number: 4 }, { page_number: 5 }],
      }],
    };

    const result = parseGeminiSegmentationResponse(raw, RUN_ID, 2, {
      focusPageNumber: 5,
    });

    expect(result.targets[0].regions.map((region) => region.page_number)).toEqual([4, 5]);
  });
});
