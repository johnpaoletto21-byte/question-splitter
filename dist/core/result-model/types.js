"use strict";
/**
 * core/result-model/types.ts
 *
 * Final run result row contract.
 *
 * Design constraints (Layer B §5.1 "Final run result row"):
 *   - Required fields: target_id, source_pages, output_file_name, status
 *   - Optional fields: local_output_path, drive_file_id, drive_url
 *   - Forbidden fields: review_comment, raw provider payloads, credentials (INV-4)
 *   - No provider SDK types (INV-9)
 *
 * TASK-401 adds this module.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=types.js.map