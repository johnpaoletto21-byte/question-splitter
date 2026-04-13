/**
 * core/prompt-config-store/types.ts
 *
 * Type contracts for the session-only prompt configuration store.
 *
 * Session-only rule (INV-7 / PO-6): prompt state is held in memory for the
 * current app session only. No persistent storage — no localStorage, no
 * database write, no file I/O in this module. State resets every process start.
 */
/**
 * The live (mutable) prompt state for the current session.
 * Edited by the user via the local app UI.
 * Used to capture an immutable PromptSnapshot at run start.
 */
export interface PromptConfigState {
    /** Current Agent 1 (segmenter) editable instruction block. Empty string means use built-in. */
    agent1Prompt: string;
    /** Current Agent 1.5 (reviewer) editable instruction block. Empty string means use built-in. */
    reviewerPrompt: string;
    /** Current Agent 2 (localizer) editable instruction block. Empty string means use built-in. */
    agent2Prompt: string;
}
/**
 * Immutable copy of prompt state captured at the moment a run starts.
 *
 * Once captured, this object must not change for the lifetime of the run.
 * Mid-run UI edits to the store do not affect any active run's snapshot (INV-7).
 */
export interface PromptSnapshot {
    /** Agent 1 prompt at run-start time. */
    readonly agent1Prompt: string;
    /** Agent 1.5 (reviewer) prompt at run-start time. */
    readonly reviewerPrompt: string;
    /** Agent 2 prompt at run-start time. */
    readonly agent2Prompt: string;
    /** ISO-8601 timestamp when this snapshot was captured. */
    readonly capturedAt: string;
}
//# sourceMappingURL=types.d.ts.map