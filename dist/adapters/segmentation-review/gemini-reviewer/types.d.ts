/**
 * adapters/segmentation-review/gemini-reviewer/types.ts
 *
 * Adapter-internal types for the Gemini segmentation reviewer.
 */
export interface GeminiReviewerConfig {
    apiKey: string;
    model?: string;
}
export interface GeminiRawReviewOutput {
    verdict: 'pass' | 'corrected';
    targets?: Array<{
        target_type: string;
        finish_page_number?: number;
        regions: Array<{
            page_number: number;
        }>;
        extraction_fields?: Record<string, unknown>;
        review_comment?: string;
        question_number?: string;
        question_text?: string;
        sub_questions?: string[];
    }>;
}
export type HttpPostFn = (url: string, body: unknown, headers: Record<string, string>) => Promise<unknown>;
//# sourceMappingURL=types.d.ts.map