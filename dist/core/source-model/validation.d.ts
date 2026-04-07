import { PreparedPageImage } from './types';
/**
 * Validate a PreparedPageImage value against the structural rules required
 * by the Boundary A output contract.
 *
 * Throws `PreparedPageValidationError` on the first violation found.
 * Callers (orchestrator, tests) may catch and surface this to run summary.
 */
export declare function validatePreparedPageImage(page: PreparedPageImage): void;
/**
 * Validate all pages in a list and throw on the first invalid page.
 * Also throws if the list is empty (no pages to work on is a logic error).
 */
export declare function validatePreparedPageImages(pages: PreparedPageImage[]): void;
//# sourceMappingURL=validation.d.ts.map