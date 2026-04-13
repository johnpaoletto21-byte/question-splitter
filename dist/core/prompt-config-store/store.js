"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPromptConfig = getPromptConfig;
exports.setAgent1Prompt = setAgent1Prompt;
exports.setReviewerPrompt = setReviewerPrompt;
exports.setAgent2Prompt = setAgent2Prompt;
exports.capturePromptSnapshot = capturePromptSnapshot;
exports.resetPromptConfig = resetPromptConfig;
const default_prompts_1 = require("./default-prompts");
/**
 * Default prompts for both agents.
 * These are editable instruction blocks; adapters append run-specific context.
 */
const DEFAULT_STATE = {
    agent1Prompt: default_prompts_1.DEFAULT_AGENT1_PROMPT,
    reviewerPrompt: default_prompts_1.DEFAULT_REVIEWER_PROMPT,
    agent2Prompt: default_prompts_1.DEFAULT_AGENT2_PROMPT,
};
/** Live session state — mutable only through the exported setters. */
let _state = { ...DEFAULT_STATE };
/**
 * Returns a shallow copy of the current session prompt state.
 * Mutations to the returned object do not affect the store.
 */
function getPromptConfig() {
    return { ..._state };
}
/**
 * Updates the Agent 1 (segmenter) prompt for the current session.
 * Does not affect any active run — runs use their start-time snapshot.
 */
function setAgent1Prompt(prompt) {
    _state = { ..._state, agent1Prompt: prompt };
}
/**
 * Updates the Agent 1.5 (reviewer) prompt for the current session.
 * Does not affect any active run — runs use their start-time snapshot.
 */
function setReviewerPrompt(prompt) {
    _state = { ..._state, reviewerPrompt: prompt };
}
/**
 * Updates the Agent 2 (localizer) prompt for the current session.
 * Does not affect any active run — runs use their start-time snapshot.
 */
function setAgent2Prompt(prompt) {
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
function capturePromptSnapshot() {
    return Object.freeze({
        agent1Prompt: _state.agent1Prompt,
        reviewerPrompt: _state.reviewerPrompt,
        agent2Prompt: _state.agent2Prompt,
        capturedAt: new Date().toISOString(),
    });
}
/**
 * Resets the store to default editable prompt text.
 * For use in tests only — not part of the production API.
 */
function resetPromptConfig() {
    _state = { ...DEFAULT_STATE };
}
//# sourceMappingURL=store.js.map