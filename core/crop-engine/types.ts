/**
 * core/crop-engine/types.ts
 *
 * Types for the crop engine: error contract, pixel geometry, and per-target
 * crop step results.
 *
 * Design constraints (from Layer B, Boundary F):
 *   - BBOX_INVALID is the stable contract code for any bbox that fails validation
 *     at crop time (out-of-range values, inverted axes, or non-integer values).
 *   - PixelRect is the output of bbox-to-pixel conversion; it is consumed by the
 *     actual image-cropping logic (added in a later task when canvas I/O is wired).
 *   - No provider SDK types appear here (INV-9 / PO-8).
 *
 * TASK-302 adds this module.
 */

/**
 * Error thrown when a bbox_1000 value fails crop-time validation.
 *
 * Stable contract code: `BBOX_INVALID` (Layer B §5.2).
 * Rejection triggers: value out of [0, 1000], non-integer, inverted axis
 * (y_min >= y_max or x_min >= x_max).
 *
 * Per INV-8: the crop step catches this error per-target and continues
 * processing remaining targets.
 */
export class BboxInvalidError extends Error {
  public readonly code = 'BBOX_INVALID' as const;

  /**
   * @param targetId  The target whose region bbox failed validation.
   * @param bbox      The offending [y_min, x_min, y_max, x_max] tuple.
   * @param reason    Human-readable explanation of what failed.
   */
  constructor(
    public readonly targetId: string,
    public readonly bbox: [number, number, number, number],
    reason: string,
  ) {
    super(
      `BBOX_INVALID: target "${targetId}" bbox [${bbox.join(', ')}] — ${reason}`,
    );
    this.name = 'BboxInvalidError';
  }
}

/**
 * Pixel-space rectangle produced by bbox-to-pixel conversion.
 *
 * Origin (x=0, y=0) is the top-left corner of the rendered page image,
 * consistent with the coordinate system used by canvas and image libraries.
 *
 * Values are rounded integers suitable for direct use in image crop calls.
 */
export interface PixelRect {
  /** Left edge of the crop region in pixels (from x_min). */
  x: number;
  /** Top edge of the crop region in pixels (from y_min). */
  y: number;
  /** Width of the crop region in pixels (from x_max − x_min). */
  width: number;
  /** Height of the crop region in pixels (from y_max − y_min). */
  height: number;
}

/**
 * Successful pixel-conversion result for one localized region.
 * Produced by the crop engine before image I/O begins.
 */
export interface CropRegionPixels {
  /** 1-based page number — matches the localization region's page_number. */
  page_number: number;
  /** Pixel rectangle ready for image crop. */
  pixelRect: PixelRect;
}

/**
 * Outcome of the crop engine validation+conversion pass for one target.
 *
 * `status: 'ok'`     — all regions validated and converted; regions[] is populated.
 * `status: 'failed'` — at least one region failed; code is always 'BBOX_INVALID'.
 */
export type CropEngineTargetResult =
  | { status: 'ok'; targetId: string; regions: CropRegionPixels[] }
  | { status: 'failed'; targetId: string; code: 'BBOX_INVALID'; message: string };
