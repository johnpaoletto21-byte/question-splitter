import type { ExtractionFieldDefinition } from './types';

export interface RawExtractionFieldInput {
  name?: string;
  description?: string;
}

export class ExtractionFieldDefinitionError extends Error {
  public readonly code = 'EXTRACTION_FIELD_INVALID' as const;

  constructor(message: string) {
    super(`EXTRACTION_FIELD_INVALID: ${message}`);
    this.name = 'ExtractionFieldDefinitionError';
  }
}

export function normalizeExtractionFieldKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function parseExtractionFieldDefinitions(
  rows: ReadonlyArray<RawExtractionFieldInput>,
): ExtractionFieldDefinition[] {
  const definitions: ExtractionFieldDefinition[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const label = (row.name ?? '').trim();
    const description = (row.description ?? '').trim();

    if (label === '' && description === '') {
      continue;
    }

    if (label === '') {
      throw new ExtractionFieldDefinitionError('Field name is required when a description is provided.');
    }
    if (description === '') {
      throw new ExtractionFieldDefinitionError(`Description is required for field "${label}".`);
    }

    const key = normalizeExtractionFieldKey(label);
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      throw new ExtractionFieldDefinitionError(
        `Field "${label}" must normalize to a key starting with a letter.`,
      );
    }
    if (seen.has(key)) {
      throw new ExtractionFieldDefinitionError(`Duplicate field key "${key}".`);
    }

    seen.add(key);
    definitions.push({
      key,
      label,
      description,
      type: 'boolean',
    });
  }

  return definitions;
}

