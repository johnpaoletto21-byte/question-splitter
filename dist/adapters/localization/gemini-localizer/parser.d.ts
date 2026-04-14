/**
 * adapters/localization/gemini-localizer/parser.ts
 *
 * Parses the raw Gemini structured output from a window localization call
 * into WindowLocalizationResult.
 *
 * Agent 3 receives 1-3 images and identifies which questions appear in them.
 * It returns image_position (1/2/3) which we map deterministically to
 * page_number using the windowPages array.
 *
 * Validates bbox_1000 constraints (shape, range, non-inversion).
 */
import type { PreparedPageImage } from '../../../core/source-model/types';
import type { WindowLocalizationResult } from './window-result';
/**
 * Parses the raw Gemini window localization response.
 *
 * Maps image_position (1/2/3) → windowPages[position-1].page_number.
 * This is deterministic and cannot fail (bounded to window size).
 *
 * @param raw          The parsed JSON from Gemini's response body.
 * @param runId        The run_id for the current run.
 * @param windowPages  The ordered PreparedPageImage[] sent in this window.
 * @returns            Validated WindowLocalizationResult.
 */
export declare function parseWindowLocalizationResponse(raw: unknown, runId: string, windowPages: ReadonlyArray<PreparedPageImage>): WindowLocalizationResult;
//# sourceMappingURL=parser.d.ts.map