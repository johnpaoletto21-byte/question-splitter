"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigMissingError = void 0;
/** Error thrown when a required config key is missing. */
class ConfigMissingError extends Error {
    constructor(missingKeys) {
        const keyList = missingKeys.join(', ');
        super(`CONFIG_MISSING: Required configuration key(s) not found: [${keyList}]. ` +
            `Set these as environment variables or add them to your local config file ` +
            `(e.g. .question-cropper.json) before starting a run.`);
        this.code = 'CONFIG_MISSING';
        this.name = 'ConfigMissingError';
        this.missingKeys = missingKeys;
    }
}
exports.ConfigMissingError = ConfigMissingError;
//# sourceMappingURL=types.js.map