/**
 * adapters/segmentation/gemini-segmenter/__tests__/parser.test.ts
 *
 * Unit tests for the Gemini response parser.
 *
 * Proves:
 *   - Sequential target_id assignment in reading order.
 *   - question_number / question_text / sub_questions passthrough.
 *   - review_comment flows through (INV-4).
 *   - extraction_fields passthrough.
 *   - Invalid raw response rejected with typed error.
 */

import { parseGeminiSegmentationResponse } from '../parser';

const RUN_ID = 'run_2024-01-01_testrun1';

describe('parseGeminiSegmentationResponse', () => {
  it('parses a valid single-target response', () => {
    const raw = {
      targets: [
        { target_type: 'question', question_number: '1', question_text: 'What is X?', sub_questions: [] },
      ],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID);
    expect(result.run_id).toBe(RUN_ID);
    expect(result.targets).toHaveLength(1);
    expect(result.targets[0].target_id).toBe('q_0001');
    expect(result.targets[0].target_type).toBe('question');
  });

  it('assigns sequential target_ids in reading order (q_0001, q_0002, q_0003)', () => {
    const raw = {
      targets: [
        { target_type: 'question', question_number: '1', question_text: 'Q1', sub_questions: [] },
        { target_type: 'question', question_number: '2', question_text: 'Q2', sub_questions: [] },
        { target_type: 'question', question_number: '3', question_text: 'Q3', sub_questions: [] },
      ],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID);
    expect(result.targets[0].target_id).toBe('q_0001');
    expect(result.targets[1].target_id).toBe('q_0002');
    expect(result.targets[2].target_id).toBe('q_0003');
  });

  it('passes through question_number, question_text, and sub_questions', () => {
    const raw = {
      targets: [
        {
          target_type: 'question',
          question_number: '問3',
          question_text: 'Solve for x in the following equation.',
          sub_questions: ['(1)', '(2)', '(3)'],
        },
      ],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID);
    expect(result.targets[0].question_number).toBe('問3');
    expect(result.targets[0].question_text).toBe('Solve for x in the following equation.');
    expect(result.targets[0].sub_questions).toEqual(['(1)', '(2)', '(3)']);
  });

  it('propagates review_comment when present (INV-4: visible in agent output)', () => {
    const raw = {
      targets: [
        {
          target_type: 'question',
          question_number: '1',
          question_text: 'Q1',
          sub_questions: [],
          review_comment: 'Boundary unclear near footer',
        },
      ],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID);
    expect(result.targets[0].review_comment).toBe('Boundary unclear near footer');
  });

  it('does not include review_comment when absent', () => {
    const raw = {
      targets: [{ target_type: 'question', question_number: '1', question_text: 'Q1', sub_questions: [] }],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID);
    expect('review_comment' in result.targets[0]).toBe(false);
  });

  it('rejects non-object raw input', () => {
    expect(() => parseGeminiSegmentationResponse(null, RUN_ID)).toThrow();
    expect(() => parseGeminiSegmentationResponse('string', RUN_ID)).toThrow();
  });

  it('rejects raw input missing targets array', () => {
    expect(() => parseGeminiSegmentationResponse({ other: 'field' }, RUN_ID)).toThrow();
  });

  it('pads target_id to 4 digits (q_0001 not q_1)', () => {
    const raw = {
      targets: [{ target_type: 'question', question_number: '1', question_text: 'Q1', sub_questions: [] }],
    };
    const result = parseGeminiSegmentationResponse(raw, RUN_ID);
    expect(result.targets[0].target_id).toMatch(/^q_\d{4}$/);
  });

  it('uses the provided run_id in the result', () => {
    const raw = { targets: [{ target_type: 'question', question_number: '1', question_text: 'Q1', sub_questions: [] }] };
    const customRunId = 'run_2024-12-01_custom99';
    const result = parseGeminiSegmentationResponse(raw, customRunId);
    expect(result.run_id).toBe(customRunId);
  });

  it('validates extraction fields when options are provided', () => {
    const raw = {
      targets: [{
        target_type: 'question',
        question_number: '1',
        question_text: 'Q1',
        sub_questions: [],
        extraction_fields: { has_diagram: false },
      }],
    };

    const result = parseGeminiSegmentationResponse(raw, RUN_ID, {
      extractionFields: [{
        key: 'has_diagram',
        label: 'Has Diagram',
        description: 'true if diagram appears',
        type: 'boolean',
      }],
    });

    expect(result.targets[0].extraction_fields).toEqual({ has_diagram: false });
  });

  it('accepts an empty target list', () => {
    const result = parseGeminiSegmentationResponse({ targets: [] }, RUN_ID);
    expect(result.targets).toEqual([]);
  });
});
