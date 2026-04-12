import type { ExtractionFieldDefinition } from './types';
export interface RawExtractionFieldInput {
    name?: string;
    description?: string;
}
export declare class ExtractionFieldDefinitionError extends Error {
    readonly code: "EXTRACTION_FIELD_INVALID";
    constructor(message: string);
}
export declare function normalizeExtractionFieldKey(raw: string): string;
export declare function parseExtractionFieldDefinitions(rows: ReadonlyArray<RawExtractionFieldInput>): ExtractionFieldDefinition[];
//# sourceMappingURL=validation.d.ts.map