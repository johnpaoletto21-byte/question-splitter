/**
 * adapters/localization/gemini-localizer/__tests__/parser.test.ts
 *
 * Unit tests for parseWindowLocalizationResponse.
 *
 * Proves:
 *   - image_position is mapped to page_number via windowPages.
 *   - bbox_1000 validation (shape, range, inversion).
 *   - question_number is passed through from targets.
 *   - Empty targets array produces empty regions.
 *   - Out-of-range image_position is rejected.
 *   - review_comment flows through when present.
 *   - run_id is embedded in the result.
 */

import { parseWindowLocalizationResponse } from '../parser';
import type { PreparedPageImage } from '../../../../core/source-model/types';

const RUN_ID = 'run_2024-01-01_testloc1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePage(pageNumber: number): PreparedPageImage {
  return {
    source_id: 'src_0001_test',
    page_number: pageNumber,
    image_path: `/tmp/page_${pageNumber}.png`,
    image_width: 918,
    image_height: 1188,
  };
}

function makeWindowPages(pageNumbers: number[]): PreparedPageImage[] {
  return pageNumbers.map(makePage);
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('parseWindowLocalizationResponse — happy path', () => {
  it('maps image_position to page_number via windowPages', () => {
    const windowPages = makeWindowPages([5, 6, 7]);
    const raw = {
      targets: [
        { question_number: '1', image_position: 2, bbox_1000: [100, 50, 800, 950] },
      ],
    };
    const result = parseWindowLocalizationResponse(raw, RUN_ID, windowPages);
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].page_number).toBe(6); // image_position 2 → windowPages[1]
    expect(result.regions[0].question_number).toBe('1');
    expect(result.regions[0].bbox_1000).toEqual([100, 50, 800, 950]);
  });

  it('passes question_number through from each target', () => {
    const windowPages = makeWindowPages([1, 2, 3]);
    const raw = {
      targets: [
        { question_number: '3', image_position: 1, bbox_1000: [0, 0, 500, 500] },
        { question_number: '問4', image_position: 2, bbox_1000: [0, 0, 500, 500] },
      ],
    };
    const result = parseWindowLocalizationResponse(raw, RUN_ID, windowPages);
    expect(result.regions[0].question_number).toBe('3');
    expect(result.regions[1].question_number).toBe('問4');
  });

  it('uses the provided run_id in the result', () => {
    const windowPages = makeWindowPages([1]);
    const raw = { targets: [{ question_number: '1', image_position: 1, bbox_1000: [0, 0, 500, 500] }] };
    const result = parseWindowLocalizationResponse(raw, 'run_custom_77', windowPages);
    expect(result.run_id).toBe('run_custom_77');
  });

  it('propagates review_comment when present', () => {
    const windowPages = makeWindowPages([1]);
    const raw = {
      targets: [{ question_number: '1', image_position: 1, bbox_1000: [100, 50, 800, 950] }],
      review_comment: 'bbox confidence low near fold',
    };
    const result = parseWindowLocalizationResponse(raw, RUN_ID, windowPages);
    expect(result.review_comment).toBe('bbox confidence low near fold');
  });

  it('does not include review_comment key when absent', () => {
    const windowPages = makeWindowPages([1]);
    const raw = { targets: [{ question_number: '1', image_position: 1, bbox_1000: [100, 50, 800, 950] }] };
    const result = parseWindowLocalizationResponse(raw, RUN_ID, windowPages);
    expect('review_comment' in result).toBe(false);
  });

  it('handles multiple targets across different images', () => {
    const windowPages = makeWindowPages([10, 11, 12]);
    const raw = {
      targets: [
        { question_number: '1', image_position: 1, bbox_1000: [0, 0, 400, 1000] },
        { question_number: '2', image_position: 1, bbox_1000: [400, 0, 1000, 1000] },
        { question_number: '3', image_position: 3, bbox_1000: [0, 0, 500, 500] },
      ],
    };
    const result = parseWindowLocalizationResponse(raw, RUN_ID, windowPages);
    expect(result.regions).toHaveLength(3);
    expect(result.regions[0].page_number).toBe(10);
    expect(result.regions[1].page_number).toBe(10);
    expect(result.regions[2].page_number).toBe(12);
  });

  it('handles string image_position (coercion)', () => {
    const windowPages = makeWindowPages([1, 2]);
    const raw = {
      targets: [{ question_number: '1', image_position: '2', bbox_1000: [0, 0, 500, 500] }],
    };
    const result = parseWindowLocalizationResponse(raw, RUN_ID, windowPages);
    expect(result.regions[0].page_number).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Empty targets
// ---------------------------------------------------------------------------

describe('parseWindowLocalizationResponse — empty targets', () => {
  it('returns empty regions when targets array is empty', () => {
    const windowPages = makeWindowPages([1, 2, 3]);
    const raw = { targets: [] };
    const result = parseWindowLocalizationResponse(raw, RUN_ID, windowPages);
    expect(result.run_id).toBe(RUN_ID);
    expect(result.regions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Out-of-range image_position
// ---------------------------------------------------------------------------

describe('parseWindowLocalizationResponse — image_position validation', () => {
  it('rejects image_position 0 (below range)', () => {
    const windowPages = makeWindowPages([1, 2, 3]);
    const raw = {
      targets: [{ question_number: '1', image_position: 0, bbox_1000: [0, 0, 500, 500] }],
    };
    expect(() => parseWindowLocalizationResponse(raw, RUN_ID, windowPages)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('out of range'),
      }),
    );
  });

  it('rejects image_position beyond window size', () => {
    const windowPages = makeWindowPages([1, 2]); // only 2 pages
    const raw = {
      targets: [{ question_number: '1', image_position: 3, bbox_1000: [0, 0, 500, 500] }],
    };
    expect(() => parseWindowLocalizationResponse(raw, RUN_ID, windowPages)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('out of range'),
      }),
    );
  });

  it('rejects non-integer image_position', () => {
    const windowPages = makeWindowPages([1, 2, 3]);
    const raw = {
      targets: [{ question_number: '1', image_position: 1.5, bbox_1000: [0, 0, 500, 500] }],
    };
    expect(() => parseWindowLocalizationResponse(raw, RUN_ID, windowPages)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// bbox validation
// ---------------------------------------------------------------------------

describe('parseWindowLocalizationResponse — bbox validation', () => {
  const windowPages = makeWindowPages([1]);

  it('rejects missing bbox_1000', () => {
    const raw = { targets: [{ question_number: '1', image_position: 1 }] };
    expect(() => parseWindowLocalizationResponse(raw, RUN_ID, windowPages)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('bbox_1000'),
      }),
    );
  });

  it('rejects bbox_1000 with wrong element count', () => {
    const raw = { targets: [{ question_number: '1', image_position: 1, bbox_1000: [0, 0, 500] }] };
    expect(() => parseWindowLocalizationResponse(raw, RUN_ID, windowPages)).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects bbox value out of range (> 1000)', () => {
    const raw = {
      targets: [{ question_number: '1', image_position: 1, bbox_1000: [0, 0, 1001, 500] }],
    };
    expect(() => parseWindowLocalizationResponse(raw, RUN_ID, windowPages)).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects bbox value out of range (negative)', () => {
    const raw = {
      targets: [{ question_number: '1', image_position: 1, bbox_1000: [-1, 0, 500, 500] }],
    };
    expect(() => parseWindowLocalizationResponse(raw, RUN_ID, windowPages)).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects inverted y bbox (y_min >= y_max)', () => {
    const raw = {
      targets: [{ question_number: '1', image_position: 1, bbox_1000: [800, 50, 100, 950] }],
    };
    expect(() => parseWindowLocalizationResponse(raw, RUN_ID, windowPages)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('y_min'),
      }),
    );
  });

  it('rejects inverted x bbox (x_min >= x_max)', () => {
    const raw = {
      targets: [{ question_number: '1', image_position: 1, bbox_1000: [100, 900, 800, 50] }],
    };
    expect(() => parseWindowLocalizationResponse(raw, RUN_ID, windowPages)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('x_min'),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// question_number validation
// ---------------------------------------------------------------------------

describe('parseWindowLocalizationResponse — question_number validation', () => {
  const windowPages = makeWindowPages([1]);

  it('rejects empty question_number', () => {
    const raw = {
      targets: [{ question_number: '', image_position: 1, bbox_1000: [0, 0, 500, 500] }],
    };
    expect(() => parseWindowLocalizationResponse(raw, RUN_ID, windowPages)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('question_number'),
      }),
    );
  });

  it('rejects non-string question_number', () => {
    const raw = {
      targets: [{ question_number: 42, image_position: 1, bbox_1000: [0, 0, 500, 500] }],
    };
    expect(() => parseWindowLocalizationResponse(raw, RUN_ID, windowPages)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('question_number'),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Structural validation
// ---------------------------------------------------------------------------

describe('parseWindowLocalizationResponse — structural validation', () => {
  const windowPages = makeWindowPages([1]);

  it('rejects non-object raw input', () => {
    expect(() => parseWindowLocalizationResponse(null, RUN_ID, windowPages)).toThrow();
    expect(() => parseWindowLocalizationResponse('string', RUN_ID, windowPages)).toThrow();
  });

  it('rejects raw input missing targets array', () => {
    expect(() =>
      parseWindowLocalizationResponse({ other: 'field' }, RUN_ID, windowPages),
    ).toThrow();
  });
});
