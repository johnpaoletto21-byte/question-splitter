import {
  V1_ACTIVE_PROFILE,
  validateCropTargetProfile,
} from '../profile';
import { ProfileValidationError } from '../types';
import type { CropTargetProfile } from '../types';

// ---------------------------------------------------------------------------
// V1 defaults
// ---------------------------------------------------------------------------

describe('V1_ACTIVE_PROFILE — centralized V1 policy constants', () => {
  it('target_type is "question"', () => {
    expect(V1_ACTIVE_PROFILE.target_type).toBe('question');
  });

  it('max_regions_per_target is 2', () => {
    expect(V1_ACTIVE_PROFILE.max_regions_per_target).toBe(2);
  });

  it('composition_mode is "top_to_bottom"', () => {
    expect(V1_ACTIVE_PROFILE.composition_mode).toBe('top_to_bottom');
  });

  it('profile object is stable (same reference each import)', () => {
    // Both imports should resolve to the same module-level constant.
    const { V1_ACTIVE_PROFILE: p2 } = require('../profile');
    expect(V1_ACTIVE_PROFILE).toBe(p2);
  });
});

// ---------------------------------------------------------------------------
// validateCropTargetProfile — happy path
// ---------------------------------------------------------------------------

describe('validateCropTargetProfile — valid profiles', () => {
  it('accepts the V1 active profile without throwing', () => {
    expect(() => validateCropTargetProfile(V1_ACTIVE_PROFILE)).not.toThrow();
  });

  it('accepts max_regions_per_target = 1 (single-region question)', () => {
    const profile: CropTargetProfile = {
      ...V1_ACTIVE_PROFILE,
      max_regions_per_target: 1,
    };
    expect(() => validateCropTargetProfile(profile)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateCropTargetProfile — target_type violations
// ---------------------------------------------------------------------------

describe('validateCropTargetProfile — target_type violations', () => {
  it('throws ProfileValidationError for an unknown target_type', () => {
    const profile = {
      ...V1_ACTIVE_PROFILE,
      target_type: 'answer' as CropTargetProfile['target_type'],
    };
    expect(() => validateCropTargetProfile(profile)).toThrow(ProfileValidationError);
  });

  it('error code is PROFILE_INVALID for unknown target_type', () => {
    const profile = {
      ...V1_ACTIVE_PROFILE,
      target_type: 'diagram' as CropTargetProfile['target_type'],
    };
    try {
      validateCropTargetProfile(profile);
    } catch (err) {
      expect((err as ProfileValidationError).code).toBe('PROFILE_INVALID');
    }
  });
});

// ---------------------------------------------------------------------------
// validateCropTargetProfile — max_regions_per_target violations (INV-3)
// ---------------------------------------------------------------------------

describe('validateCropTargetProfile — max_regions_per_target violations (INV-3)', () => {
  it('throws ProfileValidationError for max_regions_per_target = 3 (exceeds V1 limit)', () => {
    const profile: CropTargetProfile = {
      ...V1_ACTIVE_PROFILE,
      max_regions_per_target: 3,
    };
    expect(() => validateCropTargetProfile(profile)).toThrow(ProfileValidationError);
  });

  it('throws ProfileValidationError for max_regions_per_target = 0', () => {
    const profile: CropTargetProfile = {
      ...V1_ACTIVE_PROFILE,
      max_regions_per_target: 0,
    };
    expect(() => validateCropTargetProfile(profile)).toThrow(ProfileValidationError);
  });

  it('throws ProfileValidationError for non-integer max_regions_per_target', () => {
    const profile: CropTargetProfile = {
      ...V1_ACTIVE_PROFILE,
      max_regions_per_target: 1.5,
    };
    expect(() => validateCropTargetProfile(profile)).toThrow(ProfileValidationError);
  });

  it('error message mentions INV-3 limit', () => {
    const profile: CropTargetProfile = {
      ...V1_ACTIVE_PROFILE,
      max_regions_per_target: 3,
    };
    try {
      validateCropTargetProfile(profile);
    } catch (err) {
      expect((err as ProfileValidationError).message).toMatch(/INV-3/);
    }
  });
});

// ---------------------------------------------------------------------------
// validateCropTargetProfile — composition_mode violations (INV-6)
// ---------------------------------------------------------------------------

describe('validateCropTargetProfile — composition_mode violations (INV-6)', () => {
  it('throws ProfileValidationError for an unknown composition_mode', () => {
    const profile = {
      ...V1_ACTIVE_PROFILE,
      composition_mode: 'side_by_side' as CropTargetProfile['composition_mode'],
    };
    expect(() => validateCropTargetProfile(profile)).toThrow(ProfileValidationError);
  });

  it('error code is PROFILE_INVALID for unknown composition_mode', () => {
    const profile = {
      ...V1_ACTIVE_PROFILE,
      composition_mode: 'overlay' as CropTargetProfile['composition_mode'],
    };
    try {
      validateCropTargetProfile(profile);
    } catch (err) {
      expect((err as ProfileValidationError).code).toBe('PROFILE_INVALID');
    }
  });
});
