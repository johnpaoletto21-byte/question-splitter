/**
 * adapters/hint-annotation/gemini-hint-overlay/types.ts
 *
 * Type contracts for the Gemini JSON-based hint annotation adapter.
 */
export interface GeminiHintOverlayConfig {
    apiKey: string;
    model?: string;
}
export type HttpPostFn = (url: string, body: unknown, headers: Record<string, string>) => Promise<unknown>;
export interface LineInstruction {
    type: 'line';
    from: [number, number];
    to: [number, number];
}
export interface ArrowInstruction {
    type: 'arrow';
    from: [number, number];
    to: [number, number];
}
export interface ArcInstruction {
    type: 'arc';
    center: [number, number];
    radius: number;
    startAngle: number;
    endAngle: number;
}
export interface TextInstruction {
    type: 'text';
    position: [number, number];
    content: string;
}
export type AnnotationInstruction = LineInstruction | ArrowInstruction | ArcInstruction | TextInstruction;
export interface HintOverlayResult {
    annotations: AnnotationInstruction[];
}
//# sourceMappingURL=types.d.ts.map