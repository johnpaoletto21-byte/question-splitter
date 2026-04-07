"use strict";
/**
 * core/source-model — normalized shapes for PDF sources and prepared page images.
 *
 * Rule (INV-1): every PDF page is rendered into a PreparedPageImage before
 * segmentation or localization starts.  These types are the stable contracts
 * that downstream core modules consume.
 *
 * No provider SDK types appear here (supports INV-9 / PO-8).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreparedPageValidationError = void 0;
/**
 * Validation error thrown when a PreparedPageImage value violates a structural rule.
 * This is a domain-layer error — no provider types involved.
 */
class PreparedPageValidationError extends Error {
    constructor(reason, context) {
        const ctx = context ? ` Context: ${JSON.stringify(context)}` : '';
        super(`PREPARED_PAGE_INVALID: ${reason}.${ctx}`);
        this.code = 'PREPARED_PAGE_INVALID';
        this.name = 'PreparedPageValidationError';
    }
}
exports.PreparedPageValidationError = PreparedPageValidationError;
//# sourceMappingURL=types.js.map