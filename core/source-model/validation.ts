import { PreparedPageImage, PreparedPageValidationError } from './types';

/**
 * Validate a PreparedPageImage value against the structural rules required
 * by the Boundary A output contract.
 *
 * Throws `PreparedPageValidationError` on the first violation found.
 * Callers (orchestrator, tests) may catch and surface this to run summary.
 */
export function validatePreparedPageImage(page: PreparedPageImage): void {
  if (!page.source_id || page.source_id.trim() === '') {
    throw new PreparedPageValidationError('source_id must be a non-empty string', {
      received: page.source_id,
    });
  }

  if (!Number.isInteger(page.page_number) || page.page_number < 1) {
    throw new PreparedPageValidationError(
      'page_number must be a positive integer (1-based)',
      { received: page.page_number }
    );
  }

  if (!page.image_path || page.image_path.trim() === '') {
    throw new PreparedPageValidationError('image_path must be a non-empty string', {
      received: page.image_path,
    });
  }

  if (!Number.isInteger(page.image_width) || page.image_width <= 0) {
    throw new PreparedPageValidationError(
      'image_width must be a positive integer in pixels',
      { received: page.image_width }
    );
  }

  if (!Number.isInteger(page.image_height) || page.image_height <= 0) {
    throw new PreparedPageValidationError(
      'image_height must be a positive integer in pixels',
      { received: page.image_height }
    );
  }
}

/**
 * Validate all pages in a list and throw on the first invalid page.
 * Also throws if the list is empty (no pages to work on is a logic error).
 */
export function validatePreparedPageImages(pages: PreparedPageImage[]): void {
  if (pages.length === 0) {
    throw new PreparedPageValidationError(
      'PreparedPageImage list must not be empty'
    );
  }
  for (const page of pages) {
    validatePreparedPageImage(page);
  }
}
