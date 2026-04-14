/**
 * adapters/segmentation-review/gemini-reviewer/__tests__/parser.test.ts
 *
 * Unit tests for the Gemini reviewer response parser.
 *
 * Proves:
 *   - "pass" verdict returns null.
 *   - "corrected" verdict parses targets with sequential IDs.
 *   - question_number / question_text / sub_questions passthrough.
 *   - extraction_fields passthrough.
 *   - Invalid verdicts and missing targets are rejected.
 */

import { parseGeminiReviewResponse } from '../parser';

const RUN_ID = 'run_2024-01-01_testrun1';

describe('parseGeminiReviewResponse', () => {
  it('returns null segmentation for verdict "pass"', () => {
    const result = parseGeminiReviewResponse({ verdict: 'pass' }, RUN_ID);
    expect(result.segmentation).toBeNull();
    expect(result.answerSheetPages).toEqual([]);
  });

  it('parses a corrected single-target response', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          question_number: '1',
          question_text: 'What is X?',
          sub_questions: [],
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID);
    expect(result.segmentation).not.toBeNull();
    expect(result.segmentation!.run_id).toBe(RUN_ID);
    expect(result.segmentation!.targets).toHaveLength(1);
    expect(result.segmentation!.targets[0].target_id).toBe('q_0001');
    expect(result.segmentation!.targets[0].target_type).toBe('question');
  });

  it('assigns sequential target_ids in reading order', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        { target_type: 'question', question_number: '1', question_text: 'Q1', sub_questions: [] },
        { target_type: 'question', question_number: '2', question_text: 'Q2', sub_questions: [] },
        { target_type: 'question', question_number: '3', question_text: 'Q3', sub_questions: [] },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID);
    expect(result.segmentation!.targets[0].target_id).toBe('q_0001');
    expect(result.segmentation!.targets[1].target_id).toBe('q_0002');
    expect(result.segmentation!.targets[2].target_id).toBe('q_0003');
  });

  it('passes through question metadata', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          question_number: '問3',
          question_text: 'Solve the equation.',
          sub_questions: ['(1)', '(2)'],
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID);
    expect(result.segmentation!.targets[0].question_number).toBe('問3');
    expect(result.segmentation!.targets[0].question_text).toBe('Solve the equation.');
    expect(result.segmentation!.targets[0].sub_questions).toEqual(['(1)', '(2)']);
  });

  it('propagates review_comment when present', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          question_number: '1',
          question_text: 'Q1',
          sub_questions: [],
          review_comment: 'Merged two split targets',
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID);
    expect(result.segmentation!.targets[0].review_comment).toBe('Merged two split targets');
  });

  it('propagates extraction_fields when present', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        {
          target_type: 'question',
          question_number: '1',
          question_text: 'Q1',
          sub_questions: [],
          extraction_fields: { has_diagram: true },
        },
      ],
    };
    const result = parseGeminiReviewResponse(raw, RUN_ID, undefined, {
      extractionFields: [{
        key: 'has_diagram',
        label: 'Has Diagram',
        description: 'true if diagram appears',
        type: 'boolean',
      }],
    });
    expect(result.segmentation!.targets[0].extraction_fields).toEqual({ has_diagram: true });
  });

  it('rejects non-object raw input', () => {
    expect(() => parseGeminiReviewResponse(null, RUN_ID)).toThrow();
    expect(() => parseGeminiReviewResponse('string', RUN_ID)).toThrow();
  });

  it('rejects invalid verdict', () => {
    expect(() => parseGeminiReviewResponse({ verdict: 'invalid' }, RUN_ID)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('rejects "corrected" verdict without targets array', () => {
    expect(() => parseGeminiReviewResponse({ verdict: 'corrected' }, RUN_ID)).toThrow(
      expect.objectContaining({ code: 'SEGMENTATION_SCHEMA_INVALID' }),
    );
  });

  it('uses the provided run_id in the result', () => {
    const raw = {
      verdict: 'corrected',
      targets: [
        { target_type: 'question', question_number: '1', question_text: 'Q1', sub_questions: [] },
      ],
    };
    const result = parseGeminiReviewResponse(raw, 'run_custom_id');
    expect(result.segmentation!.run_id).toBe('run_custom_id');
  });
});

// ---------------------------------------------------------------------------
// answer_sheet_pages
// ---------------------------------------------------------------------------

describe('parseGeminiReviewResponse — answer_sheet_pages', () => {
  it('parses answer_sheet_pages from "pass" verdict', () => {
    const result = parseGeminiReviewResponse(
      { verdict: 'pass', answer_sheet_pages: [10, 12] },
      RUN_ID,
    );
    expect(result.segmentation).toBeNull();
    expect(result.answerSheetPages).toEqual([10, 12]);
  });

  it('parses answer_sheet_pages from "corrected" verdict', () => {
    const result = parseGeminiReviewResponse(
      {
        verdict: 'corrected',
        targets: [
          { target_type: 'question', question_number: '1', question_text: 'Q1', sub_questions: [] },
        ],
        answer_sheet_pages: [8],
      },
      RUN_ID,
    );
    expect(result.segmentation!.answer_sheet_pages).toEqual([8]);
    expect(result.answerSheetPages).toEqual([8]);
  });

  it('defaults to empty array when answer_sheet_pages is missing', () => {
    const result = parseGeminiReviewResponse({ verdict: 'pass' }, RUN_ID);
    expect(result.answerSheetPages).toEqual([]);
  });

  it('filters out non-integer values from answer_sheet_pages', () => {
    const result = parseGeminiReviewResponse(
      { verdict: 'pass', answer_sheet_pages: [1, 'bad', 3.5, 4, null] },
      RUN_ID,
    );
    expect(result.answerSheetPages).toEqual([1, 4]);
  });
});
