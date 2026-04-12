/**
 * core/prompt-config-store/store.ts
 *
 * Session-only in-memory prompt configuration store.
 *
 * Boundary rules (INV-7, INV-9, Boundary I):
 *   - NO persistent storage: no file writes, no database, no localStorage.
 *   - NO provider SDK imports.
 *   - State lives in this module's closure; it resets when the process restarts.
 *   - capturePromptSnapshot() returns a frozen object safe to attach to RunContext.
 *     Mid-run UI edits via setAgent1Prompt / setAgent2Prompt do not affect any
 *     snapshot already captured for an active run (PO-6 / INV-7).
 */

import type { PromptConfigState, PromptSnapshot } from './types';
import { DEFAULT_AGENT1_PROMPT, DEFAULT_AGENT2_PROMPT } from './default-prompts';

/**
 * Default prompts for both agents.
 * These are editable instruction blocks; adapters append run-specific context.
 */
const DEFAULT_STATE: PromptConfigState = {
  agent1Prompt: DEFAULT_AGENT1_PROMPT,
  agent2Prompt: DEFAULT_AGENT2_PROMPT,
};

/** Live session state — mutable only through the exported setters. */
let _state: PromptConfigState = { ...DEFAULT_STATE };

/**
 * Returns a shallow copy of the current session prompt state.
 * Mutations to the returned object do not affect the store.
 */
export function getPromptConfig(): PromptConfigState {
  return { ..._state };
}

/**
 * Updates the Agent 1 (segmenter) prompt for the current session.
 * Does not affect any active run — runs use their start-time snapshot.
 */
export function setAgent1Prompt(prompt: string): void {
  _state = { ..._state, agent1Prompt: prompt };
}

/**
 * Updates the Agent 2 (localizer) prompt for the current session.
 * Does not affect any active run — runs use their start-time snapshot.
 */
export function setAgent2Prompt(prompt: string): void {
  _state = { ..._state, agent2Prompt: prompt };
}

/**
 * Captures an immutable snapshot of the current prompt state.
 * Called by the orchestrator at run start (bootstrapRun).
 *
 * The returned object is frozen — downstream code cannot accidentally mutate it.
 * Mid-run edits via setAgent1Prompt / setAgent2Prompt do not change the snapshot.
 *
 * Satisfies: PO-6 / INV-7 — active run always uses its start-time prompts.
 */
export function capturePromptSnapshot(): PromptSnapshot {
  return Object.freeze({
    agent1Prompt: _state.agent1Prompt,
    agent2Prompt: _state.agent2Prompt,
    capturedAt: new Date().toISOString(),
  });
}

/**
 * Resets the store to default editable prompt text.
 * For use in tests only — not part of the production API.
 */
export function resetPromptConfig(): void {
  _state = { ...DEFAULT_STATE };
}
