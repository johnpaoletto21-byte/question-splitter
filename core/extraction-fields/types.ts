/**
 * core/extraction-fields/types.ts
 *
 * Run-scoped custom field definitions for dataset extraction.
 */

export interface ExtractionFieldDefinition {
  key: string;
  label: string;
  description: string;
  type: 'boolean';
}

