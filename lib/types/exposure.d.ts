/**
 * Exposure: which Delegation Tools the model may see.
 * Settings (P0: this plugin's config) own this; Agent Preset rows stay disabled.
 * @module dsh-external-agents/exposure
 */
import { type AdapterId, type ImplementedAdapterId } from './catalog.ts';
import type { UnattendedPolicy } from './print-json-argv.ts';
export interface AdapterConfig {
    /** Only an explicitly enabled Adapter is mounted and exposed. */
    enabled?: boolean;
    /** Optional absolute path to the product executable. */
    path?: string;
    /**
     * Extra env for this Adapter's worker only, merged after the credential
     * scrub. User-owned (HTTPS_PROXY, product keys, …). No built-in endpoints.
     */
    env?: Record<string, string>;
    /** P1 print-json workers: auto-approve (default) or fail closed. */
    unattended?: UnattendedPolicy;
    /** Trimmed product model name; required when enabled and optional when disabled. */
    model?: string;
    /** Agy --print-timeout in milliseconds. */
    printTimeoutMs?: number;
}
export interface Config {
    adapters?: {
        codex?: AdapterConfig;
        'claude-code'?: AdapterConfig;
        cursor?: AdapterConfig;
        antigravity?: AdapterConfig;
    };
    /** Used when delegate_worker omits adapter. Must be enabled and implemented. */
    defaultAdapter?: AdapterId;
}
export interface NamedToolExposure {
    readonly adapter: ImplementedAdapterId;
    readonly provider: string;
    readonly toolName: string;
}
export interface Exposure {
    readonly named: readonly NamedToolExposure[];
    readonly defaultAdapter: ImplementedAdapterId | undefined;
    readonly delegateWorker: boolean;
}
/** Resolve live named tools and the Default Adapter from plugin config. */
export declare function resolveExposure(config: Config): Exposure;
export type DelegationTarget = {
    readonly ok: true;
    readonly adapter: ImplementedAdapterId;
    readonly provider: string;
} | {
    readonly ok: false;
    readonly error: string;
};
/** Pick the provider for one delegate_worker call. */
export declare function resolveDelegationTarget(exposure: Exposure, requested: string | undefined): DelegationTarget;
