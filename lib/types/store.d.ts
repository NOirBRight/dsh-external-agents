/** Persist Exposure to a profile-local file. RPC writes are authoritative. */
import type { AdapterId } from './catalog.ts';
import type { AdapterProbe } from './client-contract.ts';
import type { Config } from './exposure.ts';
export { decodeConfig, mergeConfig } from './config-codec.ts';
export declare const SETTINGS_FILE_NAME = "external-agents.settings.json";
export declare function settingsFilePath(home: string, profile?: string): string;
export declare function persistEnabled(): boolean;
export declare function loadPersistedConfig(home: string, profile?: string): Config | undefined;
export declare function savePersistedConfig(home: string, config: Config, profile?: string): void;
export declare function dshHome(): string;
export declare const PROBES_FILE_NAME = "external-agents.probes.json";
export declare function probesFilePath(home: string, profile?: string): string;
export declare function loadPersistedProbes(home: string, profile?: string): Partial<Record<AdapterId, AdapterProbe>>;
export declare function savePersistedProbes(home: string, probes: Partial<Record<AdapterId, AdapterProbe>>, profile?: string): void;
