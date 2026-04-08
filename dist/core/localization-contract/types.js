"use strict";
/**
 * core/localization-contract/types.ts
 *
 * Normalized Agent 2 (Region Localizer) output contract.
 *
 * Design constraints (from Layer B):
 *   - INV-2 (complement): bbox_1000 belongs here, NOT in segmentation.
 *   - INV-4: review_comment may appear in localization output and summary state;
 *     it must NOT appear in final result rows (result-model is TASK-401+).
 *   - Agent 2 preserves the target_id and region count/order from Agent 1;
 *     it adds bbox_1000 per region but must not redefine what the target is.
 *   - INV-9: no provider SDK types here — only normalized domain shapes.
 *
 * bbox_1000 format: [y_min, x_min, y_max, x_max] on a 0–1000 normalized scale
 * where (0,0) is top-left and (1000,1000) is bottom-right.
 *
 * TASK-301 adds this contract. Later tasks (TASK-401+) consume it in the
 * crop engine and final result assembly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=types.js.map