/**
 * adapters/localization/gemini-localizer/__tests__/parser.test.ts
 *
 * Unit tests for the Gemini localization response parser.
 *
 * Proves:
 *   - target_id is carried from Agent 1 SegmentationTarget, never from Gemini output.
 *   - Region count drift (Agent 2 returning wrong count) is rejected.
 *   - Region page_number drift (Agent 2 returning wrong page numbers) is rejected.
 *   - Invalid bbox shape and range are rejected (BBOX_INVALID guard / PO-2 complement).
 *   - review_comment flows through (INV-4: visible in agent output and summary).
 *   - run_id is embedded in the result.
 *   - Agent 2 cannot create or reorder targets (it only adds bbox_1000 per region).
 */

import { parseGeminiLocalizationResponse } from '../parser';
import type { SegmentationTarget } from '../../../../core/segmentation-contract/types';

const RUN_ID = 'run_2024-01-01_testloc1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSegTarget(overrides: Partial<SegmentationTarget> = {}): SegmentationTarget {
  return {
    target_id: 'q_0001',
    target_type: 'question',
    regions: [{ page_number: 1 }],
    ...overrides,
  };
}

function makeRawLocOutput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    regions: [{ page_number: 1, bbox_1000: [100, 50, 800, 950] }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('parseGeminiLocalizationResponse — happy path', () => {
  it('parses a valid single-region response', () => {
    const result = parseGeminiLocalizationResponse(makeRawLocOutput(), RUN_ID, makeSegTarget());
    expect(result.run_id).toBe(RUN_ID);
    expect(result.target_id).toBe('q_0001');
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].page_number).toBe(1);
    expect(result.regions[0].bbox_1000).toEqual([100, 50, 800, 950]);
  });

  it('parses a valid two-region response', () => {
    const source = makeSegTarget({
      regions: [{ page_number: 1 }, { page_number: 2 }],
    });
    const raw = makeRawLocOutput({
      regions: [
        { page_number: 1, bbox_1000: [100, 50, 1000, 950] },
        { page_number: 2, bbox_1000: [0, 50, 400, 950] },
      ],
    });
    const result = parseGeminiLocalizationResponse(raw, RUN_ID, source);
    expect(result.regions).toHaveLength(2);
    expect(result.regions[0].page_number).toBe(1);
    expect(result.regions[1].page_number).toBe(2);
  });

  it('carries target_id from SegmentationTarget, not from Gemini output', () => {
    const source = makeSegTarget({ target_id: 'q_0042' });
    const result = parseGeminiLocalizationResponse(makeRawLocOutput(), RUN_ID, source);
    expect(result.target_id).toBe('q_0042');
  });

  it('uses the provided run_id in the result', () => {
    const customRunId = 'run_2024-12-01_custom77';
    const result = parseGeminiLocalizationResponse(makeRawLocOutput(), customRunId, makeSegTarget());
    expect(result.run_id).toBe(customRunId);
  });

  it('propagates review_comment when present (INV-4)', () => {
    const raw = makeRawLocOutput({ review_comment: 'bbox confidence low near fold' });
    const result = parseGeminiLocalizationResponse(raw, RUN_ID, makeSegTarget());
    expect(result.review_comment).toBe('bbox confidence low near fold');
  });

  it('does not include review_comment key when absent (clean result, INV-4)', () => {
    const result = parseGeminiLocalizationResponse(makeRawLocOutput(), RUN_ID, makeSegTarget());
    expect('review_comment' in result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Region count / order drift (Agent 2 cannot redefine target structure)
// ---------------------------------------------------------------------------

describe('parseGeminiLocalizationResponse — region drift guards', () => {
  it('rejects when Agent 2 returns more regions than Agent 1 defined', () => {
    const source = makeSegTarget({ regions: [{ page_number: 1 }] });
    const raw = makeRawLocOutput({
      regions: [
        { page_number: 1, bbox_1000: [0, 0, 500, 1000] },
        { page_number: 2, bbox_1000: [0, 0, 500, 1000] },
      ],
    });
    expect(() => parseGeminiLocalizationResponse(raw, RUN_ID, source)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('region count drift'),
      }),
    );
  });

  it('rejects when Agent 2 returns fewer regions than Agent 1 defined', () => {
    const source = makeSegTarget({
      regions: [{ page_number: 1 }, { page_number: 2 }],
    });
    const raw = makeRawLocOutput({
      regions: [{ page_number: 1, bbox_1000: [0, 0, 500, 1000] }],
    });
    expect(() => parseGeminiLocalizationResponse(raw, RUN_ID, source)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('region count drift'),
      }),
    );
  });

  it('rejects when Agent 2 returns wrong page_number for a region', () => {
    const source = makeSegTarget({
      regions: [{ page_number: 1 }, { page_number: 2 }],
    });
    const raw = makeRawLocOutput({
      // Returns page 3 instead of page 2 — reorder/drift attempt
      regions: [
        { page_number: 1, bbox_1000: [0, 0, 500, 1000] },
        { page_number: 3, bbox_1000: [0, 0, 500, 1000] },
      ],
    });
    expect(() => parseGeminiLocalizationResponse(raw, RUN_ID, source)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('page_number drift'),
      }),
    );
  });

  it('rejects when Agent 2 swaps page_number order', () => {
    const source = makeSegTarget({
      regions: [{ page_number: 1 }, { page_number: 2 }],
    });
    const raw = makeRawLocOutput({
      // Swapped order: page 2 then page 1
      regions: [
        { page_number: 2, bbox_1000: [0, 0, 500, 1000] },
        { page_number: 1, bbox_1000: [0, 0, 500, 1000] },
      ],
    });
    expect(() => parseGeminiLocalizationResponse(raw, RUN_ID, source)).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('page_number drift'),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Invalid bbox shape / range
// ---------------------------------------------------------------------------

describe('parseGeminiLocalizationResponse — bbox validation', () => {
  it('rejects missing bbox_1000', () => {
    const raw = { regions: [{ page_number: 1 }] };
    expect(() => parseGeminiLocalizationResponse(raw, RUN_ID, makeSegTarget())).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('bbox_1000'),
      }),
    );
  });

  it('rejects bbox_1000 with wrong element count', () => {
    const raw = makeRawLocOutput({ regions: [{ page_number: 1, bbox_1000: [0, 0, 500] }] });
    expect(() => parseGeminiLocalizationResponse(raw, RUN_ID, makeSegTarget())).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects bbox value out of range (> 1000)', () => {
    const raw = makeRawLocOutput({
      regions: [{ page_number: 1, bbox_1000: [0, 0, 1001, 500] }],
    });
    expect(() => parseGeminiLocalizationResponse(raw, RUN_ID, makeSegTarget())).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('out of range'),
      }),
    );
  });

  it('rejects bbox value out of range (negative)', () => {
    const raw = makeRawLocOutput({
      regions: [{ page_number: 1, bbox_1000: [-1, 0, 500, 500] }],
    });
    expect(() => parseGeminiLocalizationResponse(raw, RUN_ID, makeSegTarget())).toThrow(
      expect.objectContaining({ code: 'LOCALIZATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects inverted y bbox (y_min >= y_max)', () => {
    const raw = makeRawLocOutput({
      regions: [{ page_number: 1, bbox_1000: [800, 50, 100, 950] }],
    });
    expect(() => parseGeminiLocalizationResponse(raw, RUN_ID, makeSegTarget())).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('inverted y'),
      }),
    );
  });

  it('rejects inverted x bbox (x_min >= x_max)', () => {
    const raw = makeRawLocOutput({
      regions: [{ page_number: 1, bbox_1000: [100, 900, 800, 50] }],
    });
    expect(() => parseGeminiLocalizationResponse(raw, RUN_ID, makeSegTarget())).toThrow(
      expect.objectContaining({
        code: 'LOCALIZATION_SCHEMA_INVALID',
        message: expect.stringContaining('inverted x'),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Structural validation
// ---------------------------------------------------------------------------

describe('parseGeminiLocalizationResponse — structural validation', () => {
  it('rejects non-object raw input', () => {
    expect(() => parseGeminiLocalizationResponse(null, RUN_ID, makeSegTarget())).toThrow();
    expect(() => parseGeminiLocalizationResponse('string', RUN_ID, makeSegTarget())).toThrow();
  });

  it('rejects raw input missing regions array', () => {
    expect(() =>
      parseGeminiLocalizationResponse({ other: 'field' }, RUN_ID, makeSegTarget()),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// No target-count/order creation by Agent 2
// ---------------------------------------------------------------------------

describe('parseGeminiLocalizationResponse — no target invention', () => {
  it('result has exactly one target_id (the one from Agent 1)', () => {
    const source = makeSegTarget({ target_id: 'q_0005' });
    const result = parseGeminiLocalizationResponse(makeRawLocOutput(), RUN_ID, source);
    // LocalizationResult is for a single target — there's no targets[] array
    expect(result.target_id).toBe('q_0005');
    expect('targets' in result).toBe(false);
  });

  it('target_id in result matches Agent 1 exactly regardless of what Gemini might return', () => {
    // Gemini output has no target_id field — parser should never read it from there
    const rawWithExtraField = { ...makeRawLocOutput(), target_id: 'q_9999' };
    const source = makeSegTarget({ target_id: 'q_0001' });
    const result = parseGeminiLocalizationResponse(rawWithExtraField, RUN_ID, source);
    // Parser must ignore Gemini's target_id and use Agent 1's
    expect(result.target_id).toBe('q_0001');
  });
});
