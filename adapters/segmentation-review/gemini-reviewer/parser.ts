/**
 * adapters/segmentation-review/gemini-reviewer/parser.ts
 *
 * Parses the Gemini reviewer output into null (pass) or SegmentationResult (corrected).
 * Same validation as Agent 1 via validateSegmentationResult.
 *
 * Agent 1 and Reviewer now produce question inventories (no regions).
 */

import { validateSegmentationResult } from '../../../core/segmentation-contract/validation';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';

export interface ParseGeminiReviewOptions {
  extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function makeTargetId(index: number): string {
  return `q_${String(index + 1).padStart(4, '0')}`;
}

export interface ParsedReviewResult {
  segmentation: SegmentationResult | null;
  answerSheetPages: number[];
}

export function parseGeminiReviewResponse(
  raw: unknown,
  runId: string,
  maxRegionsPerTarget: number = 10,
  options: ParseGeminiReviewOptions = {},
): ParsedReviewResult {
  if (!isObject(raw)) {
    throw new Error('Gemini review response must be an object');
  }

  const verdict = raw['verdict'];
  if (verdict !== 'pass' && verdict !== 'corrected') {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: `Review verdict must be "pass" or "corrected", received: ${JSON.stringify(verdict)}`,
    };
  }

  // Parse answer_sheet_pages (available for both verdicts)
  const answerSheetPages: number[] = Array.isArray(raw['answer_sheet_pages'])
    ? (raw['answer_sheet_pages'] as unknown[]).filter((v): v is number => typeof v === 'number' && Number.isInteger(v))
    : [];

  if (verdict === 'pass') {
    return { segmentation: null, answerSheetPages };
  }

  if (!Array.isArray(raw['targets'])) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: 'Review verdict is "corrected" but targets array is missing',
    };
  }

  const rawTargets = raw['targets'] as Array<Record<string, unknown>>;

  const targets = rawTargets.map((t, i) => {
    const target: Record<string, unknown> = {
      target_id: makeTargetId(i),
      target_type: t['target_type'],
    };

    if (t['extraction_fields'] !== undefined) {
      target['extraction_fields'] = t['extraction_fields'];
    }

    if (typeof t['review_comment'] === 'string') {
      target['review_comment'] = t['review_comment'];
    }

    if (typeof t['question_number'] === 'string') {
      target['question_number'] = t['question_number'];
    }
    if (typeof t['question_text'] === 'string') {
      target['question_text'] = t['question_text'];
    }
    if (Array.isArray(t['sub_questions'])) {
      target['sub_questions'] = t['sub_questions'];
    }

    return target;
  });

  const normalized = { run_id: runId, targets };

  const validated = validateSegmentationResult(normalized, {
    extractionFields: options.extractionFields,
  });

  return {
    segmentation: validated
      ? { ...validated, answer_sheet_pages: answerSheetPages.length > 0 ? answerSheetPages : undefined }
      : null,
    answerSheetPages,
  };
}
