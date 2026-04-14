"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGeminiDiagramDetectionResponse = parseGeminiDiagramDetectionResponse;
function fail(message) {
    const err = {
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
function parseGeminiDiagramDetectionResponse(raw, sourceImagePath) {
    if (typeof raw !== 'object' || raw === null) {
        fail('Top-level response is not an object');
    }
    const obj = raw;
    const diagramsRaw = obj['diagrams'];
    if (!Array.isArray(diagramsRaw)) {
        fail('Response missing required "diagrams" array');
    }
    const diagrams = [];
    for (let i = 0; i < diagramsRaw.length; i++) {
        const entry = diagramsRaw[i];
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
        const bbox = [
            bboxRaw[0],
            bboxRaw[1],
            bboxRaw[2],
            bboxRaw[3],
        ];
        const item = {
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
//# sourceMappingURL=parser.js.map