/**
 * adapters/localization/gemini-localizer/window-result.ts
 *
 * Intermediate result type from a single sliding window localization call.
 * This is NOT the final LocalizationResult — the assembly step groups
 * these by question_number and builds per-target LocalizationResults.
 */
/**
 * A single region found in a window: a question's bounding box on a specific page.
 */
export interface WindowLocalizationRegion {
    /** The question_number from the known question list (e.g. "1", "問3"). */
    question_number: string;
    /** 1-based page number (deterministically mapped from image_position). */
    page_number: number;
    /** Normalized bounding box [y_min, x_min, y_max, x_max] on 0-1000 scale. */
    bbox_1000: [number, number, number, number];
}
/**
 * Result from a single window localization call.
 * Contains all question regions found in this window's 1-3 images.
 */
export interface WindowLocalizationResult {
    run_id: string;
    regions: WindowLocalizationRegion[];
    review_comment?: string;
}
//# sourceMappingURL=window-result.d.ts.map