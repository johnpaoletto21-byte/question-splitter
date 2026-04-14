import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createCanvas, loadImage } from 'canvas';
import {
  makeCanvasCropExecutor,
  makeCanvasImageStacker,
  cropImageToFile,
  drawDiagramOverlayToFile,
  getImageDimensions,
} from '../canvas-images';
import type { PreparedPageImage } from '../../../core/source-model/types';

function writePng(filePath: string, width: number, height: number, color: string): void {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
}

describe('canvas image adapters', () => {
  let tmpDir: string;
  let page: PreparedPageImage;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-images-test-'));
    const pagePath = path.join(tmpDir, 'page.png');
    writePng(pagePath, 100, 80, '#ff0000');
    page = {
      source_id: 'src_0000_test',
      page_number: 1,
      image_path: pagePath,
      image_width: 100,
      image_height: 80,
    };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('adds percentage-based padding on every side for an interior crop', async () => {
    const crop = makeCanvasCropExecutor(tmpDir);
    const outPath = await crop('run_test', 'q_0001', page, {
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });

    // 2% of 100×80 = 2px horizontal, 2px vertical padding per side
    const image = await loadImage(outPath);
    expect(fs.existsSync(outPath)).toBe(true);
    expect(image.width).toBe(34);
    expect(image.height).toBe(44);
    expect(path.basename(outPath)).toContain('8_18_34x44');
  });

  it('clamps padded crops at the top-left page edge', async () => {
    const crop = makeCanvasCropExecutor(tmpDir);
    const outPath = await crop('run_test', 'q_0001', page, {
      x: 2,
      y: 3,
      width: 10,
      height: 12,
    });

    // 2% padding: padX=2, padY=2. x=max(0,0)=0, y=max(0,1)=1
    const image = await loadImage(outPath);
    expect(image.width).toBe(14);
    expect(image.height).toBe(16);
    expect(path.basename(outPath)).toContain('0_1_14x16');
  });

  it('clamps padded crops at the bottom-right page edge', async () => {
    const crop = makeCanvasCropExecutor(tmpDir);
    const outPath = await crop('run_test', 'q_0001', page, {
      x: 92,
      y: 74,
      width: 8,
      height: 6,
    });

    // 2% padding: padX=2, padY=2. x=90, y=72, right=min(100,102)=100, bottom=min(80,82)=80
    const image = await loadImage(outPath);
    expect(image.width).toBe(10);
    expect(image.height).toBe(8);
    expect(path.basename(outPath)).toContain('90_72_10x8');
  });

  it('clamps full-page crops on every side without adding synthetic pixels', async () => {
    const crop = makeCanvasCropExecutor(tmpDir);
    const outPath = await crop('run_test', 'q_0001', page, {
      x: 0,
      y: 0,
      width: 100,
      height: 80,
    });

    const image = await loadImage(outPath);
    expect(image.width).toBe(100);
    expect(image.height).toBe(80);
    expect(path.basename(outPath)).toContain('0_0_100x80');
  });

  it('stacks two images top-to-bottom', async () => {
    const topPath = path.join(tmpDir, 'top.png');
    const bottomPath = path.join(tmpDir, 'bottom.png');
    writePng(topPath, 40, 20, '#00ff00');
    writePng(bottomPath, 30, 25, '#0000ff');

    const stack = makeCanvasImageStacker(tmpDir, 'run_test');
    const outPath = await stack('q_0001', topPath, bottomPath);
    const image = await loadImage(outPath);

    expect(fs.existsSync(outPath)).toBe(true);
    expect(image.width).toBe(40);
    expect(image.height).toBe(45);
  });

  describe('cropImageToFile (diagram-only cropper)', () => {
    it('writes diagram_<index>.png with the padded crop dimensions', async () => {
      const outPath = await cropImageToFile(page.image_path, tmpDir, 1, {
        x: 20,
        y: 30,
        width: 40,
        height: 25,
      });
      const image = await loadImage(outPath);
      expect(fs.existsSync(outPath)).toBe(true);
      expect(path.basename(outPath)).toBe('diagram_01.png');
      // 2% pad: padX=2, padY=2 on 100×80 image. Interior crop → +2 each side.
      expect(image.width).toBe(44);
      expect(image.height).toBe(29);
    });

    it('clamps the padded crop at image edges', async () => {
      const outPath = await cropImageToFile(page.image_path, tmpDir, 7, {
        x: 0,
        y: 0,
        width: 100,
        height: 80,
      });
      const image = await loadImage(outPath);
      expect(path.basename(outPath)).toBe('diagram_07.png');
      expect(image.width).toBe(100);
      expect(image.height).toBe(80);
    });
  });

  describe('drawDiagramOverlayToFile', () => {
    it('writes overlay.png with the same dimensions as the source', async () => {
      const outPath = await drawDiagramOverlayToFile(page.image_path, tmpDir, [
        { diagram_index: 1, pixelRect: { x: 10, y: 10, width: 30, height: 20 } },
        { diagram_index: 2, pixelRect: { x: 50, y: 40, width: 30, height: 30 } },
      ]);
      const image = await loadImage(outPath);
      expect(path.basename(outPath)).toBe('overlay.png');
      expect(image.width).toBe(100);
      expect(image.height).toBe(80);
    });

    it('writes overlay.png even when no rects are supplied', async () => {
      const outPath = await drawDiagramOverlayToFile(page.image_path, tmpDir, []);
      const image = await loadImage(outPath);
      expect(image.width).toBe(100);
      expect(image.height).toBe(80);
    });
  });

  describe('getImageDimensions', () => {
    it('returns the pixel dimensions of a PNG on disk', async () => {
      const dims = await getImageDimensions(page.image_path);
      expect(dims).toEqual({ width: 100, height: 80 });
    });
  });
});
