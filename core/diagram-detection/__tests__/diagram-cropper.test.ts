/**
 * core/diagram-detection/__tests__/diagram-cropper.test.ts
 *
 * Unit tests for the pure diagram-cropper orchestrator. All I/O is injected,
 * so these tests run with no real Gemini calls and no canvas operations.
 */

import { cropDiagrams } from '../diagram-cropper';
import type {
  DiagramCropper,
  DiagramOverlayRenderer,
} from '../diagram-cropper';
import type { DiagramDetectionResult } from '../types';

describe('cropDiagrams', () => {
  const SOURCE = '/tmp/source.png';
  const OUTPUT_DIR = '/tmp/diagram-runs/run123';
  const SOURCE_W = 1000;
  const SOURCE_H = 1500;

  function makeFakeCropper(): jest.MockedFunction<DiagramCropper> {
    return jest.fn(async (_src, outputDir, index, _rect) => {
      return `${outputDir}/diagram_${String(index).padStart(2, '0')}.png`;
    });
  }

  function makeFakeOverlay(): jest.MockedFunction<DiagramOverlayRenderer> {
    return jest.fn(async (_src, outputDir, _rects) => `${outputDir}/overlay.png`);
  }

  it('writes one PNG per diagram and an overlay', async () => {
    const detection: DiagramDetectionResult = {
      source_image_path: SOURCE,
      diagrams: [
        { diagram_index: 1, bbox_1000: [100, 100, 400, 500], label: '図1' },
        { diagram_index: 2, bbox_1000: [500, 100, 900, 500], label: '図2' },
      ],
    };
    const cropper = makeFakeCropper();
    const overlay = makeFakeOverlay();

    const result = await cropDiagrams(
      { detection, sourceWidth: SOURCE_W, sourceHeight: SOURCE_H, outputDir: OUTPUT_DIR },
      cropper,
      overlay,
    );

    expect(cropper).toHaveBeenCalledTimes(2);
    expect(overlay).toHaveBeenCalledTimes(1);
    expect(result.diagrams).toHaveLength(2);
    expect(result.diagrams[0]).toMatchObject({
      status: 'ok',
      diagram_index: 1,
      label: '図1',
      output_file_path: `${OUTPUT_DIR}/diagram_01.png`,
    });
    expect(result.diagrams[1]).toMatchObject({
      status: 'ok',
      diagram_index: 2,
      label: '図2',
      output_file_path: `${OUTPUT_DIR}/diagram_02.png`,
    });
    expect(result.overlay_image_path).toBe(`${OUTPUT_DIR}/overlay.png`);
    expect(result.source_width).toBe(SOURCE_W);
    expect(result.source_height).toBe(SOURCE_H);
  });

  it('converts bbox to pixel rect using source dimensions', async () => {
    const detection: DiagramDetectionResult = {
      source_image_path: SOURCE,
      diagrams: [
        // bbox covers the bottom half horizontally and the right two-thirds vertically.
        { diagram_index: 1, bbox_1000: [500, 333, 1000, 1000] },
      ],
    };
    const cropper = makeFakeCropper();
    const overlay = makeFakeOverlay();

    await cropDiagrams(
      { detection, sourceWidth: 900, sourceHeight: 1200, outputDir: OUTPUT_DIR },
      cropper,
      overlay,
    );

    const callArgs = cropper.mock.calls[0];
    const pixelRect = callArgs[3];
    // x = round(333/1000 * 900) = 300
    // y = round(500/1000 * 1200) = 600
    // width = round((1000-333)/1000 * 900) = round(600.3) = 600
    // height = round((1000-500)/1000 * 1200) = 600
    expect(pixelRect).toEqual({ x: 300, y: 600, width: 600, height: 600 });
  });

  it('isolates per-diagram bbox failures (one bad bbox does not block the others)', async () => {
    const detection: DiagramDetectionResult = {
      source_image_path: SOURCE,
      // bbox_1000 invariant: y_min < y_max. The second entry violates it on purpose.
      diagrams: [
        { diagram_index: 1, bbox_1000: [100, 100, 400, 500] },
        { diagram_index: 2, bbox_1000: [600, 100, 600, 500] }, // zero height
        { diagram_index: 3, bbox_1000: [700, 100, 950, 500] },
      ],
    };
    const cropper = makeFakeCropper();
    const overlay = makeFakeOverlay();

    const result = await cropDiagrams(
      { detection, sourceWidth: SOURCE_W, sourceHeight: SOURCE_H, outputDir: OUTPUT_DIR },
      cropper,
      overlay,
    );

    expect(result.diagrams).toHaveLength(3);
    expect(result.diagrams[0].status).toBe('ok');
    expect(result.diagrams[1].status).toBe('failed');
    expect(result.diagrams[2].status).toBe('ok');
    if (result.diagrams[1].status === 'failed') {
      expect(result.diagrams[1].failure_code).toBe('BBOX_INVALID');
    }
    // Cropper called only for the two valid bboxes.
    expect(cropper).toHaveBeenCalledTimes(2);
    // Overlay still rendered, including only the two valid pixel rects.
    expect(overlay).toHaveBeenCalledTimes(1);
    expect(overlay.mock.calls[0][2]).toHaveLength(2);
  });

  it('emits a failed result when the cropper itself throws', async () => {
    const detection: DiagramDetectionResult = {
      source_image_path: SOURCE,
      diagrams: [
        { diagram_index: 1, bbox_1000: [100, 100, 400, 500] },
        { diagram_index: 2, bbox_1000: [500, 100, 900, 500] },
      ],
    };
    const overlay = makeFakeOverlay();
    const cropper: jest.MockedFunction<DiagramCropper> = jest.fn(async (_src, outputDir, index, _rect) => {
      if (index === 2) {
        throw new Error('disk full');
      }
      return `${outputDir}/diagram_${String(index).padStart(2, '0')}.png`;
    });

    const result = await cropDiagrams(
      { detection, sourceWidth: SOURCE_W, sourceHeight: SOURCE_H, outputDir: OUTPUT_DIR },
      cropper,
      overlay,
    );

    expect(result.diagrams[0].status).toBe('ok');
    expect(result.diagrams[1].status).toBe('failed');
    if (result.diagrams[1].status === 'failed') {
      expect(result.diagrams[1].failure_code).toBe('DIAGRAM_CROP_FAILED');
      expect(result.diagrams[1].failure_message).toContain('disk full');
    }
    // Both pixel rects still flow into the overlay (overlay shows what was detected,
    // not what was successfully written).
    expect(overlay.mock.calls[0][2]).toHaveLength(2);
  });

  it('returns empty diagrams + still writes overlay for a no-diagrams detection', async () => {
    const detection: DiagramDetectionResult = {
      source_image_path: SOURCE,
      diagrams: [],
    };
    const cropper = makeFakeCropper();
    const overlay = makeFakeOverlay();

    const result = await cropDiagrams(
      { detection, sourceWidth: SOURCE_W, sourceHeight: SOURCE_H, outputDir: OUTPUT_DIR },
      cropper,
      overlay,
    );

    expect(cropper).not.toHaveBeenCalled();
    expect(overlay).toHaveBeenCalledTimes(1);
    expect(overlay.mock.calls[0][2]).toEqual([]);
    expect(result.diagrams).toEqual([]);
  });
});
