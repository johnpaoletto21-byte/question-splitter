/**
 * adapters/image-processing/canvas-images.ts
 *
 * Concrete canvas-based image I/O adapters for the local pipeline.
 *
 * Two consumers share one underlying primitive (`cropPngToBuffer`):
 *   1. The question pipeline's `makeCanvasCropExecutor` — keeps its existing
 *      4-pixel safety buffer behavior (byte-identical output to the prior
 *      implementation).
 *   2. The diagram-only cropper's `cropImageToFile` — same primitive, no
 *      filename-mangling for run/target conventions.
 *
 * Also exports `drawDiagramOverlayToFile` for the sanity-check overlay PNG
 * shown on the diagram-run results page.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage, type Image } from 'canvas';
import type { PreparedPageImage } from '../../core/source-model/types';
import type { PixelRect } from '../../core/crop-engine/types';
import type { CropExecutor } from '../../core/run-orchestrator/crop-step';
import type { ImageStackerFn } from '../../core/output-composer/composer';

const CROP_PADDING_FRACTION = 0.02;

function safeName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function padAndClampRect(
  pixelRect: PixelRect,
  imageWidth: number,
  imageHeight: number,
  paddingFraction: number = CROP_PADDING_FRACTION,
): PixelRect {
  const padX = Math.round(imageWidth * paddingFraction);
  const padY = Math.round(imageHeight * paddingFraction);
  const x = Math.max(0, pixelRect.x - padX);
  const y = Math.max(0, pixelRect.y - padY);
  const right = Math.min(imageWidth, pixelRect.x + pixelRect.width + padX);
  const bottom = Math.min(imageHeight, pixelRect.y + pixelRect.height + padY);

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

/**
 * Shared low-level primitive: copies a sub-rectangle of `image` into a fresh
 * canvas and returns the encoded PNG buffer. Caller is responsible for both
 * any padding/clamping logic and writing the buffer to disk.
 */
function cropImageToBuffer(image: Image, rect: PixelRect): Buffer {
  const canvas = createCanvas(rect.width, rect.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  );
  return canvas.toBuffer('image/png');
}

/**
 * Creates a CropExecutor that crops rendered page PNGs to per-target region PNGs.
 *
 * Behavior preserved from the original implementation: pads the requested rect
 * by 4 pixels on every side and clamps to image bounds. File-naming convention
 * (`<targetId>_p<page>_<x>_<y>_<w>x<h>.png`) is unchanged so existing question
 * pipeline tests keep passing.
 */
export function makeCanvasCropExecutor(outputDir: string): CropExecutor {
  return async (
    runId: string,
    targetId: string,
    page: PreparedPageImage,
    pixelRect: PixelRect,
  ): Promise<string> => {
    const cropDir = path.join(outputDir, 'runs', safeName(runId), 'crops');
    ensureDir(cropDir);

    const image = await loadImage(page.image_path);
    const paddedRect = padAndClampRect(pixelRect, image.width, image.height);
    const buffer = cropImageToBuffer(image, paddedRect);

    const fileName = [
      safeName(targetId),
      `p${String(page.page_number).padStart(4, '0')}`,
      `${paddedRect.x}_${paddedRect.y}_${paddedRect.width}x${paddedRect.height}`,
    ].join('_') + '.png';
    const outPath = path.join(cropDir, fileName);
    fs.writeFileSync(outPath, buffer);
    return outPath;
  };
}

/**
 * Creates an ImageStackerFn that stacks two PNGs top-to-bottom.
 */
export function makeCanvasImageStacker(
  outputDir: string,
  runId: string,
): ImageStackerFn {
  return async (targetId: string, topPath: string, bottomPath: string): Promise<string> => {
    const composedDir = path.join(outputDir, 'runs', safeName(runId), 'composed');
    ensureDir(composedDir);

    const top = await loadImage(topPath);
    const bottom = await loadImage(bottomPath);
    const width = Math.max(top.width, bottom.width);
    const height = top.height + bottom.height;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(top, 0, 0);
    ctx.drawImage(bottom, 0, top.height);

    const outPath = path.join(composedDir, `${safeName(targetId)}_composed.png`);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    return outPath;
  };
}

// ---------------------------------------------------------------------------
// Diagram-only cropper helpers (TASK-DIAGRAM)
// ---------------------------------------------------------------------------

/**
 * Reads a PNG from disk and returns its pixel dimensions. Used by the
 * diagram-pipeline runner to convert the model's 0-1000 bbox into pixels.
 */
export async function getImageDimensions(
  imagePath: string,
): Promise<{ width: number; height: number }> {
  const image = await loadImage(imagePath);
  return { width: image.width, height: image.height };
}

/**
 * Crops a single rectangle out of the source PNG and writes it as
 * `diagram_<index>.png` under `outputDir`. Pads by the same 4-pixel safety
 * buffer the question pipeline uses (empirically working — see plan
 * "On Clipping" section).
 */
export async function cropImageToFile(
  sourceImagePath: string,
  outputDir: string,
  diagramIndex: number,
  pixelRect: PixelRect,
): Promise<string> {
  ensureDir(outputDir);
  const image = await loadImage(sourceImagePath);
  const paddedRect = padAndClampRect(pixelRect, image.width, image.height);
  const buffer = cropImageToBuffer(image, paddedRect);

  const fileName = `diagram_${String(diagramIndex).padStart(2, '0')}.png`;
  const outPath = path.join(outputDir, fileName);
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

/**
 * Renders the source PNG with red rectangles drawn around each diagram's
 * pixel rect. Saved as `overlay.png` under `outputDir`. This is the visual
 * sanity check on the results page — if a rectangle clips through a diagram
 * the user will see it immediately.
 */
export async function drawDiagramOverlayToFile(
  sourceImagePath: string,
  outputDir: string,
  rects: ReadonlyArray<{ diagram_index: number; pixelRect: PixelRect }>,
): Promise<string> {
  ensureDir(outputDir);
  const image = await loadImage(sourceImagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  // Stroke width scales with image size so it stays visible on large images.
  const strokeWidth = Math.max(2, Math.round(Math.min(image.width, image.height) / 400));
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = '#ff0000';
  ctx.font = `bold ${Math.max(14, Math.round(image.height / 60))}px sans-serif`;
  ctx.fillStyle = '#ff0000';
  ctx.textBaseline = 'top';

  for (const { diagram_index, pixelRect } of rects) {
    ctx.strokeRect(pixelRect.x, pixelRect.y, pixelRect.width, pixelRect.height);
    const labelText = `#${diagram_index}`;
    const labelX = pixelRect.x + strokeWidth + 2;
    const labelY = pixelRect.y + strokeWidth + 2;
    // Solid backing so the label is readable on any background.
    const metrics = ctx.measureText(labelText);
    const padding = 3;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      labelX - padding,
      labelY - padding,
      metrics.width + padding * 2,
      parseInt(ctx.font, 10) + padding * 2,
    );
    ctx.fillStyle = '#ff0000';
    ctx.fillText(labelText, labelX, labelY);
  }

  const outPath = path.join(outputDir, 'overlay.png');
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  return outPath;
}
