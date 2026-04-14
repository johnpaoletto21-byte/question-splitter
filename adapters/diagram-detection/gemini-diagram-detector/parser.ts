/**
 * adapters/diagram-detection/gemini-diagram-detector/parser.ts
 *
 * Parses Gemini's raw diagram-detection JSON into the normalized
 * DiagramDetectionResult contract.
 *
 * Validation here is structural only — the crop engine's validateBbox
 * will run again at crop time as the gating point before any image I/O
 * (same pattern Agent 3's localizer uses).
 */

import type {
  DiagramBbox,
  DiagramDetectionResult,
} from '../../../core/diagram-detection/types';

export interface DiagramDetectionParseError {
  code: 'DIAGRAM_DETECTION_SCHEMA_INVALID';
  message: string;
}

function fail(message: string): never {
  const err: DiagramDetectionParseError = {
    code: 'DIAGRAM_DETECTION_SCHEMA_INVALID',
    message,
  };
  throw err;
}

/**
 * Parses a raw Gemini structured-output JSON object into a normalized
 * DiagramDetectionResult.
 *
 * Drops malformed entries silently (with a relaxed parse) only when they
 * are clearly outside our schema; throws on top-level shape mismatches.
 */
export function parseGeminiDiagramDetectionResponse(
  raw: unknown,
  sourceImagePath: string,
): DiagramDetectionResult {
  if (typeof raw !== 'object' || raw === null) {
    fail('Top-level response is not an object');
  }

  const obj = raw as Record<string, unknown>;
  const diagramsRaw = obj['diagrams'];

  if (!Array.isArray(diagramsRaw)) {
    fail('Response missing required "diagrams" array');
  }

  const diagrams: DiagramBbox[] = [];

  for (let i = 0; i < diagramsRaw.length; i++) {
    const entry = diagramsRaw[i] as Record<string, unknown> | null;
    if (typeof entry !== 'object' || entry === null) {
      fail(`diagrams[${i}] is not an object`);
    }

    const indexRaw = entry['diagram_index'];
    const bboxRaw = entry['bbox_1000'];
    const labelRaw = entry['label'];

    if (typeof indexRaw !== 'number' || !Number.isInteger(indexRaw) || indexRaw < 1) {
      fail(`diagrams[${i}].diagram_index must be a positive integer (got ${JSON.stringify(indexRaw)})`);
    }

    if (!Array.isArray(bboxRaw) || bboxRaw.length !== 4) {
      fail(`diagrams[${i}].bbox_1000 must be a 4-element array (got ${JSON.stringify(bboxRaw)})`);
    }

    for (let j = 0; j < 4; j++) {
      const v = bboxRaw[j];
      if (typeof v !== 'number') {
        fail(`diagrams[${i}].bbox_1000[${j}] must be a number (got ${JSON.stringify(v)})`);
      }
    }

    const bbox: [number, number, number, number] = [
      bboxRaw[0] as number,
      bboxRaw[1] as number,
      bboxRaw[2] as number,
      bboxRaw[3] as number,
    ];

    const item: DiagramBbox = {
      diagram_index: indexRaw,
      bbox_1000: bbox,
    };

    if (typeof labelRaw === 'string' && labelRaw.trim() !== '') {
      item.label = labelRaw.trim();
    }

    diagrams.push(item);
  }

  // Sort by diagram_index defensively — the model is asked to return reading
  // order but we don't assume the array is already sorted.
  diagrams.sort((a, b) => a.diagram_index - b.diagram_index);

  return {
    source_image_path: sourceImagePath,
    diagrams,
  };
}
