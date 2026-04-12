/**
 * adapters/localization/gemini-localizer/prompt.ts
 *
 * Constructs the localization prompt for Agent 2 (Region Localizer).
 *
 * The prompt is built from:
 *   - The single target being localized (target_id and its page regions).
 *   - The active crop target profile (for context on target_type).
 *   - An optional caller-supplied promptSnapshot (TASK-502 will wire this;
 *     when empty the built-in prompt text is used).
 *
 * Design:
 *   - The prompt scopes the model to ONE target at a time (per Boundary E).
 *   - It explicitly provides the expected page_numbers so the model can
 *     confirm its regions match what Agent 1 identified.
 *   - No provider SDK imports — pure string construction.
 */

import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { SegmentationTarget } from '../../../core/segmentation-contract/types';
import { DEFAULT_AGENT2_PROMPT } from '../../../core/prompt-config-store/default-prompts';

/**
 * Builds the text portion of the Gemini localization prompt for one target.
 *
 * @param target         The Agent 1 segmentation target to localize.
 * @param profile        The active crop target profile (provides target_type context).
 * @param promptSnapshot Optional session instruction block (from TASK-502 prompt store).
 *                       When empty, the built-in default instruction block is used.
 * @returns              Prompt text string to include as the first `text` part.
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

  return `${instructionBlock}

## Run Context
- Target ID: ${target.target_id}
- Target type: ${profile.target_type}
- Page regions to localize (in order):
${regionList}
`;
}
