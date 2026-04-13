/**
 * adapters/segmentation-review/gemini-reviewer/parser.ts
 *
 * Parses the Gemini reviewer output into null (pass) or SegmentationResult (corrected).
 * Same validation as Agent 1 via validateSegmentationResult.
 */

import { validateSegmentationResult } from '../../../core/segmentation-contract/validation';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';

export interface ParseGeminiReviewOptions {
  extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}

/**
 * Maps a 1-based image index to the corresponding page_number.
 */
function imageIndexToPageNumber(imageIndex: unknown, pages: ReadonlyArray<PreparedPageImage>): number {
  const coerced = typeof imageIndex === 'string' ? Number(imageIndex) : Number(imageIndex);
  if (!Number.isInteger(coerced) || coerced < 1 || coerced > pages.length) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message:
        `image_index ${imageIndex} is out of range — ` +
        `expected 1..${pages.length} (${pages.length} images were provided)`,
    };
  }
  return pages[coerced - 1].page_number;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function makeTargetId(index: number): string {
  return `q_${String(index + 1).padStart(4, '0')}`;
}

export function parseGeminiReviewResponse(
  raw: unknown,
  runId: string,
  pages: ReadonlyArray<PreparedPageImage>,
  maxRegionsPerTarget: number = 10,
  options: ParseGeminiReviewOptions = {},
): SegmentationResult | null {
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

  if (verdict === 'pass') {
    return null;
  }

  if (!Array.isArray(raw['targets'])) {
    throw {
      code: 'SEGMENTATION_SCHEMA_INVALID',
      message: 'Review verdict is "corrected" but targets array is missing',
    };
  }

  const rawTargets = raw['targets'] as Array<Record<string, unknown>>;

  const targets = rawTargets.map((t, i) => {
    // Map image_index → page_number using the pages array
    const regions = Array.isArray(t['regions'])
      ? (t['regions'] as Array<Record<string, unknown>>).map((r) => ({
          page_number: imageIndexToPageNumber(r['image_index'], pages),
        }))
      : t['regions'];

    const target: Record<string, unknown> = {
      target_id: makeTargetId(i),
      target_type: t['target_type'],
      regions,
    };

    const rawFinish = t['finish_image_index'];
    if (rawFinish !== undefined) {
      target['finish_page_number'] = imageIndexToPageNumber(rawFinish, pages);
    }

    if (t['extraction_fields'] !== undefined) {
      target['extraction_fields'] = t['extraction_fields'];
    }

    if (typeof t['review_comment'] === 'string') {
      target['review_comment'] = t['review_comment'];
    }

    // New fields
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

  return validateSegmentationResult(normalized, maxRegionsPerTarget, {
    extractionFields: options.extractionFields,
  });
}
