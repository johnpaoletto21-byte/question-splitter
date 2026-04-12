/**
 * core/segmentation-contract/__tests__/validation.test.ts
 *
 * Unit tests for the normalized segmentation contract validation.
 *
 * Proves:
 *   - PO-2 (supports INV-2): no bbox_1000 in segmentation regions.
 *   - PO-3 partial (supports INV-3): region count capped at maxRegionsPerTarget.
 *   - PO-4 partial (supports INV-4): review_comment accepted in target, typed.
 *   - Normalized output ordering is preserved.
 */

import {
  validateSegmentationRegion,
  validateSegmentationResult,
  validateSegmentationTarget,
} from '../validation';

// ---------------------------------------------------------------------------
// validateSegmentationRegion
// ---------------------------------------------------------------------------

describe('validateSegmentationRegion', () => {
  it('accepts a valid region with page_number', () => {
    const result = validateSegmentationRegion({ page_number: 3 }, 0, 0);
    expect(result).toEqual({ page_number: 3 });
  });

  it('rejects non-object region', () => {
    expect(() => validateSegmentationRegion('bad', 0, 0)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects page_number = 0 (must be 1-based)', () => {
    expect(() => validateSegmentationRegion({ page_number: 0 }, 0, 0)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects negative page_number', () => {
    expect(() => validateSegmentationRegion({ page_number: -1 }, 0, 0)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects non-integer page_number', () => {
    expect(() => validateSegmentationRegion({ page_number: 1.5 }, 0, 0)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects region containing bbox_1000 (INV-2 / PO-2 guard)', () => {
    expect(() =>
      validateSegmentationRegion({ page_number: 1, bbox_1000: [0, 0, 500, 500] }, 0, 0),
    ).toThrow(
      expect.objectContaining({
        code: 'SEGMENTATION_SCHEMA_INVALID',
        message: expect.stringContaining('bbox_1000'),
      }),
    );
  });

  it('strips unknown extra fields and returns only page_number', () => {
    const result = validateSegmentationRegion({ page_number: 2, extra: 'foo' }, 0, 0);
    expect(result).toEqual({ page_number: 2 });
    expect('extra' in result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateSegmentationTarget
// ---------------------------------------------------------------------------

describe('validateSegmentationTarget', () => {
  const validTarget = {
    target_id: 'q_0001',
    target_type: 'question',
    regions: [{ page_number: 1 }],
  };

  it('accepts a valid target', () => {
    const result = validateSegmentationTarget(validTarget, 0, 2);
    expect(result.target_id).toBe('q_0001');
    expect(result.target_type).toBe('question');
    expect(result.regions).toEqual([{ page_number: 1 }]);
    expect(result.review_comment).toBeUndefined();
  });

  it('accepts a target with 2 regions (INV-3 max)', () => {
    const result = validateSegmentationTarget(
      { ...validTarget, regions: [{ page_number: 1 }, { page_number: 2 }] },
      0,
      2,
    );
    expect(result.regions).toHaveLength(2);
  });

  it('rejects a target with 3 regions when maxRegions=2 (INV-3)', () => {
    expect(() =>
      validateSegmentationTarget(
        {
          ...validTarget,
          regions: [{ page_number: 1 }, { page_number: 2 }, { page_number: 3 }],
        },
        0,
        2,
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'SEGMENTATION_SCHEMA_INVALID',
        message: expect.stringContaining('INV-3'),
      }),
    );
  });

  it('rejects empty regions array', () => {
    expect(() =>
      validateSegmentationTarget({ ...validTarget, regions: [] }, 0, 2),
    ).toThrow(expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }));
  });

  it('rejects missing target_id', () => {
    const { target_id: _, ...noId } = validTarget;
    expect(() => validateSegmentationTarget(noId, 0, 2)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects empty string target_id', () => {
    expect(() =>
      validateSegmentationTarget({ ...validTarget, target_id: '' }, 0, 2),
    ).toThrow(expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }));
  });

  it('rejects missing target_type', () => {
    const { target_type: _, ...noType } = validTarget;
    expect(() => validateSegmentationTarget(noType, 0, 2)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('accepts optional review_comment when it is a string (INV-4)', () => {
    const result = validateSegmentationTarget(
      { ...validTarget, review_comment: 'Possibly split across pages' },
      0,
      2,
    );
    expect(result.review_comment).toBe('Possibly split across pages');
  });

  it('rejects non-string review_comment', () => {
    expect(() =>
      validateSegmentationTarget({ ...validTarget, review_comment: 42 }, 0, 2),
    ).toThrow(expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }));
  });

  it('does not include review_comment when absent', () => {
    const result = validateSegmentationTarget(validTarget, 0, 2);
    expect('review_comment' in result).toBe(false);
  });

  it('rejects a region inside target that contains bbox_1000 (INV-2)', () => {
    expect(() =>
      validateSegmentationTarget(
        { ...validTarget, regions: [{ page_number: 1, bbox_1000: [0, 0, 500, 500] }] },
        0,
        2,
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'SEGMENTATION_SCHEMA_INVALID',
        message: expect.stringContaining('bbox_1000'),
      }),
    );
  });

  it('accepts finish_page_number and configured boolean extraction fields', () => {
    const result = validateSegmentationTarget(
      {
        ...validTarget,
        finish_page_number: 1,
        extraction_fields: { has_diagram: true },
      },
      0,
      2,
      {
        focusPageNumber: 1,
        extractionFields: [{
          key: 'has_diagram',
          label: 'Has Diagram',
          description: 'true if diagram appears',
          type: 'boolean',
        }],
      },
    );

    expect(result.finish_page_number).toBe(1);
    expect(result.extraction_fields).toEqual({ has_diagram: true });
  });

  it('rejects targets that do not finish on the focus page', () => {
    expect(() => validateSegmentationTarget(
      {
        ...validTarget,
        finish_page_number: 2,
      },
      0,
      2,
      { focusPageNumber: 1 },
    )).toThrow(expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }));
  });

  it('rejects missing or non-boolean configured extraction fields', () => {
    const fields = [{
      key: 'has_diagram',
      label: 'Has Diagram',
      description: 'true if diagram appears',
      type: 'boolean' as const,
    }];

    expect(() => validateSegmentationTarget(
      { ...validTarget, finish_page_number: 1 },
      0,
      2,
      { focusPageNumber: 1, extractionFields: fields },
    )).toThrow(expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }));

    expect(() => validateSegmentationTarget(
      {
        ...validTarget,
        finish_page_number: 1,
        extraction_fields: { has_diagram: 'yes' },
      },
      0,
      2,
      { focusPageNumber: 1, extractionFields: fields },
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
        regions: [{ page_number: 1 }],
      },
      {
        target_id: 'q_0002',
        target_type: 'question',
        regions: [{ page_number: 1 }, { page_number: 2 }],
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

  it('uses default maxRegionsPerTarget of 2 (INV-3)', () => {
    // 2 regions — should pass with default
    expect(() => validateSegmentationResult(validResult)).not.toThrow();
    // 3 regions — should fail with default
    expect(() =>
      validateSegmentationResult({
        run_id: 'run_test',
        targets: [
          {
            target_id: 'q_0001',
            target_type: 'question',
            regions: [
              { page_number: 1 },
              { page_number: 2 },
              { page_number: 3 },
            ],
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'SEGMENTATION_SCHEMA_INVALID',
        message: expect.stringContaining('INV-3'),
      }),
    );
  });

  it('respects a custom maxRegionsPerTarget parameter', () => {
    // With maxRegionsPerTarget=1, even 2 regions should fail
    expect(() =>
      validateSegmentationResult(
        {
          run_id: 'run_test',
          targets: [
            {
              target_id: 'q_0001',
              target_type: 'question',
              regions: [{ page_number: 1 }, { page_number: 2 }],
            },
          ],
        },
        1,
      ),
    ).toThrow(expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }));
  });

  it('confirms no bbox_1000 field is present in any validated region (PO-2)', () => {
    const result = validateSegmentationResult(validResult);
    for (const target of result.targets) {
      for (const region of target.regions) {
        expect('bbox_1000' in region).toBe(false);
      }
    }
  });

  it('propagates review_comment from target (INV-4: allowed in agent output)', () => {
    const withComment = {
      run_id: 'run_test',
      targets: [
        {
          target_id: 'q_0001',
          target_type: 'question',
          regions: [{ page_number: 1 }],
          review_comment: 'Unclear boundary near footer',
        },
      ],
    };
    const result = validateSegmentationResult(withComment);
    expect(result.targets[0].review_comment).toBe('Unclear boundary near footer');
  });
});
