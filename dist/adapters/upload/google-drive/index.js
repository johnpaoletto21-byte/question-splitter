"use strict";
/**
 * adapters/upload/google-drive/index.ts
 *
 * Barrel exports for the Google Drive upload adapter.
 * TASK-402 adds this module.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriveUploadError = exports.uploadToDrive = void 0;
var uploader_1 = require("./uploader");
Object.defineProperty(exports, "uploadToDrive", { enumerable: true, get: function () { return uploader_1.uploadToDrive; } });
var types_1 = require("./types");
Object.defineProperty(exports, "DriveUploadError", { enumerable: true, get: function () { return types_1.DriveUploadError; } });
//# sourceMappingURL=index.js.map