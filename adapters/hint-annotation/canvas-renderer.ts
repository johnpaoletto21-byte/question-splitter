/**
 * adapters/hint-annotation/canvas-renderer.ts
 *
 * Draws structured annotation instructions onto a source PNG using Node Canvas.
 * The original image is preserved pixel-perfect as the base layer.
 *
 * Used by Method 2 (JSON + Canvas overlay).
 */

import { readFileSync, writeFileSync } from 'fs';
import { createCanvas, loadImage } from 'canvas';
import type { AnnotationInstruction } from './gemini-hint-overlay/types';

/**
 * Draws annotation instructions onto a source PNG and writes the result.
 *
 * @param sourceImagePath  Absolute path to the original PNG.
 * @param annotations      Drawing instructions in bbox_1000 coordinate space.
 * @param outputPath       Where to write the annotated PNG.
 */
export async function drawAnnotationsOnImage(
  sourceImagePath: string,
  annotations: AnnotationInstruction[],
  outputPath: string,
): Promise<void> {
  const image = await loadImage(readFileSync(sourceImagePath));
  const width = image.width;
  const height = image.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw the original image as the base layer (pixel-perfect)
  ctx.drawImage(image, 0, 0);

  // Set up red marker style
  ctx.strokeStyle = '#FF0000';
  ctx.fillStyle = '#FF0000';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(width, height) / 250));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const instruction of annotations) {
    switch (instruction.type) {
      case 'line':
        drawLine(ctx, instruction.from, instruction.to, width, height);
        break;
      case 'arrow':
        drawArrow(ctx, instruction.from, instruction.to, width, height);
        break;
      case 'arc':
        drawArc(
          ctx,
          instruction.center,
          instruction.radius,
          instruction.startAngle,
          instruction.endAngle,
          width,
          height,
        );
        break;
      case 'text':
        drawText(ctx, instruction.position, instruction.content, width, height);
        break;
    }
  }

  const buffer = canvas.toBuffer('image/png');
  writeFileSync(outputPath, buffer);
}

// ---------------------------------------------------------------------------
// Coordinate conversion: bbox_1000 → pixel
// ---------------------------------------------------------------------------

function toPixelX(x: number, imageWidth: number): number {
  return (x / 1000) * imageWidth;
}

function toPixelY(y: number, imageHeight: number): number {
  return (y / 1000) * imageHeight;
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

function drawLine(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  w: number,
  h: number,
): void {
  ctx.beginPath();
  ctx.moveTo(toPixelX(from[0], w), toPixelY(from[1], h));
  ctx.lineTo(toPixelX(to[0], w), toPixelY(to[1], h));
  ctx.stroke();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  w: number,
  h: number,
): void {
  const x1 = toPixelX(from[0], w);
  const y1 = toPixelY(from[1], h);
  const x2 = toPixelX(to[0], w);
  const y2 = toPixelY(to[1], h);

  // Draw the line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Draw the arrowhead
  const headLen = Math.max(10, ctx.lineWidth * 4);
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

function drawArc(
  ctx: CanvasRenderingContext2D,
  center: [number, number],
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  w: number,
  h: number,
): void {
  const cx = toPixelX(center[0], w);
  const cy = toPixelY(center[1], h);
  const r = (radius / 1000) * Math.min(w, h);
  const startRad = (startAngleDeg * Math.PI) / 180;
  const endRad = (endAngleDeg * Math.PI) / 180;

  ctx.beginPath();
  ctx.arc(cx, cy, r, startRad, endRad);
  ctx.stroke();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  position: [number, number],
  content: string,
  w: number,
  h: number,
): void {
  const x = toPixelX(position[0], w);
  const y = toPixelY(position[1], h);
  const fontSize = Math.max(12, Math.round(Math.min(w, h) / 40));

  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillText(content, x, y);
}

// Re-export CanvasRenderingContext2D type reference for the canvas import
type CanvasRenderingContext2D = ReturnType<
  ReturnType<typeof createCanvas>['getContext']
>;
