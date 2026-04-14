/**
 * adapters/hint-annotation/canvas-renderer.ts
 *
 * Draws structured annotation instructions onto a source PNG using Node Canvas.
 * The original image is preserved pixel-perfect as the base layer.
 *
 * Used by Method 2 (JSON + Canvas overlay).
 */
import type { AnnotationInstruction } from './gemini-hint-overlay/types';
/**
 * Draws annotation instructions onto a source PNG and writes the result.
 *
 * @param sourceImagePath  Absolute path to the original PNG.
 * @param annotations      Drawing instructions in bbox_1000 coordinate space.
 * @param outputPath       Where to write the annotated PNG.
 */
export declare function drawAnnotationsOnImage(sourceImagePath: string, annotations: AnnotationInstruction[], outputPath: string): Promise<void>;
//# sourceMappingURL=canvas-renderer.d.ts.map