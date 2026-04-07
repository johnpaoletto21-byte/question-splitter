/**
 * adapters/segmentation/gemini-segmenter/schema.ts
 *
 * Gemini structured output response schema for Agent 1.
 *
 * This JSON schema is sent in generationConfig.responseSchema so that
 * Gemini returns a predictable JSON object that the parser can validate
 * against the normalized segmentation contract.
 *
 * Note: target_id is intentionally absent — the parser assigns sequential
 * IDs in reading order after the response arrives.
 */
/** JSON schema object for Gemini's responseSchema field. */
export declare const GEMINI_SEGMENTATION_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly targets: {
            readonly type: "array";
            readonly description: "Ordered list of identified question targets in reading order.";
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly target_type: {
                        readonly type: "string";
                        readonly description: "The type of this target. Use \"question\" for a parent question.";
                    };
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
                                    readonly description: "1-based page number where part of this target appears.";
                                    readonly minimum: 1;
                                };
                            };
                            readonly required: readonly ["page_number"];
                        };
                    };
                    readonly review_comment: {
                        readonly type: "string";
                        readonly description: string;
                    };
                };
                readonly required: readonly ["target_type", "regions"];
            };
        };
    };
    readonly required: readonly ["targets"];
};
//# sourceMappingURL=schema.d.ts.map