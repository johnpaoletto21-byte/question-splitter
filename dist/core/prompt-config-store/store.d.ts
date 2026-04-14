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
/**
 * Returns a shallow copy of the current session prompt state.
 * Mutations to the returned object do not affect the store.
 */
export declare function getPromptConfig(): PromptConfigState;
/**
 * Updates the Agent 1 (segmenter) prompt for the current session.
 * Does not affect any active run — runs use their start-time snapshot.
 */
export declare function setAgent1Prompt(prompt: string): void;
/**
 * Updates the Agent 1.5 (reviewer) prompt for the current session.
 * Does not affect any active run — runs use their start-time snapshot.
 */
export declare function setReviewerPrompt(prompt: string): void;
/**
 * Updates the Agent 3 (localizer) prompt for the current session.
 * Does not affect any active run — runs use their start-time snapshot.
 */
export declare function setAgent2Prompt(prompt: string): void;
/**
 * Updates the Agent 4 (deduplicator) prompt for the current session.
 * Does not affect any active run — runs use their start-time snapshot.
 */
export declare function setDeduplicatorPrompt(prompt: string): void;
/**
 * Updates the Agent H1 (hint image generation) prompt for the current session.
 */
export declare function setHintImageGenPrompt(prompt: string): void;
/**
 * Updates the Agent H2 (hint overlay / JSON annotation) prompt for the current session.
 */
export declare function setHintOverlayPrompt(prompt: string): void;
/**
 * Updates the Agent H3 (hint blend render) prompt for the current session.
 */
export declare function setHintBlendRenderPrompt(prompt: string): void;
/**
 * Captures an immutable snapshot of the current prompt state.
 * Called by the orchestrator at run start (bootstrapRun).
 *
 * The returned object is frozen — downstream code cannot accidentally mutate it.
 * Mid-run edits via setAgent1Prompt / setAgent2Prompt do not change the snapshot.
 *
 * Satisfies: PO-6 / INV-7 — active run always uses its start-time prompts.
 */
export declare function capturePromptSnapshot(): PromptSnapshot;
/**
 * Resets the store to default editable prompt text.
 * For use in tests only — not part of the production API.
 */
export declare function resetPromptConfig(): void;
//# sourceMappingURL=store.d.ts.map