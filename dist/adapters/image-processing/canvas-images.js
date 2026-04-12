"use strict";
/**
 * adapters/image-processing/canvas-images.ts
 *
 * Concrete canvas-based image I/O adapters for the local pipeline.
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
 * Creates a CropExecutor that crops rendered page PNGs to per-target region PNGs.
 */
function makeCanvasCropExecutor(outputDir) {
    return async (runId, targetId, page, pixelRect) => {
        const cropDir = path.join(outputDir, 'runs', safeName(runId), 'crops');
        ensureDir(cropDir);
        const image = await (0, canvas_1.loadImage)(page.image_path);
        const paddedRect = padAndClampRect(pixelRect, image.width, image.height);
        const canvas = (0, canvas_1.createCanvas)(paddedRect.width, paddedRect.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, paddedRect.x, paddedRect.y, paddedRect.width, paddedRect.height, 0, 0, paddedRect.width, paddedRect.height);
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
//# sourceMappingURL=canvas-images.js.map