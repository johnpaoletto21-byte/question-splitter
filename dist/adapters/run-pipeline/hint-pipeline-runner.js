"use strict";
/**
 * adapters/run-pipeline/hint-pipeline-runner.ts
 *
 * Adapter-layer glue for the hint annotator mode.
 *
 * Three methods:
 *   image-gen  → single Gemini image-generation call
 *   overlay    → Gemini JSON annotations → Canvas draws on original PNG
 *   blend      → Gemini JSON annotations → Gemini image-gen with specific instructions
 *
 * Mirrors the dependency-injection style of diagram-pipeline-runner.ts.
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
exports.runHintPipeline = runHintPipeline;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const gemini_hint_image_gen_1 = require("../hint-annotation/gemini-hint-image-gen");
const gemini_hint_overlay_1 = require("../hint-annotation/gemini-hint-overlay");
const canvas_renderer_1 = require("../hint-annotation/canvas-renderer");
const default_prompts_1 = require("../../core/prompt-config-store/default-prompts");
function emit(onLog, stage, message) {
    onLog?.({ stage, message, timestamp: new Date().toISOString() });
}
function resolvePrompt(override, fallback) {
    return override?.trim() ? override : fallback;
}
function appendHint(prompt, hintText) {
    if (!hintText?.trim())
        return prompt;
    return `${prompt}\n\nHint from the teacher: ${hintText.trim()}`;
}
/**
 * Runs the hint annotation pipeline end-to-end.
 */
async function runHintPipeline(input, deps = {}) {
    fs.mkdirSync(input.outputDir, { recursive: true });
    if (!fs.existsSync(input.sourceImagePath)) {
        throw new Error(`Source image not found at ${input.sourceImagePath}`);
    }
    const outputPath = path.join(input.outputDir, 'annotated.png');
    const apiConfig = { apiKey: input.config.GEMINI_API_KEY };
    switch (input.method) {
        case 'image-gen': {
            emit(input.onLog, 'annotate', 'Method: Image Generation');
            const prompt = appendHint(resolvePrompt(input.imageGenPromptOverride, default_prompts_1.DEFAULT_HINT_IMAGE_GEN_PROMPT), input.hintText);
            emit(input.onLog, 'annotate', 'Calling Gemini image generation model');
            const imageGenFn = deps.imageGen ?? gemini_hint_image_gen_1.generateHintImage;
            const result = await imageGenFn(input.sourceImagePath, prompt, apiConfig, outputPath);
            emit(input.onLog, 'annotate', `Image generated using ${result.model}`);
            return { annotatedImagePath: outputPath, method: 'image-gen' };
        }
        case 'overlay': {
            emit(input.onLog, 'annotate', 'Method: JSON + Canvas Overlay');
            const prompt = appendHint(resolvePrompt(input.overlayPromptOverride, default_prompts_1.DEFAULT_HINT_OVERLAY_PROMPT), input.hintText);
            emit(input.onLog, 'annotate', 'Calling Gemini for annotation instructions (JSON)');
            const overlayFn = deps.overlay ?? gemini_hint_overlay_1.getHintAnnotations;
            const overlayResult = await overlayFn(input.sourceImagePath, prompt, apiConfig);
            emit(input.onLog, 'annotate', `Received ${overlayResult.annotations.length} annotation instruction(s)`);
            emit(input.onLog, 'render', 'Drawing annotations on source image with Canvas');
            const renderFn = deps.canvasRender ?? canvas_renderer_1.drawAnnotationsOnImage;
            await renderFn(input.sourceImagePath, overlayResult.annotations, outputPath);
            emit(input.onLog, 'render', 'Annotated image written');
            return { annotatedImagePath: outputPath, method: 'overlay' };
        }
        case 'blend': {
            emit(input.onLog, 'annotate', 'Method: Blend (JSON reasoning + image generation)');
            if (input.overlayPromptOverride?.trim()) {
                emit(input.onLog, 'annotate', 'Step 1: using custom overlay prompt');
            }
            if (input.overlaySchemaOverride) {
                emit(input.onLog, 'annotate', 'Step 1: using custom response schema');
            }
            if (input.blendRenderPromptOverride?.trim()) {
                emit(input.onLog, 'render', 'Step 2: using custom blend render prompt');
            }
            // Step 1: Get structured annotations via JSON
            const overlayPrompt = appendHint(resolvePrompt(input.overlayPromptOverride, default_prompts_1.DEFAULT_HINT_OVERLAY_PROMPT), input.hintText);
            emit(input.onLog, 'annotate', 'Step 1: Calling Gemini for annotation instructions (JSON)');
            const overlayFn = deps.overlay ?? gemini_hint_overlay_1.getHintAnnotations;
            const overlayResult = await overlayFn(input.sourceImagePath, overlayPrompt, apiConfig, input.overlaySchemaOverride);
            emit(input.onLog, 'annotate', `Step 1 complete: ${overlayResult.annotations.length} annotation instruction(s)`);
            // Step 2: Feed annotations to image generation model
            const annotationsJson = JSON.stringify(overlayResult.annotations, null, 2);
            const blendRenderPrompt = resolvePrompt(input.blendRenderPromptOverride, default_prompts_1.DEFAULT_HINT_BLEND_RENDER_PROMPT).replace('{annotations_json}', annotationsJson);
            emit(input.onLog, 'render', 'Step 2: Calling Gemini image generation with specific instructions');
            const imageGenFn = deps.imageGen ?? gemini_hint_image_gen_1.generateHintImage;
            const result = await imageGenFn(input.sourceImagePath, blendRenderPrompt, apiConfig, outputPath);
            emit(input.onLog, 'render', `Step 2 complete: image generated using ${result.model}`);
            return { annotatedImagePath: outputPath, method: 'blend' };
        }
        default:
            throw new Error(`Unknown hint annotation method: ${input.method}`);
    }
}
//# sourceMappingURL=hint-pipeline-runner.js.map