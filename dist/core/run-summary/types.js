"use strict";
/**
 * core/run-summary/types.ts
 *
 * Run-summary state for the local UI.
 *
 * Design constraints (from Layer B):
 *   - INV-4: review_comment is visible in summary state — it must NOT appear
 *     in final result rows (result-model is a separate contract, TASK-401+).
 *   - This module depends only on normalized contracts — no provider SDK types.
 *
 * TASK-201 adds the Agent 1 segmentation view of summary state.
 * TASK-301 adds Agent 2 localization status fields.
 * Later tasks (TASK-401, TASK-501) will extend with final-result fields.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=types.js.map