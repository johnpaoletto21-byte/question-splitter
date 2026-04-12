"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPromptConfig = exports.capturePromptSnapshot = exports.setAgent2Prompt = exports.setAgent1Prompt = exports.getPromptConfig = exports.DEFAULT_AGENT2_PROMPT = exports.DEFAULT_AGENT1_PROMPT = void 0;
var default_prompts_1 = require("./default-prompts");
Object.defineProperty(exports, "DEFAULT_AGENT1_PROMPT", { enumerable: true, get: function () { return default_prompts_1.DEFAULT_AGENT1_PROMPT; } });
Object.defineProperty(exports, "DEFAULT_AGENT2_PROMPT", { enumerable: true, get: function () { return default_prompts_1.DEFAULT_AGENT2_PROMPT; } });
var store_1 = require("./store");
Object.defineProperty(exports, "getPromptConfig", { enumerable: true, get: function () { return store_1.getPromptConfig; } });
Object.defineProperty(exports, "setAgent1Prompt", { enumerable: true, get: function () { return store_1.setAgent1Prompt; } });
Object.defineProperty(exports, "setAgent2Prompt", { enumerable: true, get: function () { return store_1.setAgent2Prompt; } });
Object.defineProperty(exports, "capturePromptSnapshot", { enumerable: true, get: function () { return store_1.capturePromptSnapshot; } });
Object.defineProperty(exports, "resetPromptConfig", { enumerable: true, get: function () { return store_1.resetPromptConfig; } });
//# sourceMappingURL=index.js.map