/**
 * adapters/segmentation-review/gemini-reviewer/__tests__/parser.test.ts
 *
 * Unit tests for the Gemini reviewer response parser.
 *
 * Proves:
 *   - "pass" verdict returns null.
 *   - "corrected" verdict parses targets with sequential IDs.
 *   - Type coercion for string page_number and finish_page_number.
 *   - Validation passthrough (same rules as Agent 1).
 *   - Invalid verdicts and missing targets are rejected.
 */

import { parseGeminiReviewResponse } from '../parser';

const RUN_ID = 'run_2024-01-01_testrun1';

describe('parseGeminiReviewResponse', () => {
  it('returns null for verdict "pass"', () => {
    const result = parseGeminiReviewResponse({ verdict: 'pass' }, RUN_ID);
    expect(result).toBeNull();
  });

  it('parses a corrected single-target response', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_page_number: 1,
          regions: [{ page_number: 1 }],
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID);
    expect(result).not.toBeNull();
    expect(result!.run_id).toBe(RUN_ID);
    expect(result!.targets).toHaveLength(1);
    expect(result!.targets[0].target_id).toBe('q_0001');
    expect(result!.targets[0].target_type).toBe('question');
  });

  it('assigns sequential target_ids in reading order', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        { target_type: 'question', finish_page_number: 1, regions: [{ page_number: 1 }] },
        { target_type: 'question', finish_page_number: 2, regions: [{ page_number: 2 }] },
        { target_type: 'question', finish_page_number: 3, regions: [{ page_number: 3 }] },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID);
    expect(result!.targets[0].target_id).toBe('q_0001');
    expect(result!.targets[1].target_id).toBe('q_0002');
    expect(result!.targets[2].target_id).toBe('q_0003');
  });

  it('coerces string page_number to number', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_page_number: 2,
          regions: [{ page_number: '2' }],
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID);
    expect(result!.targets[0].regions[0].page_number).toBe(2);
  });

  it('coerces string finish_page_number to number', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_page_number: '3',
          regions: [{ page_number: 3 }],
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID);
    expect(result!.targets[0].finish_page_number).toBe(3);
  });

  it('propagates review_comment when present', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_page_number: 1,
          regions: [{ page_number: 1 }],
          review_comment: 'Merged two split targets',
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID);
    expect(result!.targets[0].review_comment).toBe('Merged two split targets');
  });

  it('propagates extraction_fields when present', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_page_number: 1,
          regions: [{ page_number: 1 }],
          extraction_fields: { has_diagram: true },
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID, 2, {
      extractionFields: [{
        key: 'has_diagram',
        label: 'Has Diagram',
        description: 'true if diagram appears',
        type: 'boolean',
      }],
    });
    expect(result!.targets[0].extraction_fields).toEqual({ has_diagram: true });
  });

  it('rejects non-object raw input', () => {
    expect(() => parseGeminiReviewResponse(null, RUN_ID)).toThrow();
    expect(() => parseGeminiReviewResponse('string', RUN_ID)).toThrow();
  });

  it('rejects invalid verdict', () => {
    expect(() => parseGeminiReviewResponse({ verdict: 'invalid' }, RUN_ID)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects "corrected" verdict without targets array', () => {
    expect(() => parseGeminiReviewResponse({ verdict: 'corrected' }, RUN_ID)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects a target with 3 regions when maxRegions=2', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_page_number: 1,
          regions: [{ page_number: 1 }, { page_number: 2 }, { page_number: 3 }],
        },
      ],
    };
    expect(() => parseGeminiReviewResponse(raw, RUN_ID, 2)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects a region with bbox_1000 (INV-2 / PO-2 guard)', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_page_number: 1,
          regions: [{ page_number: 1, bbox_1000: [0, 0, 500, 500] }],
        },
      ],
    };
    expect(() => parseGeminiReviewResponse(raw, RUN_ID, 2)).toThrow(
      expect.objectContaining({
        code: 'SEGMENTATION_SCHEMA_INVALID',
        message: expect.stringContaining('bbox_1000'),
      }),
    );
  });

  it('uses the provided run_id in the result', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        { target_type: 'question', finish_page_number: 1, regions: [{ page_number: 1 }] },
      ],
    };
    const result = parseGeminiReviewResponse(raw, 'run_custom_id');
    expect(result!.run_id).toBe('run_custom_id');
  });
});
