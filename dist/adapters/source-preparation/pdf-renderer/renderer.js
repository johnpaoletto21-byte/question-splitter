"use strict";
/**
 * adapters/source-preparation/pdf-renderer/renderer.ts
 *
 * Renders all pages of a single PDF source into PreparedPageImage entries.
 *
 * Boundary A contract (Layer B):
 *   - Input:  local PDF file path, run metadata, source ordering
 *   - Output: PreparedPageImage[] with source_id, page_number (1-based),
 *             image_path, image_width, image_height
 *
 * No provider SDK (Gemini, Drive, googleapis) is imported here (INV-9).
 * No bbox, segmentation, or upload logic appears here.
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
exports.renderPdfSource = renderPdfSource;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createCanvas } = require('canvas');
const types_1 = require("./types");
// Disable the web worker — not needed or useful in Node.js.
pdfjsLib.GlobalWorkerOptions.workerSrc = '';
/**
 * Render scale applied to each page viewport.
 * 72 DPI × 1.5 ≈ 108 effective DPI — sufficient quality for segmentation
 * and localization steps while keeping file sizes manageable.
 */
const RENDER_SCALE = 1.5;
/**
 * Render every page of `source.file_path` to PNG files in `outputDir`.
 *
 * @param source    The PdfSource whose file_path will be rendered.
 * @param outputDir Absolute path to an existing directory for output PNGs.
 * @returns         One PreparedPageImage per page, in 1-based page order.
 * @throws          PdfRenderError if the PDF cannot be loaded or any page fails.
 */
async function renderPdfSource(source, outputDir) {
    // Read the PDF bytes.
    let pdfBytes;
    try {
        pdfBytes = fs.readFileSync(source.file_path);
    }
    catch (err) {
        throw new types_1.PdfRenderError(`Cannot read PDF file: ${err.message}`, source.source_id);
    }
    // Load the PDF document.
    let pdf;
    try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
        pdf = await loadingTask.promise;
    }
    catch (err) {
        throw new types_1.PdfRenderError(`Cannot parse PDF document: ${err.message}`, source.source_id);
    }
    const pageCount = pdf.numPages;
    const pages = [];
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        let page;
        try {
            page = await pdf.getPage(pageNum);
        }
        catch (err) {
            throw new types_1.PdfRenderError(`Cannot load page: ${err.message}`, source.source_id, pageNum);
        }
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const width = Math.floor(viewport.width);
        const height = Math.floor(viewport.height);
        // Create an off-screen canvas and render the page into it.
        const canvas = createCanvas(width, height);
        // pdfjs-dist expects a browser CanvasRenderingContext2D-compatible object.
        // The canvas package's context is structurally compatible; cast to any
        // to bridge the DOM type gap without pulling in @lib dom.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = canvas.getContext('2d');
        try {
            await page.render({ canvasContext: ctx, viewport }).promise;
        }
        catch (err) {
            throw new types_1.PdfRenderError(`Failed to render page: ${err.message}`, source.source_id, pageNum);
        }
        // Write the rendered page to a PNG file.
        const pageTag = String(pageNum).padStart(4, '0');
        const outputFileName = `${source.source_id}_page_${pageTag}.png`;
        const imagePath = path.join(outputDir, outputFileName);
        try {
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(imagePath, buffer);
        }
        catch (err) {
            throw new types_1.PdfRenderError(`Cannot write PNG file: ${err.message}`, source.source_id, pageNum);
        }
        pages.push({
            source_id: source.source_id,
            page_number: pageNum, // 1-based (DEC-004)
            image_path: imagePath,
            image_width: width,
            image_height: height,
            file_name: source.file_name,
            pdf_path: source.file_path,
        });
    }
    return pages;
}
//# sourceMappingURL=renderer.js.map