/**
 * core/crop-engine/bbox.ts
 *
 * Bbox validation and bbox-to-pixel conversion for the crop engine.
 *
 * These are pure, synchronous functions with no I/O and no provider SDK
 * dependency (INV-9 / PO-8 compliant).
 *
 * bbox_1000 format (from Layer B §5.1 / localization-contract):
 *   [y_min, x_min, y_max, x_max] — four integers in [0, 1000]
 *   where (0, 0) is the top-left of the page image and
 *   (1000, 1000) is the bottom-right.
 *   Invariant: y_min < y_max AND x_min < x_max (non-zero, non-inverted area).
 *
 * Validation runs again here at crop time (not just upstream in the
 * localization contract parser) because the crop engine is the point of use
 * and must not trust that prior layers rejected all bad inputs (TASK-302
 * acceptance bar).
 *
 * TASK-302 adds this module.
 */

import { BboxInvalidError, PixelRect } from './types';

// ---------------------------------------------------------------------------
// validateBbox
// ---------------------------------------------------------------------------

/**
 * Validates a localized bbox_1000 value at crop time.
 *
 * Re-validates even though the localization contract parser already checked
 * these constraints upstream.  The crop engine is the gating point before
 * any image I/O, so it must not silently pass bad geometry.
 *
 * Rejection criteria:
 *   - Any value is not an integer.
 *   - Any value is outside [0, 1000].
 *   - y_min >= y_max (inverted or zero-height).
 *   - x_min >= x_max (inverted or zero-width).
 *
 * @param bbox      [y_min, x_min, y_max, x_max] from the localized region.
 * @param targetId  Target identifier — embedded in the thrown BboxInvalidError.
 * @throws {BboxInvalidError} with code `BBOX_INVALID` if validation fails.
 */
export function validateBbox(
  bbox: [number, number, number, number],
  targetId: string,
): void {
  const labels = ['y_min', 'x_min', 'y_max', 'x_max'];

  for (let i = 0; i < 4; i++) {
    const v = bbox[i];
    if (!Number.isInteger(v)) {
      throw new BboxInvalidError(
        targetId,
        bbox,
        `${labels[i]} (${v}) is not an integer`,
      );
    }
    if (v < 0 || v > 1000) {
      throw new BboxInvalidError(
        targetId,
        bbox,
        `${labels[i]} (${v}) is out of range [0, 1000]`,
      );
    }
  }

  const [yMin, xMin, yMax, xMax] = bbox;

  if (yMin >= yMax) {
    throw new BboxInvalidError(
      targetId,
      bbox,
      `y_min (${yMin}) must be less than y_max (${yMax}) — inverted or zero-height`,
    );
  }

  if (xMin >= xMax) {
    throw new BboxInvalidError(
      targetId,
      bbox,
      `x_min (${xMin}) must be less than x_max (${xMax}) — inverted or zero-width`,
    );
  }
}

// ---------------------------------------------------------------------------
// bboxToPixelRect
// ---------------------------------------------------------------------------

/**
 * Converts a validated bbox_1000 value to a pixel-space rectangle using
 * the prepared page's actual rendered dimensions.
 *
 * Callers MUST call `validateBbox` before calling this function.
 * This function does not re-validate; it trusts its input is already clean.
 *
 * Conversion formula:
 *   x      = round(x_min / 1000 × image_width)
 *   y      = round(y_min / 1000 × image_height)
 *   width  = round((x_max − x_min) / 1000 × image_width)
 *   height = round((y_max − y_min) / 1000 × image_height)
 *
 * Rounding to integers is required because canvas and image crop calls
 * expect integer pixel coordinates.
 *
 * Example:
 *   bbox        = [200, 100, 700, 900]   (y_min, x_min, y_max, x_max)
 *   image_width = 1240 px
 *   image_height= 1754 px
 *   →  x      = round(100/1000 × 1240)       = 124
 *   →  y      = round(200/1000 × 1754)       = 351
 *   →  width  = round((900−100)/1000 × 1240) = 992
 *   →  height = round((700−200)/1000 × 1754) = 877
 *
 * @param bbox         [y_min, x_min, y_max, x_max] — already validated.
 * @param imageWidth   Width of the rendered page image in pixels (from PreparedPageImage).
 * @param imageHeight  Height of the rendered page image in pixels (from PreparedPageImage).
 * @returns            PixelRect with integer x, y, width, height.
 */
export function bboxToPixelRect(
  bbox: [number, number, number, number],
  imageWidth: number,
  imageHeight: number,
): PixelRect {
  const [yMin, xMin, yMax, xMax] = bbox;
  return {
    x: Math.round((xMin / 1000) * imageWidth),
    y: Math.round((yMin / 1000) * imageHeight),
    width: Math.round(((xMax - xMin) / 1000) * imageWidth),
    height: Math.round(((yMax - yMin) / 1000) * imageHeight),
  };
}
