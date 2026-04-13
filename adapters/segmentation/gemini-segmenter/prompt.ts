/**
 * adapters/segmentation/gemini-segmenter/prompt.ts
 *
 * Constructs the segmentation prompt for Agent 1.
 *
 * Agent 1 produces a question inventory — an ordered list of questions.
 * No page/region information is requested from the model.
 *
 * No provider SDK imports — this is pure string construction.
 */

import type { CropTargetProfile } from '../../../core/crop-target-profile/types';
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { ExtractionFieldDefinition } from '../../../core/extraction-fields';
import { DEFAULT_AGENT1_PROMPT } from '../../../core/prompt-config-store/default-prompts';

export interface BuildSegmentationPromptOptions {
  /** First page number in the current chunk. */
  chunkStartPage?: number;
  /** Last page number in the current chunk. */
  chunkEndPage?: number;
  extractionFields?: ReadonlyArray<ExtractionFieldDefinition>;
}

/**
 * Builds the text portion of the Gemini segmentation prompt.
 */
export function buildSegmentationPrompt(
  pages: PreparedPageImage[],
  profile: CropTargetProfile,
  promptSnapshot: string,
  options: BuildSegmentationPromptOptions = {},
): string {
  const instructionBlock = promptSnapshot.trim() !== ''
    ? promptSnapshot.trim()
    : DEFAULT_AGENT1_PROMPT;

  const chunkBlock = options.chunkStartPage !== undefined && options.chunkEndPage !== undefined
    ? `
## Chunk Context
- This chunk covers pages ${options.chunkStartPage} to ${options.chunkEndPage}.
- Return ALL questions that START in this chunk (i.e. whose question number header first appears in these images).
- A question "starts" where its question number header first appears.
- Do NOT return questions whose header appeared before the first image — those belong to a previous chunk.
- If you see a continuation of a previous question at the top of the first image without a new question header, do NOT create a target for it.`
    : '';

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
- Number of page images provided: ${pages.length}
${chunkBlock}
${fieldBlock}
`;
}
