"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGeminiDiagramDetectionResponse = exports.GEMINI_DIAGRAM_DETECTOR_SCHEMA = exports.DEFAULT_GEMINI_DIAGRAM_DETECTOR_MODEL = exports.unwrapGeminiDiagramResponse = exports.encodeImageAsBase64 = exports.buildGeminiDiagramDetectionRequest = exports.detectDiagrams = void 0;
var detector_1 = require("./detector");
Object.defineProperty(exports, "detectDiagrams", { enumerable: true, get: function () { return detector_1.detectDiagrams; } });
Object.defineProperty(exports, "buildGeminiDiagramDetectionRequest", { enumerable: true, get: function () { return detector_1.buildGeminiDiagramDetectionRequest; } });
Object.defineProperty(exports, "encodeImageAsBase64", { enumerable: true, get: function () { return detector_1.encodeImageAsBase64; } });
Object.defineProperty(exports, "unwrapGeminiDiagramResponse", { enumerable: true, get: function () { return detector_1.unwrapGeminiDiagramResponse; } });
Object.defineProperty(exports, "DEFAULT_GEMINI_DIAGRAM_DETECTOR_MODEL", { enumerable: true, get: function () { return detector_1.DEFAULT_GEMINI_DIAGRAM_DETECTOR_MODEL; } });
var schema_1 = require("./schema");
Object.defineProperty(exports, "GEMINI_DIAGRAM_DETECTOR_SCHEMA", { enumerable: true, get: function () { return schema_1.GEMINI_DIAGRAM_DETECTOR_SCHEMA; } });
var parser_1 = require("./parser");
Object.defineProperty(exports, "parseGeminiDiagramDetectionResponse", { enumerable: true, get: function () { return parser_1.parseGeminiDiagramDetectionResponse; } });
//# sourceMappingURL=index.js.map