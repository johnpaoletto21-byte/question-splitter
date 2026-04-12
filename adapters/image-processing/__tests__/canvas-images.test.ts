import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { makeCanvasCropExecutor, makeCanvasImageStacker } from '../canvas-images';
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

  it('adds 4px padding on every side for an interior crop', async () => {
    const crop = makeCanvasCropExecutor(tmpDir);
    const outPath = await crop('run_test', 'q_0001', page, {
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });

    const image = await loadImage(outPath);
    expect(fs.existsSync(outPath)).toBe(true);
    expect(image.width).toBe(38);
    expect(image.height).toBe(48);
    expect(path.basename(outPath)).toContain('6_16_38x48');
  });

  it('clamps padded crops at the top-left page edge', async () => {
    const crop = makeCanvasCropExecutor(tmpDir);
    const outPath = await crop('run_test', 'q_0001', page, {
      x: 2,
      y: 3,
      width: 10,
      height: 12,
    });

    const image = await loadImage(outPath);
    expect(image.width).toBe(16);
    expect(image.height).toBe(19);
    expect(path.basename(outPath)).toContain('0_0_16x19');
  });

  it('clamps padded crops at the bottom-right page edge', async () => {
    const crop = makeCanvasCropExecutor(tmpDir);
    const outPath = await crop('run_test', 'q_0001', page, {
      x: 92,
      y: 74,
      width: 8,
      height: 6,
    });

    const image = await loadImage(outPath);
    expect(image.width).toBe(12);
    expect(image.height).toBe(10);
    expect(path.basename(outPath)).toContain('88_70_12x10');
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
});
