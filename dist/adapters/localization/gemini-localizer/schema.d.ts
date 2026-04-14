/**
 * adapters/localization/gemini-localizer/schema.ts
 *
 * Gemini structured output response schema for Agent 3 (Region Localizer).
 *
 * Agent 3 receives a sliding window of 1-3 images and returns bounding boxes
 * for each question visible in the window.
 *
 * bbox_1000 is an array of exactly 4 integers [y_min, x_min, y_max, x_max]
 * on a 0–1000 normalized scale. The schema enforces the 4-element shape
 * at the API level; strict validation (inversion, range) is done in the parser.
 */
/** Build the JSON schema for window-based localization. */
export declare function buildGeminiLocalizationSchema(windowSize?: number): Record<string, unknown>;
/** Default JSON schema for Gemini's responseSchema field (Agent 3, 3-image window). */
export declare const GEMINI_LOCALIZATION_SCHEMA: Record<string, unknown>;
//# sourceMappingURL=schema.d.ts.map