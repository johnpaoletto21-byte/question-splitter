import { LocalConfig } from './types';
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
export declare function loadConfig(configFilePath?: string, env?: NodeJS.ProcessEnv): LocalConfig;
//# sourceMappingURL=loader.d.ts.map