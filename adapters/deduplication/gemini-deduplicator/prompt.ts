/**
 * adapters/deduplication/gemini-deduplicator/prompt.ts
 *
 * Constructs the deduplication prompt for Agent 4.
 * This is a text-only agent — receives JSON, no images.
 */

import type { DeduplicationInput } from '../../../core/deduplication-contract/types';
import { DEFAULT_DEDUPLICATOR_PROMPT } from '../../../core/prompt-config-store/default-prompts';

/**
 * Builds the text prompt for the deduplication agent.
 */
export function buildDeduplicationPrompt(
  input: DeduplicationInput,
  promptSnapshot: string,
): string {
  const instructionBlock = promptSnapshot.trim() !== ''
    ? promptSnapshot.trim()
    : DEFAULT_DEDUPLICATOR_PROMPT;

  const inputJson = JSON.stringify(
    {
      chunks: input.chunks,
      overlap_zones: input.overlap_zones,
    },
    null,
    2,
  );

  return `${instructionBlock}

## Input Data
${inputJson}

Analyze the input and return the deduplicated targets with a merge log.`;
}
