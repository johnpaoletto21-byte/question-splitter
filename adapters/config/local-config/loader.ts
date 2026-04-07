import fs from 'fs';
import path from 'path';
import { ConfigMissingError, LocalConfig, RawConfigFile } from './types';

/** Keys that must be present for the pipeline to start. */
const REQUIRED_KEYS: ReadonlyArray<keyof LocalConfig> = [
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
function readConfigFile(filePath: string): RawConfigFile {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw) as RawConfigFile;
  } catch {
    throw new Error(
      `Config file at "${filePath}" exists but is not valid JSON. Fix the file and retry.`
    );
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
export function loadConfig(
  configFilePath?: string,
  env?: NodeJS.ProcessEnv
): LocalConfig {
  const resolvedPath = configFilePath ?? path.resolve(process.cwd(), '.question-cropper.json');
  const resolvedEnv = env ?? process.env;

  // Layer 1: JSON file values
  const fileValues = readConfigFile(resolvedPath);

  // Layer 2: env vars (override file values)
  const merged: Partial<Record<keyof LocalConfig, string>> = {
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
  const missingKeys = REQUIRED_KEYS.filter(
    (k) => !merged[k] || merged[k]!.trim() === ''
  );

  if (missingKeys.length > 0) {
    throw new ConfigMissingError(missingKeys as string[]);
  }

  // At this point all keys are present and non-empty; cast is safe
  return merged as LocalConfig;
}
