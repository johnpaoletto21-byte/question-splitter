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

import { CropTargetProfile, ProfileValidationError } from './types';

/** The single V1 active profile.  Attached to RunContext at run start. */
export const V1_ACTIVE_PROFILE: CropTargetProfile = {
  target_type: 'question',
  max_regions_per_target: 10,
  composition_mode: 'top_to_bottom',
};

/** Allowed target_type values for validation. */
const ALLOWED_TARGET_TYPES = new Set<string>(['question']);

/** Allowed composition_mode values for validation. */
const ALLOWED_COMPOSITION_MODES = new Set<string>(['top_to_bottom']);

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
export function validateCropTargetProfile(profile: CropTargetProfile): void {
  if (!ALLOWED_TARGET_TYPES.has(profile.target_type)) {
    throw new ProfileValidationError(
      `target_type must be one of [${[...ALLOWED_TARGET_TYPES].join(', ')}]. ` +
        `Received: ${JSON.stringify(profile.target_type)}`
    );
  }

  if (
    !Number.isInteger(profile.max_regions_per_target) ||
    profile.max_regions_per_target < 1 ||
    profile.max_regions_per_target > 10
  ) {
    throw new ProfileValidationError(
      `max_regions_per_target must be an integer in [1, 10]. ` +
        `Received: ${JSON.stringify(profile.max_regions_per_target)}`
    );
  }

  if (!ALLOWED_COMPOSITION_MODES.has(profile.composition_mode)) {
    throw new ProfileValidationError(
      `composition_mode must be one of [${[...ALLOWED_COMPOSITION_MODES].join(', ')}]. ` +
        `Received: ${JSON.stringify(profile.composition_mode)}`
    );
  }
}
