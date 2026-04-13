/**
 * adapters/segmentation/gemini-segmenter/prompt.ts
 *
 * Constructs the segmentation prompt for Agent 1.
 *
 * The prompt is built from:
 *   - The target type and max region count from the active profile.
 *   - The ordered list of page numbers being analyzed.
 *   - Chunk context (start/end pages) for the current processing chunk.
 *   - An optional caller-supplied promptSnapshot.
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
 *
 * @param pages          Ordered prepared page images included in this call.
 * @param profile        The active crop target profile (target_type, max regions).
 * @param promptSnapshot Optional session instruction block. When empty, the built-in default is used.
 * @returns              Prompt text string to include as the first `text` part.
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

  const pageList = pages
    .map((p, i) => `  - Image ${i + 1}: Page ${p.page_number} (source: ${p.source_id})`)
    .join('\n');

  // Find the image index of the chunk start page (for chunk context instructions)
  const chunkStartImageIndex = options.chunkStartPage !== undefined
    ? pages.findIndex((p) => p.page_number === options.chunkStartPage) + 1
    : undefined;

  const chunkBlock = options.chunkStartPage !== undefined && options.chunkEndPage !== undefined
    ? `
## Chunk Context
- This chunk covers pages ${options.chunkStartPage} to ${options.chunkEndPage}.
- Return ALL questions that START in this chunk (i.e. whose question number header first appears in these images).
- A question "starts" where its question number header first appears.
- Include the full extent of each question within this chunk, even if it continues to the last image.
- Do NOT return questions whose header appeared before Image ${chunkStartImageIndex ?? 1} — those belong to a previous chunk.
- If you see a continuation of a previous question at the top of Image ${chunkStartImageIndex ?? 1} without a new question header, do NOT create a target for it.`
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
- Maximum page regions per target: ${profile.max_regions_per_target}
${chunkBlock}
${fieldBlock}

## Images provided (in order)
IMPORTANT: When specifying regions and finish_image_index, use the Image number (1, 2, 3...) from this list — NOT the document page number.
${pageList}
`;
}
