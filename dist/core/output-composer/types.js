"use strict";
/**
 * core/output-composer/types.ts
 *
 * Input/output types for the output composer.
 *
 * Design constraints (Layer B):
 *   - INV-3: max 2 regions per target (V1 policy); 3+ is explicitly rejected.
 *   - INV-5: one output file per target.
 *   - INV-6: 'top_to_bottom' is the only allowed composition mode.
 *   - INV-9: no provider SDK types appear here.
 *
 * TASK-401 adds this module.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositionError = void 0;
/**
 * Error thrown when composition cannot produce a final output image.
 *
 * Stable contract code: COMPOSITION_FAILED (Layer B §5.2).
 * Triggers: unsupported region count (0 or 3+), unsupported composition_mode,
 *           or downstream image stacking failure wrapped by the caller.
 */
class CompositionError extends Error {
    constructor(targetId, reason) {
        super(`COMPOSITION_FAILED: target "${targetId}" — ${reason}`);
        this.targetId = targetId;
        this.code = 'COMPOSITION_FAILED';
        this.name = 'CompositionError';
    }
}
exports.CompositionError = CompositionError;
//# sourceMappingURL=types.js.map