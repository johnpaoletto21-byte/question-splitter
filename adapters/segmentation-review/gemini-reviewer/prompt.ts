/**
 * adapters/segmentation-review/gemini-reviewer/prompt.ts
 *
 * Constructs the review prompt for Agent 2 (reviewer).
 * Now operates per-chunk (receives chunk's pages and chunk's segmentation output).
 */

import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { SegmentationResult } from '../../../core/segmentation-contract/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import { DEFAULT_REVIEWER_PROMPT } from '../../../core/prompt-config-store/default-prompts';

export interface BuildReviewPromptOptions {
  extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
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
    .map((p) => `  - Page ${p.page_number} (source: ${p.source_id})`)
    .join('\n');

  const targetsJson = JSON.stringify(segmentationResult.targets, null, 2);

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

## Pages provided (in order)
${pageList}

## Agent 1 Segmentation Output (to review)
${targetsJson}
`;
}
