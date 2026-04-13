/**
 * adapters/segmentation-review/gemini-reviewer/prompt.ts
 *
 * Constructs the review prompt for Agent 2 (reviewer).
 * Now operates per-chunk (receives chunk's pages and chunk's segmentation output).
 *
 * The reviewer works in image-index space (same as Agent 1). The prompt
 * converts Agent 1's parsed targets (which have page_number) back to
 * image_index form so the reviewer can verify and correct using image positions.
 */

import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { SegmentationResult, SegmentationTarget } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import { DEFAULT_REVIEWER_PROMPT } from '../../../core/prompt-config-store/default-prompts';

export interface BuildReviewPromptOptions {
  extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}

/**
 * Converts a target's page_number values back to image_index values
 * for display in the reviewer prompt. The reviewer works in image-index
 * space to avoid the same page-number confusion that Agent 1 can have.
 */
function targetToImageIndexForm(
  target: SegmentationTarget,
  pages: ReadonlyArray<PreparedPageImage>,
): Record<string, unknown> {
  const pageToIndex = new Map<number, number>();
  pages.forEach((p, i) => pageToIndex.set(p.page_number, i + 1));

  const regions = target.regions.map((r) => ({
    image_index: pageToIndex.get(r.page_number) ?? r.page_number,
  }));

  const result: Record<string, unknown> = {
    target_id: target.target_id,
    target_type: target.target_type,
    regions,
  };
  if (target.finish_page_number !== undefined) {
    result['finish_image_index'] = pageToIndex.get(target.finish_page_number) ?? target.finish_page_number;
  }
  if (target.question_number !== undefined) result['question_number'] = target.question_number;
  if (target.question_text !== undefined) result['question_text'] = target.question_text;
  if (target.sub_questions !== undefined) result['sub_questions'] = target.sub_questions;
  if (target.extraction_fields !== undefined) result['extraction_fields'] = target.extraction_fields;
  if (target.review_comment !== undefined) result['review_comment'] = target.review_comment;
  return result;
}

export function buildReviewPrompt(
  pages: PreparedPageImage[],
  profile: CropTargetProfile,
  promptSnapshot: string,
  segmentationResult: SegmentationResult,
  options: BuildReviewPromptOptions = {},
): string {
  const instructionBlock = promptSnapshot.trim() !== ''
    ? promptSnapshot.trim()
    : DEFAULT_REVIEWER_PROMPT;

  const pageList = pages
    .map((p, i) => `  - Image ${i + 1}: Page ${p.page_number} (source: ${p.source_id})`)
    .join('\n');

  // Convert targets to image-index form for the reviewer
  const imageIndexTargets = segmentationResult.targets.map((t) => targetToImageIndexForm(t, pages));
  const targetsJson = JSON.stringify(imageIndexTargets, null, 2);

  const extractionFields = options.extractionFields ?? [];
  const fieldBlock = extractionFields.length === 0
    ? ''
    : `

## Custom Boolean Extraction Fields
For every returned target, include extraction_fields with exactly these boolean keys:
${extractionFields.map((field) => `- ${field.key}: ${field.description}`).join('\n')}`;

  return `${instructionBlock}

## Run Context
- Target type: ${profile.target_type}
- Maximum page regions per target: ${profile.max_regions_per_target}
${fieldBlock}

## Images provided (in order)
IMPORTANT: When specifying regions and finish_image_index, use the Image number (1, 2, 3...) from this list — NOT the document page number.
${pageList}

## Agent 1 Segmentation Output (to review)
${targetsJson}
`;
}
