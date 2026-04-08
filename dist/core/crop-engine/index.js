"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.bboxToPixelRect = exports.validateBbox = exports.BboxInvalidError = void 0;
var types_1 = require("./types");
Object.defineProperty(exports, "BboxInvalidError", { enumerable: true, get: function () { return types_1.BboxInvalidError; } });
var bbox_1 = require("./bbox");
Object.defineProperty(exports, "validateBbox", { enumerable: true, get: function () { return bbox_1.validateBbox; } });
Object.defineProperty(exports, "bboxToPixelRect", { enumerable: true, get: function () { return bbox_1.bboxToPixelRect; } });
//# sourceMappingURL=index.js.map