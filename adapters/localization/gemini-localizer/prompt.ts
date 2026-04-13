/**
 * adapters/localization/gemini-localizer/prompt.ts
 *
 * Constructs the localization prompt for Agent 3 (Region Localizer).
 *
 * The prompt scopes the model to ONE target at a time.
 * Includes question_text context (with inline diagram notes) to help the
 * localizer understand what content to encompass.
 */

import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationTarget } from '../../../core/segmentation-contract/types';
import { DEFAULT_AGENT2_PROMPT } from '../../../core/prompt-config-store/default-prompts';

/**
 * Builds the text portion of the Gemini localization prompt for one target.
 */
export function buildLocalizationPrompt(
  target: SegmentationTarget,
  profile: CropTargetProfile,
  promptSnapshot: string,
): string {
  const instructionBlock = promptSnapshot.trim() !== ''
    ? promptSnapshot.trim()
    : DEFAULT_AGENT2_PROMPT;

  const regionList = target.regions
    .map((r, i) => `  - Region ${i + 1}: Page ${r.page_number}`)
    .join('\n');

  const questionContext = target.question_text
    ? `- Question text preview: ${target.question_text}`
    : '';

  return `${instructionBlock}

## Run Context
- Target ID: ${target.target_id}
- Target type: ${profile.target_type}
- Question number: ${target.question_number ?? '(unknown)'}
${questionContext}
- Finish page: ${target.finish_page_number ?? Math.max(...target.regions.map((r) => r.page_number))}
- You may receive the previous page as context. Return bbox entries only for the page regions listed below.
- Page regions to localize (in order):
${regionList}
`;
}
