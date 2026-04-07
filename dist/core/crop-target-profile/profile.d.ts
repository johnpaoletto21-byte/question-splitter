/**
 * V1 active crop target profile.
 *
 * Centralizes the three V1 policy constants so no other module needs to
 * hardcode them:
 *   - target_type      = 'question'
 *   - max_regions_per_target = 2
 *   - composition_mode = 'top_to_bottom'
 *
 * Satisfies PO-3 (INV-3: max 2 regions; INV-6: top-to-bottom composition).
 */
import { CropTargetProfile } from './types';
/** The single V1 active profile.  Attached to RunContext at run start. */
export declare const V1_ACTIVE_PROFILE: CropTargetProfile;
/**
 * Validate a CropTargetProfile against V1 structural rules.
 *
 * Rules:
 * - target_type must be 'question' (the only V1 value)
 * - max_regions_per_target must be an integer in [1, 2] (INV-3)
 * - composition_mode must be 'top_to_bottom' (INV-6)
 *
 * Throws ProfileValidationError if any rule is violated.
 */
export declare function validateCropTargetProfile(profile: CropTargetProfile): void;
//# sourceMappingURL=profile.d.ts.map