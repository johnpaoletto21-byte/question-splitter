"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractionFieldDefinitionError = void 0;
exports.normalizeExtractionFieldKey = normalizeExtractionFieldKey;
exports.parseExtractionFieldDefinitions = parseExtractionFieldDefinitions;
class ExtractionFieldDefinitionError extends Error {
    constructor(message) {
        super(`EXTRACTION_FIELD_INVALID: ${message}`);
        this.code = 'EXTRACTION_FIELD_INVALID';
        this.name = 'ExtractionFieldDefinitionError';
    }
}
exports.ExtractionFieldDefinitionError = ExtractionFieldDefinitionError;
function normalizeExtractionFieldKey(raw) {
    return raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}
function parseExtractionFieldDefinitions(rows) {
    const definitions = [];
    const seen = new Set();
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
            throw new ExtractionFieldDefinitionError(`Field "${label}" must normalize to a key starting with a letter.`);
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
//# sourceMappingURL=validation.js.map