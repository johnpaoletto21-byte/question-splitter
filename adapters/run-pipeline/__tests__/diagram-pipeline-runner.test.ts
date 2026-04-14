/**
 * adapters/run-pipeline/__tests__/diagram-pipeline-runner.test.ts
 *
 * End-to-end test for the diagram pipeline runner with all I/O injected.
 * No real Gemini calls and no canvas operations.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runDiagramPipeline } from '../diagram-pipeline-runner';
import type { LocalConfig } from '../../config/local-config/types';

const FAKE_CONFIG: LocalConfig = {
  GEMINI_API_KEY: 'test-key',
  DRIVE_FOLDER_ID: 'unused',
  OAUTH_TOKEN_PATH: '/tmp/unused.json',
  OUTPUT_DIR: '/tmp/unused',
};

describe('runDiagramPipeline', () => {
  let tmpDir: string;
  let sourceImagePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-runner-test-'));
    sourceImagePath = path.join(tmpDir, 'source.png');
    // Just create the file — fake imageDimensions returns whatever we want.
    fs.writeFileSync(sourceImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs detector → cropper → overlay end-to-end with injected fakes', async () => {
    const detector = jest.fn(async (src: string) => ({
      source_image_path: src,
      diagrams: [
        { diagram_index: 1, bbox_1000: [100, 100, 400, 500] as [number, number, number, number], label: '図1' },
        { diagram_index: 2, bbox_1000: [500, 100, 900, 500] as [number, number, number, number] },
      ],
    }));
    const cropper = jest.fn(async (_src: string, outputDir: string, index: number) => {
      const out = `${outputDir}/diagram_${String(index).padStart(2, '0')}.png`;
      return out;
    });
    const overlayRenderer = jest.fn(async (_src: string, outputDir: string) => `${outputDir}/overlay.png`);
    const imageDimensions = jest.fn(async () => ({ width: 1000, height: 1500 }));

    const outputDir = path.join(tmpDir, 'diagram-runs', 'run123');
    const result = await runDiagramPipeline(
      {
        sourceImagePath,
        outputDir,
        config: FAKE_CONFIG,
      },
      { detector, cropper, overlayRenderer, imageDimensions },
    );

    expect(detector).toHaveBeenCalledWith(
      sourceImagePath,
      expect.stringContaining('Diagram Detector'),
      { apiKey: 'test-key' },
    );
    expect(cropper).toHaveBeenCalledTimes(2);
    expect(overlayRenderer).toHaveBeenCalledTimes(1);
    expect(result.diagrams).toHaveLength(2);
    expect(result.source_width).toBe(1000);
    expect(result.source_height).toBe(1500);
    expect(result.overlay_image_path).toBe(`${outputDir}/overlay.png`);
    // Output directory was created.
    expect(fs.existsSync(outputDir)).toBe(true);
  });

  it('emits log events for each stage', async () => {
    const events: { stage: string; message: string }[] = [];
    await runDiagramPipeline(
      {
        sourceImagePath,
        outputDir: path.join(tmpDir, 'diagram-runs', 'run-log'),
        config: FAKE_CONFIG,
        onLog: (e) => events.push({ stage: e.stage, message: e.message }),
      },
      {
        detector: async (src) => ({ source_image_path: src, diagrams: [] }),
        cropper: jest.fn(),
        overlayRenderer: async () => '/tmp/overlay.png',
        imageDimensions: async () => ({ width: 800, height: 600 }),
      },
    );
    const stages = events.map((e) => e.stage);
    expect(stages).toEqual(expect.arrayContaining(['dimensions', 'detect', 'crop', 'overlay']));
  });

  it('throws when the source image does not exist', async () => {
    await expect(
      runDiagramPipeline(
        {
          sourceImagePath: '/tmp/does-not-exist.png',
          outputDir: path.join(tmpDir, 'run-bad'),
          config: FAKE_CONFIG,
        },
        {
          detector: jest.fn(),
          cropper: jest.fn(),
          overlayRenderer: jest.fn(),
          imageDimensions: jest.fn(),
        },
      ),
    ).rejects.toThrow(/Source image not found/);
  });

  it('uses promptOverride when provided (non-empty)', async () => {
    const detector = jest.fn(async (src: string) => ({ source_image_path: src, diagrams: [] }));
    await runDiagramPipeline(
      {
        sourceImagePath,
        outputDir: path.join(tmpDir, 'run-prompt'),
        config: FAKE_CONFIG,
        promptOverride: 'CUSTOM PROMPT TEXT',
      },
      {
        detector,
        cropper: jest.fn(),
        overlayRenderer: async () => '/tmp/overlay.png',
        imageDimensions: async () => ({ width: 800, height: 600 }),
      },
    );
    expect(detector).toHaveBeenCalledWith(
      sourceImagePath,
      'CUSTOM PROMPT TEXT',
      { apiKey: 'test-key' },
    );
  });
});
