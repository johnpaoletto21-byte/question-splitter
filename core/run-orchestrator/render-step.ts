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

import type { PdfSource, PreparedPageImage } from '../source-model/types';
import { validatePreparedPageImages } from '../source-model/validation';
import type { RunContext } from './types';

/**
 * Contract for a PDF renderer function.
 * Implemented in `adapters/source-preparation/pdf-renderer`.
 * Kept here so core can accept and type-check the dependency without
 * importing any provider SDK.
 */
export type PageRenderer = (
  source: PdfSource,
  outputDir: string,
) => Promise<PreparedPageImage[]>;

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
export async function renderAllSources(
  context: RunContext,
  renderer: PageRenderer,
): Promise<RunContext & { preparedPages: PreparedPageImage[] }> {
  const allPages: PreparedPageImage[] = [];

  for (const source of context.sources) {
    const pages = await renderer(source, context.config.OUTPUT_DIR);
    allPages.push(...pages);
  }

  // Core validation — rejects empty list, negative dimensions, etc.
  validatePreparedPageImages(allPages);

  return { ...context, preparedPages: allPages };
}
