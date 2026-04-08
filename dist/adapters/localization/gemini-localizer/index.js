"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEMINI_LOCALIZATION_SCHEMA = exports.parseGeminiLocalizationResponse = exports.buildLocalizationPrompt = exports.selectPagesForTarget = exports.unwrapGeminiLocalizationResponse = exports.encodePageImageAsBase64 = exports.buildGeminiLocalizationRequest = exports.localizeTarget = void 0;
var localizer_1 = require("./localizer");
Object.defineProperty(exports, "localizeTarget", { enumerable: true, get: function () { return localizer_1.localizeTarget; } });
Object.defineProperty(exports, "buildGeminiLocalizationRequest", { enumerable: true, get: function () { return localizer_1.buildGeminiLocalizationRequest; } });
Object.defineProperty(exports, "encodePageImageAsBase64", { enumerable: true, get: function () { return localizer_1.encodePageImageAsBase64; } });
Object.defineProperty(exports, "unwrapGeminiLocalizationResponse", { enumerable: true, get: function () { return localizer_1.unwrapGeminiLocalizationResponse; } });
Object.defineProperty(exports, "selectPagesForTarget", { enumerable: true, get: function () { return localizer_1.selectPagesForTarget; } });
var prompt_1 = require("./prompt");
Object.defineProperty(exports, "buildLocalizationPrompt", { enumerable: true, get: function () { return prompt_1.buildLocalizationPrompt; } });
var parser_1 = require("./parser");
Object.defineProperty(exports, "parseGeminiLocalizationResponse", { enumerable: true, get: function () { return parser_1.parseGeminiLocalizationResponse; } });
var schema_1 = require("./schema");
Object.defineProperty(exports, "GEMINI_LOCALIZATION_SCHEMA", { enumerable: true, get: function () { return schema_1.GEMINI_LOCALIZATION_SCHEMA; } });
//# sourceMappingURL=index.js.map