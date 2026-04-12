"use strict";
/**
 * adapters/ui/local-app/upload-handler.ts
 *
 * Multipart PDF upload parsing for the local app.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_UPLOAD_BYTES = exports.PdfUploadError = void 0;
exports.parsePdfUpload = parsePdfUpload;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const busboy_1 = __importDefault(require("busboy"));
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
exports.MAX_UPLOAD_BYTES = MAX_UPLOAD_BYTES;
class PdfUploadError extends Error {
    constructor(code, message, statusCode = 400) {
        super(`${code}: ${message}`);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'PdfUploadError';
    }
}
exports.PdfUploadError = PdfUploadError;
function safeFileName(raw) {
    const base = path.basename(raw || 'upload.pdf');
    const parsed = path.parse(base);
    const name = parsed.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'upload';
    return `${name}.pdf`;
}
function isPdf(filename, mimeType) {
    const hasPdfExt = filename.toLowerCase().endsWith('.pdf');
    return hasPdfExt && (mimeType === 'application/pdf' || mimeType === 'application/octet-stream');
}
function parsePdfUpload(req, outputDir) {
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('multipart/form-data')) {
        return Promise.reject(new PdfUploadError('UPLOAD_INVALID_CONTENT_TYPE', 'Expected multipart/form-data with one PDF file.'));
    }
    const uploadDir = path.join(outputDir, 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    return new Promise((resolve, reject) => {
        const bb = (0, busboy_1.default)({
            headers: req.headers,
            limits: {
                files: 1,
                fileSize: MAX_UPLOAD_BYTES,
            },
        });
        let runLabel;
        let fileSeen = false;
        let uploadPath;
        let originalFileName = '';
        let writeDone;
        let settled = false;
        const cleanup = () => {
            if (uploadPath && fs.existsSync(uploadPath)) {
                fs.rmSync(uploadPath, { force: true });
            }
        };
        const fail = (err) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            reject(err);
        };
        bb.on('field', (name, value) => {
            if (name === 'runLabel') {
                const trimmed = value.trim();
                runLabel = trimmed === '' ? undefined : trimmed.slice(0, 120);
            }
        });
        bb.on('file', (fieldName, file, info) => {
            if (fieldName !== 'pdfFile') {
                file.resume();
                return;
            }
            if (fileSeen) {
                file.resume();
                fail(new PdfUploadError('UPLOAD_TOO_MANY_FILES', 'Upload exactly one PDF file.'));
                return;
            }
            fileSeen = true;
            originalFileName = info.filename || 'upload.pdf';
            if (!isPdf(originalFileName, info.mimeType)) {
                file.resume();
                fail(new PdfUploadError('UPLOAD_NOT_PDF', 'Choose a PDF file with a .pdf filename and application/pdf content type.'));
                return;
            }
            const fileName = `${Date.now()}_${safeFileName(originalFileName)}`;
            uploadPath = path.join(uploadDir, fileName);
            const out = fs.createWriteStream(uploadPath);
            writeDone = new Promise((resolveWrite, rejectWrite) => {
                out.on('finish', resolveWrite);
                out.on('error', rejectWrite);
                file.on('error', rejectWrite);
                file.on('limit', () => {
                    rejectWrite(new PdfUploadError('UPLOAD_TOO_LARGE', `PDF upload exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`, 413));
                });
            });
            file.pipe(out);
        });
        bb.on('filesLimit', () => {
            fail(new PdfUploadError('UPLOAD_TOO_MANY_FILES', 'Upload exactly one PDF file.'));
        });
        bb.on('error', fail);
        bb.on('close', () => {
            if (settled) {
                return;
            }
            if (!fileSeen || !uploadPath) {
                fail(new PdfUploadError('UPLOAD_MISSING_FILE', 'Choose one PDF file before starting a run.'));
                return;
            }
            (writeDone ?? Promise.resolve())
                .then(() => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve({
                    pdfFilePath: uploadPath,
                    originalFileName,
                    runLabel,
                });
            })
                .catch(fail);
        });
        req.pipe(bb);
    });
}
//# sourceMappingURL=upload-handler.js.map