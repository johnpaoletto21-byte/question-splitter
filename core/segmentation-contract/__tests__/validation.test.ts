/**
 * core/segmentation-contract/__tests__/validation.test.ts
 *
 * Unit tests for the normalized segmentation contract validation.
 *
 * Proves:
 *   - PO-4 partial (supports INV-4): review_comment accepted in target, typed.
 *   - Normalized output ordering is preserved.
 *   - extraction_fields validation works correctly.
 *   - question metadata fields are accepted.
 */

import {
  validateSegmentationResult,
  validateSegmentationTarget,
} from '../validation';

// ---------------------------------------------------------------------------
// validateSegmentationTarget
// ---------------------------------------------------------------------------

describe('validateSegmentationTarget', () => {
  const validTarget = {
    target_id: 'q_0001',
    target_type: 'question',
  };

  it('accepts a valid target', () => {
    const result = validateSegmentationTarget(validTarget, 0);
    expect(result.target_id).toBe('q_0001');
    expect(result.target_type).toBe('question');
    expect(result.review_comment).toBeUndefined();
  });

  it('rejects missing target_id', () => {
    const { target_id: _, ...noId } = validTarget;
    expect(() => validateSegmentationTarget(noId, 0)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects empty string target_id', () => {
    expect(() =>
      validateSegmentationTarget({ ...validTarget, target_id: '' }, 0),
    ).toThrow(expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }));
  });

  it('rejects missing target_type', () => {
    const { target_type: _, ...noType } = validTarget;
    expect(() => validateSegmentationTarget(noType, 0)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('accepts optional review_comment when it is a string (INV-4)', () => {
    const result = validateSegmentationTarget(
      { ...validTarget, review_comment: 'Possibly split across pages' },
      0,
    );
    expect(result.review_comment).toBe('Possibly split across pages');
  });

  it('rejects non-string review_comment', () => {
    expect(() =>
      validateSegmentationTarget({ ...validTarget, review_comment: 42 }, 0),
    ).toThrow(expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }));
  });

  it('does not include review_comment when absent', () => {
    const result = validateSegmentationTarget(validTarget, 0);
    expect('review_comment' in result).toBe(false);
  });

  it('accepts extraction_fields with configured boolean fields', () => {
    const result = validateSegmentationTarget(
      {
        ...validTarget,
        extraction_fields: { has_diagram: true },
      },
      0,
      {
        extractionFields: [{
          key: 'has_diagram',
          label: 'Has Diagram',
          description: 'true if diagram appears',
          type: 'boolean',
        }],
      },
    );

    expect(result.extraction_fields).toEqual({ has_diagram: true });
  });

  it('rejects missing or non-boolean configured extraction fields', () => {
    const fields = [{
      key: 'has_diagram',
      label: 'Has Diagram',
      description: 'true if diagram appears',
      type: 'boolean' as const,
    }];

    expect(() => validateSegmentationTarget(
      { ...validTarget },
      0,
      { extractionFields: fields },
    )).toThrow(expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }));

    expect(() => validateSegmentationTarget(
      {
        ...validTarget,
        extraction_fields: { has_diagram: 'yes' },
      },
      0,
      { extractionFields: fields },
    )).toThrow(expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }));
  });
});

// ---------------------------------------------------------------------------
// validateSegmentationResult
// ---------------------------------------------------------------------------

describe('validateSegmentationResult', () => {
  const validResult = {
    run_id: 'run_2024-01-01_abc12345',
    targets: [
      {
        target_id: 'q_0001',
        target_type: 'question',
      },
      {
        target_id: 'q_0002',
        target_type: 'question',
      },
    ],
  };

  it('accepts a valid segmentation result', () => {
    const result = validateSegmentationResult(validResult);
    expect(result.run_id).toBe('run_2024-01-01_abc12345');
    expect(result.targets).toHaveLength(2);
  });

  it('preserves target order exactly (reading order invariant)', () => {
    const result = validateSegmentationResult(validResult);
    expect(result.targets[0].target_id).toBe('q_0001');
    expect(result.targets[1].target_id).toBe('q_0002');
  });

  it('accepts an empty targets array', () => {
    const result = validateSegmentationResult({ run_id: 'run_test', targets: [] });
    expect(result.targets).toHaveLength(0);
  });

  it('rejects non-object result', () => {
    expect(() => validateSegmentationResult(null)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects missing run_id', () => {
    const { run_id: _, ...noRunId } = validResult;
    expect(() => validateSegmentationResult(noRunId)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects empty run_id string', () => {
    expect(() => validateSegmentationResult({ ...validResult, run_id: '' })).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects missing targets array', () => {
    expect(() => validateSegmentationResult({ run_id: 'run_test' })).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('propagates review_comment from target (INV-4: allowed in agent output)', () => {
    const withComment = {
      run_id: 'run_test',
      targets: [
        {
          target_id: 'q_0001',
          target_type: 'question',
          review_comment: 'Unclear boundary near footer',
        },
      ],
    };
    const result = validateSegmentationResult(withComment);
    expect(result.targets[0].review_comment).toBe('Unclear boundary near footer');
  });
});
