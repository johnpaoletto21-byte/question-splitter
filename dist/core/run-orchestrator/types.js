"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunBootstrapError = void 0;
/** Error thrown when a RunRequest is structurally invalid. */
class RunBootstrapError extends Error {
    constructor(reason) {
        super(`RUN_BOOTSTRAP_INVALID: ${reason}`);
        this.code = 'RUN_BOOTSTRAP_INVALID';
        this.name = 'RunBootstrapError';
    }
}
exports.RunBootstrapError = RunBootstrapError;
//# sourceMappingURL=types.js.map