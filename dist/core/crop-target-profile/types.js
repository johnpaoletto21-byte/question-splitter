"use strict";
/**
 * core/crop-target-profile — active crop target policy for this run.
 *
 * V1 policy: target_type = 'question', max_regions_per_target = 2,
 * composition_mode = 'top_to_bottom'.  All three values are centralized here;
 * no other module may hardcode them (supports INV-3 / PO-3).
 *
 * No provider SDK types appear in this module (supports INV-9 / PO-8).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileValidationError = void 0;
/**
 * Error thrown when a CropTargetProfile value violates a structural rule.
 */
class ProfileValidationError extends Error {
    constructor(reason) {
        super(`PROFILE_INVALID: ${reason}`);
        this.code = 'PROFILE_INVALID';
        this.name = 'ProfileValidationError';
    }
}
exports.ProfileValidationError = ProfileValidationError;
//# sourceMappingURL=types.js.map