/**
 * LocalConfig — the full resolved configuration for a single-user
 * Gemini + Google Drive run.  All fields are required; the loader
 * enforces their presence before the orchestrator may start work.
 */
export interface LocalConfig {
    /** Gemini API key for Agent 1 and Agent 2 calls. */
    GEMINI_API_KEY: string;
    /** Google Drive folder ID where final output images are uploaded. */
    DRIVE_FOLDER_ID: string;
    /**
     * Path to the desktop OAuth2 token cache file produced by the
     * Google auth flow (e.g. gcloud application-default or custom script).
     */
    OAUTH_TOKEN_PATH: string;
    /**
     * Local directory where rendered page images and crop outputs are written
     * before upload.
     */
    OUTPUT_DIR: string;
}
/**
 * Raw shape accepted as an optional JSON config file on disk.
 * Values may be absent; the loader validates completeness after merge.
 */
export type RawConfigFile = Partial<Record<keyof LocalConfig, string>>;
/** Error thrown when a required config key is missing. */
export declare class ConfigMissingError extends Error {
    readonly code: "CONFIG_MISSING";
    readonly missingKeys: ReadonlyArray<string>;
    constructor(missingKeys: string[]);
}
//# sourceMappingURL=types.d.ts.map