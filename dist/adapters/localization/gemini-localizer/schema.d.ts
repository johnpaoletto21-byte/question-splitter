/**
 * adapters/localization/gemini-localizer/schema.ts
 *
 * Gemini structured output response schema for Agent 2 (Region Localizer).
 *
 * This JSON schema is sent in generationConfig.responseSchema so that
 * Gemini returns a predictable JSON object that the parser can validate
 * against the normalized localization contract.
 *
 * Design notes:
 *   - target_id is intentionally absent — the parser carries it from the
 *     incoming SegmentationTarget (Agent 2 cannot invent or change target identity).
 *   - The model is scoped to ONE target per call; regions[] here represents
 *     the bbox entries for each page region of that single target.
 *   - bbox_1000 is an array of exactly 4 integers [y_min, x_min, y_max, x_max]
 *     on a 0–1000 normalized scale. The schema enforces the 4-element shape
 *     at the API level; strict validation (inversion, range) is done in the parser.
 */
/** JSON schema object for Gemini's responseSchema field (Agent 2). */
export declare const GEMINI_LOCALIZATION_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly regions: {
            readonly type: "array";
            readonly description: string;
            readonly minItems: 1;
            readonly maxItems: 2;
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly page_number: {
                        readonly type: "integer";
                        readonly description: "1-based page number for this region (must match the page number given in the prompt).";
                        readonly minimum: 1;
                    };
                    readonly bbox_1000: {
                        readonly type: "array";
                        readonly description: string;
                        readonly minItems: 4;
                        readonly maxItems: 4;
                        readonly items: {
                            readonly type: "integer";
                            readonly minimum: 0;
                            readonly maximum: 1000;
                        };
                    };
                };
                readonly required: readonly ["page_number", "bbox_1000"];
            };
        };
        readonly review_comment: {
            readonly type: "string";
            readonly description: string;
        };
    };
    readonly required: readonly ["regions"];
};
//# sourceMappingURL=schema.d.ts.map