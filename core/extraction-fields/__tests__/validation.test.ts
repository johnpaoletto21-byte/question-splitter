import {
  ExtractionFieldDefinitionError,
  normalizeExtractionFieldKey,
  parseExtractionFieldDefinitions,
} from '../validation';

describe('extraction field validation', () => {
  it('normalizes labels to snake_case keys', () => {
    expect(normalizeExtractionFieldKey('Has Diagram?')).toBe('has_diagram');
    expect(normalizeExtractionFieldKey('  Long   Passage  ')).toBe('long_passage');
  });

  it('parses valid boolean field definitions', () => {
    const fields = parseExtractionFieldDefinitions([
      { name: 'Has Diagram', description: 'true if the question has a diagram' },
      { name: 'Long Passage', description: 'true if the question includes a long reading passage' },
    ]);

    expect(fields).toEqual([
      {
        key: 'has_diagram',
        label: 'Has Diagram',
        description: 'true if the question has a diagram',
        type: 'boolean',
      },
      {
        key: 'long_passage',
        label: 'Long Passage',
        description: 'true if the question includes a long reading passage',
        type: 'boolean',
      },
    ]);
  });

  it('ignores fully blank rows', () => {
    expect(parseExtractionFieldDefinitions([
      { name: '', description: '' },
      { name: 'Has Table', description: 'true if a table appears' },
    ])).toHaveLength(1);
  });

  it('rejects missing names, missing descriptions, invalid keys, and duplicates', () => {
    expect(() => parseExtractionFieldDefinitions([
      { description: 'has a diagram' },
    ])).toThrow(ExtractionFieldDefinitionError);
    expect(() => parseExtractionFieldDefinitions([
      { name: 'Has Diagram' },
    ])).toThrow(ExtractionFieldDefinitionError);
    expect(() => parseExtractionFieldDefinitions([
      { name: '123', description: 'bad key' },
    ])).toThrow(ExtractionFieldDefinitionError);
    expect(() => parseExtractionFieldDefinitions([
      { name: 'Has Diagram', description: 'first' },
      { name: 'has-diagram', description: 'duplicate' },
    ])).toThrow(ExtractionFieldDefinitionError);
  });
});

