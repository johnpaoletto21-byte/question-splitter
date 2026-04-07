"use strict";
/**
 * core/run-orchestrator/render-step.ts
 *
 * Orchestrator step that converts all PDF sources in a RunContext into
 * PreparedPageImage entries and attaches them to the context.
 *
 * Design:
 *   - The actual renderer is injected as a `PageRenderer` function so that
 *     core stays free of provider SDK imports (INV-9 / PO-8).
 *   - `adapters/source-preparation/pdf-renderer` implements this interface.
 *   - All pages from all sources are validated via core/source-model before
 *     the enriched context is returned.
 *
 * This step satisfies the INV-1 rule: PreparedPageImage[] is populated
 * before any downstream agent or crop work begins.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderAllSources = renderAllSources;
const validation_1 = require("../source-model/validation");
/**
 * Render all PDF sources in `context` and return an updated context with
 * `preparedPages` populated.
 *
 * Pages from all sources are accumulated in source order (input_order
 * determines iteration order), then validated as a group.
 *
 * @param context  A RunContext whose `sources` list has been built by bootstrapRun.
 * @param renderer The adapter function that performs the actual PDF-to-PNG render.
 * @returns        A new RunContext object with `preparedPages` set.
 * @throws         Re-throws any error from the renderer or validation.
 */
async function renderAllSources(context, renderer) {
    const allPages = [];
    for (const source of context.sources) {
        const pages = await renderer(source, context.config.OUTPUT_DIR);
        allPages.push(...pages);
    }
    // Core validation — rejects empty list, negative dimensions, etc.
    (0, validation_1.validatePreparedPageImages)(allPages);
    return { ...context, preparedPages: allPages };
}
//# sourceMappingURL=render-step.js.map