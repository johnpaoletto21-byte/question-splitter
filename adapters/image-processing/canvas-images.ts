/**
 * adapters/image-processing/canvas-images.ts
 *
 * Concrete canvas-based image I/O adapters for the local pipeline.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage } from 'canvas';
import type { PreparedPageImage } from '../../core/source-model/types';
import type { PixelRect } from '../../core/crop-engine/types';
import type { CropExecutor } from '../../core/run-orchestrator/crop-step';
import type { ImageStackerFn } from '../../core/output-composer/composer';

const CROP_PADDING_PX = 4;

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
): PixelRect {
  const x = Math.max(0, pixelRect.x - CROP_PADDING_PX);
  const y = Math.max(0, pixelRect.y - CROP_PADDING_PX);
  const right = Math.min(imageWidth, pixelRect.x + pixelRect.width + CROP_PADDING_PX);
  const bottom = Math.min(imageHeight, pixelRect.y + pixelRect.height + CROP_PADDING_PX);

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

/**
 * Creates a CropExecutor that crops rendered page PNGs to per-target region PNGs.
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
    const canvas = createCanvas(paddedRect.width, paddedRect.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      image,
      paddedRect.x,
      paddedRect.y,
      paddedRect.width,
      paddedRect.height,
      0,
      0,
      paddedRect.width,
      paddedRect.height,
    );

    const fileName = [
      safeName(targetId),
      `p${String(page.page_number).padStart(4, '0')}`,
      `${paddedRect.x}_${paddedRect.y}_${paddedRect.width}x${paddedRect.height}`,
    ].join('_') + '.png';
    const outPath = path.join(cropDir, fileName);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
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
