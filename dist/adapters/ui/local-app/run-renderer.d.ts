/**
 * adapters/ui/local-app/run-renderer.ts
 *
 * HTML renderers for the real local run UI.
 */
import type { LocalRunRecord } from './run-state';
export declare function renderRunFormHtml(input: {
    configReady: boolean;
    missingKeys?: ReadonlyArray<string>;
    maxUploadMb: number;
}): string;
export declare function renderRunStatusHtml(record: LocalRunRecord): string;
export declare function renderRunErrorHtml(title: string, message: string): string;
//# sourceMappingURL=run-renderer.d.ts.map