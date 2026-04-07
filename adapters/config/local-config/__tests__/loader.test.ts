import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadConfig } from '../loader';
import { ConfigMissingError } from '../types';

const FULL_ENV: NodeJS.ProcessEnv = {
  GEMINI_API_KEY: 'test-gemini-key',
  DRIVE_FOLDER_ID: 'test-folder-id',
  OAUTH_TOKEN_PATH: '/tmp/token.json',
  OUTPUT_DIR: '/tmp/output',
};

describe('loadConfig — environment variables', () => {
  it('returns a valid LocalConfig when all required env vars are set', () => {
    const config = loadConfig(undefined, FULL_ENV);
    expect(config.GEMINI_API_KEY).toBe('test-gemini-key');
    expect(config.DRIVE_FOLDER_ID).toBe('test-folder-id');
    expect(config.OAUTH_TOKEN_PATH).toBe('/tmp/token.json');
    expect(config.OUTPUT_DIR).toBe('/tmp/output');
  });

  it('throws ConfigMissingError listing all missing keys when all env vars are absent', () => {
    expect(() => loadConfig(undefined, {})).toThrow(ConfigMissingError);

    try {
      loadConfig(undefined, {});
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigMissingError);
      const e = err as ConfigMissingError;
      expect(e.code).toBe('CONFIG_MISSING');
      expect(e.missingKeys).toContain('GEMINI_API_KEY');
      expect(e.missingKeys).toContain('DRIVE_FOLDER_ID');
      expect(e.missingKeys).toContain('OAUTH_TOKEN_PATH');
      expect(e.missingKeys).toContain('OUTPUT_DIR');
    }
  });

  it('throws ConfigMissingError listing only the missing keys', () => {
    const partialEnv: NodeJS.ProcessEnv = {
      GEMINI_API_KEY: 'key',
      DRIVE_FOLDER_ID: 'folder',
      // OAUTH_TOKEN_PATH and OUTPUT_DIR missing
    };
    try {
      loadConfig(undefined, partialEnv);
      fail('Expected ConfigMissingError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigMissingError);
      const e = err as ConfigMissingError;
      expect(e.missingKeys).not.toContain('GEMINI_API_KEY');
      expect(e.missingKeys).not.toContain('DRIVE_FOLDER_ID');
      expect(e.missingKeys).toContain('OAUTH_TOKEN_PATH');
      expect(e.missingKeys).toContain('OUTPUT_DIR');
    }
  });

  it('treats whitespace-only values as missing', () => {
    const envWithBlanks: NodeJS.ProcessEnv = {
      ...FULL_ENV,
      GEMINI_API_KEY: '   ',
    };
    expect(() => loadConfig(undefined, envWithBlanks)).toThrow(ConfigMissingError);
  });

  it('error message names missing keys and includes fix guidance', () => {
    try {
      loadConfig(undefined, {});
    } catch (err) {
      const e = err as ConfigMissingError;
      expect(e.message).toMatch(/CONFIG_MISSING/);
      expect(e.message).toMatch(/GEMINI_API_KEY/);
      expect(e.message).toMatch(/environment variables/i);
    }
  });
});

describe('loadConfig — JSON config file', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcv1-test-'));
    configPath = path.join(tmpDir, '.question-cropper.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads config from JSON file when no env vars are set', () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        GEMINI_API_KEY: 'file-key',
        DRIVE_FOLDER_ID: 'file-folder',
        OAUTH_TOKEN_PATH: '/tmp/file-token.json',
        OUTPUT_DIR: '/tmp/file-output',
      })
    );
    const config = loadConfig(configPath, {});
    expect(config.GEMINI_API_KEY).toBe('file-key');
    expect(config.DRIVE_FOLDER_ID).toBe('file-folder');
  });

  it('env vars override JSON file values', () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        GEMINI_API_KEY: 'file-key',
        DRIVE_FOLDER_ID: 'file-folder',
        OAUTH_TOKEN_PATH: '/tmp/file-token.json',
        OUTPUT_DIR: '/tmp/file-output',
      })
    );
    const config = loadConfig(configPath, { GEMINI_API_KEY: 'env-key' });
    expect(config.GEMINI_API_KEY).toBe('env-key');
    expect(config.DRIVE_FOLDER_ID).toBe('file-folder');
  });

  it('silently ignores a missing config file', () => {
    const missing = path.join(tmpDir, 'nonexistent.json');
    expect(() => loadConfig(missing, FULL_ENV)).not.toThrow();
  });

  it('throws a descriptive error for invalid JSON in config file', () => {
    fs.writeFileSync(configPath, '{ not: valid json }');
    expect(() => loadConfig(configPath, FULL_ENV)).toThrow(/not valid JSON/i);
  });
});
