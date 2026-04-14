"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeCanvasCropExecutor = makeCanvasCropExecutor;
exports.makeCanvasImageStacker = makeCanvasImageStacker;
exports.getImageDimensions = getImageDimensions;
exports.cropImageToFile = cropImageToFile;
exports.drawDiagramOverlayToFile = drawDiagramOverlayToFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const canvas_1 = require("canvas");
const CROP_PADDING_PX = 4;
function safeName(raw) {
    return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}
function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
function padAndClampRect(pixelRect, imageWidth, imageHeight) {
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
 * Shared low-level primitive: copies a sub-rectangle of `image` into a fresh
 * canvas and returns the encoded PNG buffer. Caller is responsible for both
 * any padding/clamping logic and writing the buffer to disk.
 */
function cropImageToBuffer(image, rect) {
    const canvas = (0, canvas_1.createCanvas)(rect.width, rect.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
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
function makeCanvasCropExecutor(outputDir) {
    return async (runId, targetId, page, pixelRect) => {
        const cropDir = path.join(outputDir, 'runs', safeName(runId), 'crops');
        ensureDir(cropDir);
        const image = await (0, canvas_1.loadImage)(page.image_path);
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
function makeCanvasImageStacker(outputDir, runId) {
    return async (targetId, topPath, bottomPath) => {
        const composedDir = path.join(outputDir, 'runs', safeName(runId), 'composed');
        ensureDir(composedDir);
        const top = await (0, canvas_1.loadImage)(topPath);
        const bottom = await (0, canvas_1.loadImage)(bottomPath);
        const width = Math.max(top.width, bottom.width);
        const height = top.height + bottom.height;
        const canvas = (0, canvas_1.createCanvas)(width, height);
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
async function getImageDimensions(imagePath) {
    const image = await (0, canvas_1.loadImage)(imagePath);
    return { width: image.width, height: image.height };
}
/**
 * Crops a single rectangle out of the source PNG and writes it as
 * `diagram_<index>.png` under `outputDir`. Pads by the same 4-pixel safety
 * buffer the question pipeline uses (empirically working — see plan
 * "On Clipping" section).
 */
async function cropImageToFile(sourceImagePath, outputDir, diagramIndex, pixelRect) {
    ensureDir(outputDir);
    const image = await (0, canvas_1.loadImage)(sourceImagePath);
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
async function drawDiagramOverlayToFile(sourceImagePath, outputDir, rects) {
    ensureDir(outputDir);
    const image = await (0, canvas_1.loadImage)(sourceImagePath);
    const canvas = (0, canvas_1.createCanvas)(image.width, image.height);
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
        ctx.fillRect(labelX - padding, labelY - padding, metrics.width + padding * 2, parseInt(ctx.font, 10) + padding * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fillText(labelText, labelX, labelY);
    }
    const outPath = path.join(outputDir, 'overlay.png');
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    return outPath;
}
//# sourceMappingURL=canvas-images.js.map