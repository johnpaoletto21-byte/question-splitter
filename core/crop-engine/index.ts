/**
 * core/crop-engine — public API
 *
 * Exports:
 *   - BboxInvalidError  — stable BBOX_INVALID error contract (Layer B §5.2)
 *   - PixelRect         — pixel-space rectangle from bbox conversion
 *   - CropRegionPixels  — per-region conversion result
 *   - CropEngineTargetResult — per-target outcome (ok | failed)
 *   - validateBbox      — crop-time bbox validation
 *   - bboxToPixelRect   — normalized-to-pixel conversion using page dimensions
 *
 * TASK-302 adds this module.
 */

export { BboxInvalidError } from './types';
export type { PixelRect, CropRegionPixels, CropEngineTargetResult } from './types';
export { validateBbox, bboxToPixelRect } from './bbox';
