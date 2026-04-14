"use strict";
/**
 * core/diagram-detection/types.ts
 *
 * Type contracts for the diagram-only cropper.
 *
 * Input to this feature is a single PNG (a previously cropped exam question
 * containing one or more diagrams). Output is one PNG per detected diagram.
 *
 * Design constraints (mirror INV-9 from the question pipeline):
 *   - No provider SDK types here — this module is core, adapter-clean.
 *   - bbox_1000 uses the same [y_min, x_min, y_max, x_max] convention as Agent 3
 *     so we can reuse core/crop-engine/bbox.ts validators unchanged.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=types.js.map