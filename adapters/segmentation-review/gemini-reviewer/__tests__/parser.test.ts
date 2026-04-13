/**
 * adapters/segmentation-review/gemini-reviewer/__tests__/parser.test.ts
 *
 * Unit tests for the Gemini reviewer response parser.
 *
 * Proves:
 *   - "pass" verdict returns null.
 *   - "corrected" verdict parses targets with sequential IDs.
 *   - image_index → page_number mapping via pages array.
 *   - Type coercion for string image_index and finish_image_index.
 *   - Validation passthrough (same rules as Agent 1).
 *   - Invalid verdicts and missing targets are rejected.
 */

import { parseGeminiReviewResponse } from '../parser';
import type { PreparedPageImage } from '../../../../core/source-model/types';

const RUN_ID = 'run_2024-01-01_testrun1';

/** Helper to build mock pages for index→page mapping. */
function makePages(...pageNumbers: number[]): PreparedPageImage[] {
  return pageNumbers.map((pn) => ({
    source_id: 'src_0000_exam',
    page_number: pn,
    image_path: `/tmp/page_${pn}.png`,
    image_width: 918,
    image_height: 1188,
  }));
}

// Default 3-page set for most tests
const PAGES = makePages(1, 2, 3);

describe('parseGeminiReviewResponse', () => {
  it('returns null for verdict "pass"', () => {
    const result = parseGeminiReviewResponse({ verdict: 'pass' }, RUN_ID, PAGES);
    expect(result).toBeNull();
  });

  it('parses a corrected single-target response with image_index→page_number mapping', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_image_index: 1,
          regions: [{ image_index: 1 }],
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID, PAGES);
    expect(result).not.toBeNull();
    expect(result!.run_id).toBe(RUN_ID);
    expect(result!.targets).toHaveLength(1);
    expect(result!.targets[0].target_id).toBe('q_0001');
    expect(result!.targets[0].target_type).toBe('question');
    expect(result!.targets[0].regions[0].page_number).toBe(1);
    expect(result!.targets[0].finish_page_number).toBe(1);
  });

  it('assigns sequential target_ids in reading order', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        { target_type: 'question', finish_image_index: 1, regions: [{ image_index: 1 }] },
        { target_type: 'question', finish_image_index: 2, regions: [{ image_index: 2 }] },
        { target_type: 'question', finish_image_index: 3, regions: [{ image_index: 3 }] },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID, PAGES);
    expect(result!.targets[0].target_id).toBe('q_0001');
    expect(result!.targets[1].target_id).toBe('q_0002');
    expect(result!.targets[2].target_id).toBe('q_0003');
  });

  it('maps image_index to correct page_number for non-1-starting chunks', () => {
    // Chunk starting at page 8: Image 1 = page 8, Image 2 = page 9
    const chunkPages = makePages(8, 9, 10);
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_image_index: 2,
          regions: [{ image_index: 1 }, { image_index: 2 }],
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID, chunkPages);
    expect(result!.targets[0].regions[0].page_number).toBe(8);
    expect(result!.targets[0].regions[1].page_number).toBe(9);
    expect(result!.targets[0].finish_page_number).toBe(9);
  });

  it('coerces string image_index to number', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_image_index: 2,
          regions: [{ image_index: '2' }],
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID, PAGES);
    expect(result!.targets[0].regions[0].page_number).toBe(2);
  });

  it('coerces string finish_image_index to number', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_image_index: '3',
          regions: [{ image_index: 3 }],
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID, PAGES);
    expect(result!.targets[0].finish_page_number).toBe(3);
  });

  it('propagates review_comment when present', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_image_index: 1,
          regions: [{ image_index: 1 }],
          review_comment: 'Merged two split targets',
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID, PAGES);
    expect(result!.targets[0].review_comment).toBe('Merged two split targets');
  });

  it('propagates extraction_fields when present', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_image_index: 1,
          regions: [{ image_index: 1 }],
          extraction_fields: { has_diagram: true },
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID, PAGES, 2, {
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
    expect(() => parseGeminiReviewResponse(null, RUN_ID, PAGES)).toThrow();
    expect(() => parseGeminiReviewResponse('string', RUN_ID, PAGES)).toThrow();
  });

  it('rejects invalid verdict', () => {
    expect(() => parseGeminiReviewResponse({ verdict: 'invalid' }, RUN_ID, PAGES)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects "corrected" verdict without targets array', () => {
    expect(() => parseGeminiReviewResponse({ verdict: 'corrected' }, RUN_ID, PAGES)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects a target with 3 regions when maxRegions=2', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_image_index: 1,
          regions: [{ image_index: 1 }, { image_index: 2 }, { image_index: 3 }],
        },
      ],
    };
    expect(() => parseGeminiReviewResponse(raw, RUN_ID, PAGES, 2)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects out-of-range image_index', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          finish_image_index: 5,
          regions: [{ image_index: 5 }],
        },
      ],
    };
    expect(() => parseGeminiReviewResponse(raw, RUN_ID, PAGES)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('uses the provided run_id in the result', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        { target_type: 'question', finish_image_index: 1, regions: [{ image_index: 1 }] },
      ],
    };
    const result = parseGeminiReviewResponse(raw, 'run_custom_id', PAGES);
    expect(result!.run_id).toBe('run_custom_id');
  });
});
