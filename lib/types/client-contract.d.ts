/** Browser-safe RPC contract for the External Agents settings page. */
import { type AdapterId } from './catalog.ts';
import type { Config } from './exposure.ts';
export declare const EXTERNAL_AGENTS_RPC_CHANNEL = "/external-agents";
export declare const SNAPSHOT_ENDPOINT = "snapshot";
export declare const SAVE_ENDPOINT = "save";
export declare const PROBE_ENDPOINT = "probe";
export declare const PICK_ENDPOINT = "pick";
export interface AdapterProbe {
    found: boolean;
    path?: string;
    version?: string;
    login?: 'product-managed' | 'ok' | 'unknown';
    loginDetail?: string;
    /** Product model ids the settings dropdown can offer. */
    models?: string[];
}
export interface CatalogCard {
    id: AdapterId;
    displayName: string;
    executable: string;
    toolName: string;
    docsUrl: string;
    loginMode: 'cursor-status' | 'product-managed';
    supportsUnattended: boolean;
    knownModels: {
        id: string;
        label: string;
    }[];
}
export interface ExternalAgentsSnapshot {
    config: Config;
    catalog: CatalogCard[];
    probes: Partial<Record<AdapterId, AdapterProbe>>;
}
export declare function decodeSnapshot(value: unknown): ExternalAgentsSnapshot | undefined;
