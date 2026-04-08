/**
 * core/crop-engine/__tests__/bbox.test.ts
 *
 * Unit tests for crop-time bbox validation and bbox-to-pixel conversion.
 *
 * Proves:
 *   PO-1 / INV-1  — crop engine is a gating step before image I/O.
 *   PO-3 / INV-3  — bbox validation enforces contract rules at crop time.
 *   PO-8 / INV-9  — no provider SDK dependency (pure math tested here).
 *
 * Contract code coverage:
 *   - BBOX_INVALID thrown for out-of-range values (below 0, above 1000).
 *   - BBOX_INVALID thrown for non-integer values.
 *   - BBOX_INVALID thrown for inverted y (y_min >= y_max).
 *   - BBOX_INVALID thrown for inverted x (x_min >= x_max).
 *   - Valid bbox passes without throwing.
 *   - Concrete pixel conversion example documented in bbox.ts comment is verified.
 *
 * TASK-302 adds this test suite.
 */

import { validateBbox, bboxToPixelRect } from '../bbox';
import { BboxInvalidError } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBbox(
  yMin: number,
  xMin: number,
  yMax: number,
  xMax: number,
): [number, number, number, number] {
  return [yMin, xMin, yMax, xMax];
}

// ---------------------------------------------------------------------------
// validateBbox — valid cases
// ---------------------------------------------------------------------------

describe('validateBbox — valid inputs', () => {
  it('accepts a well-formed bbox with typical interior values', () => {
    expect(() => validateBbox(makeBbox(100, 50, 800, 950), 'q_0001')).not.toThrow();
  });

  it('accepts boundary-edge bbox [0, 0, 1000, 1000]', () => {
    expect(() => validateBbox(makeBbox(0, 0, 1000, 1000), 'q_0001')).not.toThrow();
  });

  it('accepts a tight but valid bbox where min+1 = max', () => {
    expect(() => validateBbox(makeBbox(0, 0, 1, 1), 'q_0001')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateBbox — rejection: out-of-range
// ---------------------------------------------------------------------------

describe('validateBbox — out-of-range rejection', () => {
  it('throws BBOX_INVALID when y_min is negative', () => {
    const err = (() => {
      try {
        validateBbox(makeBbox(-1, 0, 500, 500), 'q_0002');
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(BboxInvalidError);
    expect((err as BboxInvalidError).code).toBe('BBOX_INVALID');
    expect((err as BboxInvalidError).message).toContain('out of range');
    expect((err as BboxInvalidError).targetId).toBe('q_0002');
  });

  it('throws BBOX_INVALID when x_max exceeds 1000', () => {
    const err = (() => {
      try {
        validateBbox(makeBbox(0, 0, 500, 1001), 'q_0002');
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(BboxInvalidError);
    expect((err as BboxInvalidError).code).toBe('BBOX_INVALID');
    expect((err as BboxInvalidError).message).toContain('out of range');
  });

  it('throws BBOX_INVALID when y_max exceeds 1000', () => {
    expect(() =>
      validateBbox(makeBbox(0, 0, 1001, 500), 'q_0003'),
    ).toThrow(BboxInvalidError);
  });

  it('throws BBOX_INVALID when x_min is negative', () => {
    expect(() =>
      validateBbox(makeBbox(0, -5, 500, 500), 'q_0003'),
    ).toThrow(BboxInvalidError);
  });
});

// ---------------------------------------------------------------------------
// validateBbox — rejection: non-integer
// ---------------------------------------------------------------------------

describe('validateBbox — non-integer rejection', () => {
  it('throws BBOX_INVALID when y_min is a float', () => {
    expect(() =>
      validateBbox([100.5, 0, 500, 500] as unknown as [number, number, number, number], 'q_0004'),
    ).toThrow(BboxInvalidError);
  });

  it('throws BBOX_INVALID when x_max is a float', () => {
    expect(() =>
      validateBbox([0, 0, 500, 500.9] as unknown as [number, number, number, number], 'q_0004'),
    ).toThrow(BboxInvalidError);
  });
});

// ---------------------------------------------------------------------------
// validateBbox — rejection: inverted axis
// ---------------------------------------------------------------------------

describe('validateBbox — inverted axis rejection', () => {
  it('throws BBOX_INVALID when y_min > y_max (inverted y)', () => {
    const err = (() => {
      try {
        validateBbox(makeBbox(800, 0, 100, 500), 'q_0005');
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(BboxInvalidError);
    expect((err as BboxInvalidError).code).toBe('BBOX_INVALID');
    expect((err as BboxInvalidError).message).toContain('y_min');
    expect((err as BboxInvalidError).message).toContain('y_max');
  });

  it('throws BBOX_INVALID when y_min === y_max (zero-height)', () => {
    expect(() =>
      validateBbox(makeBbox(500, 0, 500, 500), 'q_0005'),
    ).toThrow(BboxInvalidError);
  });

  it('throws BBOX_INVALID when x_min > x_max (inverted x)', () => {
    const err = (() => {
      try {
        validateBbox(makeBbox(0, 900, 500, 100), 'q_0006');
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(BboxInvalidError);
    expect((err as BboxInvalidError).code).toBe('BBOX_INVALID');
    expect((err as BboxInvalidError).message).toContain('x_min');
    expect((err as BboxInvalidError).message).toContain('x_max');
  });

  it('throws BBOX_INVALID when x_min === x_max (zero-width)', () => {
    expect(() =>
      validateBbox(makeBbox(0, 500, 500, 500), 'q_0006'),
    ).toThrow(BboxInvalidError);
  });
});

// ---------------------------------------------------------------------------
// bboxToPixelRect — concrete conversion cases
// ---------------------------------------------------------------------------

describe('bboxToPixelRect — concrete conversion', () => {
  /**
   * Concrete example documented in bbox.ts JSDoc:
   *   bbox         = [200, 100, 700, 900]  → y_min=200, x_min=100, y_max=700, x_max=900
   *   image_width  = 1240 px
   *   image_height = 1754 px
   *   expected:
   *     x      = round(100/1000 × 1240) = round(124.0) = 124
   *     y      = round(200/1000 × 1754) = round(350.8) = 351
   *     width  = round(800/1000 × 1240) = round(992.0) = 992
   *     height = round(500/1000 × 1754) = round(877.0) = 877
   */
  it('converts bbox [200, 100, 700, 900] on a 1240×1754 page to the expected pixel rect', () => {
    const rect = bboxToPixelRect(makeBbox(200, 100, 700, 900), 1240, 1754);
    expect(rect.x).toBe(124);
    expect(rect.y).toBe(351);
    expect(rect.width).toBe(992);
    expect(rect.height).toBe(877);
  });

  it('converts full-page bbox [0, 0, 1000, 1000] to full image dimensions', () => {
    const rect = bboxToPixelRect(makeBbox(0, 0, 1000, 1000), 2480, 3508);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(2480);
    expect(rect.height).toBe(3508);
  });

  it('converts bbox [0, 0, 500, 1000] (top half) correctly', () => {
    const rect = bboxToPixelRect(makeBbox(0, 0, 500, 1000), 1000, 1000);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(1000);
    expect(rect.height).toBe(500);
  });

  it('converts bbox [500, 0, 1000, 1000] (bottom half) correctly', () => {
    const rect = bboxToPixelRect(makeBbox(500, 0, 1000, 1000), 1000, 1000);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(500);
    expect(rect.width).toBe(1000);
    expect(rect.height).toBe(500);
  });

  it('rounds fractional pixel values to integers', () => {
    // imageWidth = 3, imageHeight = 3; bbox = [0, 0, 333, 667]
    // x = round(0/1000 * 3) = 0
    // y = round(0/1000 * 3) = 0
    // width = round(667/1000 * 3) = round(2.001) = 2
    // height = round(333/1000 * 3) = round(0.999) = 1
    const rect = bboxToPixelRect(makeBbox(0, 0, 333, 667), 3, 3);
    expect(Number.isInteger(rect.x)).toBe(true);
    expect(Number.isInteger(rect.y)).toBe(true);
    expect(Number.isInteger(rect.width)).toBe(true);
    expect(Number.isInteger(rect.height)).toBe(true);
  });
});
