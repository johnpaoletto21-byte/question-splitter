/**
 * adapters/ui/local-app/debug-package.ts
 *
 * Markdown debug package generation for one in-memory local run.
 */
import type { LocalConfig } from '../../config/local-config/types';
import type { LocalRunRecord } from './run-state';
export declare function renderRunDebugMarkdown(input: {
    record: LocalRunRecord;
    config?: LocalConfig;
    configError?: string;
}): string;
//# sourceMappingURL=debug-package.d.ts.map