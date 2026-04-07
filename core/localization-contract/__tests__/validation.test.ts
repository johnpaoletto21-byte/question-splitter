/**
 * core/localization-contract/__tests__/validation.test.ts
 *
 * Unit tests for the localization contract runtime validators.
 *
 * Proves:
 *   - bbox_1000 is required and must be a valid 4-element integer array (PO-2 complement).
 *   - bbox values must be in [0, 1000] (BBOX_INVALID guard).
 *   - Inverted bbox (y_min >= y_max or x_min >= x_max) is rejected.
 *   - target_id is required and preserved as-is (Agent 2 cannot invent IDs).
 *   - review_comment flows through when present (INV-4).
 *   - review_comment is absent from result when not provided (INV-4: clean result).
 *   - Region count limit enforced (INV-3).
 */

import {
  validateLocalizationRegion,
  validateLocalizationResult,
} from '../validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawRegion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    page_number: 1,
    bbox_1000: [100, 50, 800, 950],
    ...overrides,
  };
}

function makeRawResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    run_id: 'run_2024-01-01_test',
    target_id: 'q_0001',
    regions: [{ page_number: 1, bbox_1000: [100, 50, 800, 950] }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateLocalizationRegion
// ---------------------------------------------------------------------------

describe('validateLocalizationRegion', () => {
  it('accepts a valid single-region with correct bbox', () => {
    const region = validateLocalizationRegion(makeRawRegion(), 0, 'q_0001');
    expect(region.page_number).toBe(1);
    expect(region.bbox_1000).toEqual([100, 50, 800, 950]);
  });

  it('accepts bbox values at the boundary edges (0 and 1000)', () => {
    const region = validateLocalizationRegion(
      makeRawRegion({ bbox_1000: [0, 0, 1000, 1000] }),
      0,
      'q_0001',
    );
    expect(region.bbox_1000).toEqual([0, 0, 1000, 1000]);
  });

  it('rejects a non-object region', () => {
    expect(() => validateLocalizationRegion('bad', 0, 'q_0001')).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
    expect(() => validateLocalizationRegion(null, 0, 'q_0001')).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects missing bbox_1000', () => {
    const raw = { page_number: 1 };
    expect(() => validateLocalizationRegion(raw, 0, 'q_0001')).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('bbox_1000'),
      }),
    );
  });

  it('rejects bbox_1000 that is not an array', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ bbox_1000: 'bad' }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('bbox_1000'),
      }),
    );
  });

  it('rejects bbox_1000 with wrong element count (3 elements)', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ bbox_1000: [0, 0, 500] }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('4 elements'),
      }),
    );
  });

  it('rejects bbox_1000 with wrong element count (5 elements)', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ bbox_1000: [0, 0, 500, 500, 999] }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects bbox value above 1000', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ bbox_1000: [0, 0, 1001, 500] }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('out of range'),
      }),
    );
  });

  it('rejects bbox value below 0 (negative)', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ bbox_1000: [-1, 0, 500, 500] }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('out of range'),
      }),
    );
  });

  it('rejects inverted y (y_min >= y_max)', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ bbox_1000: [500, 0, 100, 500] }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('inverted y'),
      }),
    );
  });

  it('rejects equal y_min and y_max (y_min === y_max)', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ bbox_1000: [500, 0, 500, 500] }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('inverted y'),
      }),
    );
  });

  it('rejects inverted x (x_min >= x_max)', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ bbox_1000: [0, 800, 500, 100] }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('inverted x'),
      }),
    );
  });

  it('rejects equal x_min and x_max (x_min === x_max)', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ bbox_1000: [0, 500, 500, 500] }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('inverted x'),
      }),
    );
  });

  it('rejects non-integer bbox value (float)', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ bbox_1000: [0, 0, 500.5, 500] }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects negative page_number', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ page_number: -1 }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects page_number = 0 (must be 1-based)', () => {
    expect(() =>
      validateLocalizationRegion(makeRawRegion({ page_number: 0 }), 0, 'q_0001'),
    ).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });
});

// ---------------------------------------------------------------------------
// validateLocalizationResult
// ---------------------------------------------------------------------------

describe('validateLocalizationResult', () => {
  it('accepts a valid single-region result', () => {
    const result = validateLocalizationResult(makeRawResult());
    expect(result.run_id).toBe('run_2024-01-01_test');
    expect(result.target_id).toBe('q_0001');
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].page_number).toBe(1);
    expect(result.regions[0].bbox_1000).toEqual([100, 50, 800, 950]);
  });

  it('accepts a valid two-region result', () => {
    const result = validateLocalizationResult(
      makeRawResult({
        regions: [
          { page_number: 1, bbox_1000: [100, 50, 1000, 950] },
          { page_number: 2, bbox_1000: [0, 50, 400, 950] },
        ],
      }),
    );
    expect(result.regions).toHaveLength(2);
    expect(result.regions[0].page_number).toBe(1);
    expect(result.regions[1].page_number).toBe(2);
  });

  it('accepts result with review_comment (INV-4: flows through to summary)', () => {
    const result = validateLocalizationResult(
      makeRawResult({ review_comment: 'bbox confidence low near fold' }),
    );
    expect(result.review_comment).toBe('bbox confidence low near fold');
  });

  it('does not include review_comment when absent (clean result)', () => {
    const result = validateLocalizationResult(makeRawResult());
    expect('review_comment' in result).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(() => validateLocalizationResult(null)).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
    expect(() => validateLocalizationResult('bad')).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects missing run_id', () => {
    const raw = makeRawResult();
    delete (raw as Record<string, unknown>)['run_id'];
    expect(() => validateLocalizationResult(raw)).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects empty run_id', () => {
    expect(() => validateLocalizationResult(makeRawResult({ run_id: '' }))).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects missing target_id', () => {
    const raw = makeRawResult();
    delete (raw as Record<string, unknown>)['target_id'];
    expect(() => validateLocalizationResult(raw)).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects empty target_id', () => {
    expect(() => validateLocalizationResult(makeRawResult({ target_id: '' }))).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects empty regions array', () => {
    expect(() => validateLocalizationResult(makeRawResult({ regions: [] }))).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects regions exceeding maxRegionsPerTarget (INV-3)', () => {
    const raw = makeRawResult({
      regions: [
        { page_number: 1, bbox_1000: [0, 0, 500, 1000] },
        { page_number: 2, bbox_1000: [0, 0, 500, 1000] },
        { page_number: 3, bbox_1000: [0, 0, 500, 1000] },
      ],
    });
    expect(() => validateLocalizationResult(raw, 2)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('INV-3'),
      }),
    );
  });

  it('rejects review_comment of wrong type', () => {
    expect(() =>
      validateLocalizationResult(makeRawResult({ review_comment: 42 })),
    ).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('propagates bbox validation errors from nested regions', () => {
    expect(() =>
      validateLocalizationResult(
        makeRawResult({ regions: [{ page_number: 1, bbox_1000: [900, 0, 100, 1000] }] }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('inverted y'),
      }),
    );
  });
});
