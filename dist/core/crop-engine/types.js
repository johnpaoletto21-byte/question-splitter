"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BboxInvalidError = void 0;
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
class BboxInvalidError extends Error {
    /**
     * @param targetId  The target whose region bbox failed validation.
     * @param bbox      The offending [y_min, x_min, y_max, x_max] tuple.
     * @param reason    Human-readable explanation of what failed.
     */
    constructor(targetId, bbox, reason) {
        super(`BBOX_INVALID: target "${targetId}" bbox [${bbox.join(', ')}] — ${reason}`);
        this.targetId = targetId;
        this.bbox = bbox;
        this.code = 'BBOX_INVALID';
        this.name = 'BboxInvalidError';
    }
}
exports.BboxInvalidError = BboxInvalidError;
//# sourceMappingURL=types.js.map