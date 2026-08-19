/**
 * One-shot print-json Product Worker provider over ctx.subprocess.
 * @module dsh-external-agents/print-json-provider
 */
import type { Context } from '@deepseek-ai/cordis';
import { type UnattendedPolicy } from './print-json-argv.ts';
export declare const DEFAULT_DISPOSE_GRACE_MS = 3000;
export declare const DEFAULT_PRINT_TIMEOUT_MS: number;
export interface PrintJsonProviderConfig {
    env?: Record<string, string>;
    disposeGraceMs?: number;
    unattended?: UnattendedPolicy;
    printTimeoutMs?: number;
    model?: string;
    executable?: string;
}
export declare function applyCursorProvider(ctx: Context, config?: PrintJsonProviderConfig): void;
export declare function applyAntigravityProvider(ctx: Context, config?: PrintJsonProviderConfig): void;
export declare const cursorPlugin: {
    name: string;
    inject: string[];
    apply: typeof applyCursorProvider;
};
export declare const antigravityPlugin: {
    name: string;
    inject: string[];
    apply: typeof applyAntigravityProvider;
};
//# sourceMappingURL=print-json-provider.d.ts.map