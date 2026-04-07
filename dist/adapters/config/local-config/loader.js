"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const types_1 = require("./types");
/** Keys that must be present for the pipeline to start. */
const REQUIRED_KEYS = [
    'GEMINI_API_KEY',
    'DRIVE_FOLDER_ID',
    'OAUTH_TOKEN_PATH',
    'OUTPUT_DIR',
];
/**
 * Attempt to read a JSON config file from `filePath`.
 * Returns an empty object if the file does not exist.
 * Throws if the file exists but is not valid JSON.
 */
function readConfigFile(filePath) {
    if (!fs_1.default.existsSync(filePath)) {
        return {};
    }
    const raw = fs_1.default.readFileSync(filePath, 'utf-8');
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error(`Config file at "${filePath}" exists but is not valid JSON. Fix the file and retry.`);
    }
}
/**
 * Load and validate local configuration for a single-user Gemini + Google Drive run.
 *
 * Resolution order (later wins):
 *   1. JSON config file at `configFilePath` (default: `.question-cropper.json` in cwd)
 *   2. Environment variables (GEMINI_API_KEY, DRIVE_FOLDER_ID, OAUTH_TOKEN_PATH, OUTPUT_DIR)
 *
 * Throws `ConfigMissingError` immediately if any required key is absent after merge.
 * The error lists every missing key so the user can fix all gaps in one pass.
 *
 * @param configFilePath  Optional override for the JSON config file path.
 * @param env             Optional override for the environment variable map (for testing).
 */
function loadConfig(configFilePath, env) {
    const resolvedPath = configFilePath ?? path_1.default.resolve(process.cwd(), '.question-cropper.json');
    const resolvedEnv = env ?? process.env;
    // Layer 1: JSON file values
    const fileValues = readConfigFile(resolvedPath);
    // Layer 2: env vars (override file values)
    const merged = {
        ...fileValues,
        ...(resolvedEnv.GEMINI_API_KEY !== undefined
            ? { GEMINI_API_KEY: resolvedEnv.GEMINI_API_KEY }
            : {}),
        ...(resolvedEnv.DRIVE_FOLDER_ID !== undefined
            ? { DRIVE_FOLDER_ID: resolvedEnv.DRIVE_FOLDER_ID }
            : {}),
        ...(resolvedEnv.OAUTH_TOKEN_PATH !== undefined
            ? { OAUTH_TOKEN_PATH: resolvedEnv.OAUTH_TOKEN_PATH }
            : {}),
        ...(resolvedEnv.OUTPUT_DIR !== undefined
            ? { OUTPUT_DIR: resolvedEnv.OUTPUT_DIR }
            : {}),
    };
    // Fail fast: collect ALL missing keys before throwing
    const missingKeys = REQUIRED_KEYS.filter((k) => !merged[k] || merged[k].trim() === '');
    if (missingKeys.length > 0) {
        throw new types_1.ConfigMissingError(missingKeys);
    }
    // At this point all keys are present and non-empty; cast is safe
    return merged;
}
//# sourceMappingURL=loader.js.map