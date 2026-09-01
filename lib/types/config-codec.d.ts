/** Browser-safe config decode/merge. */
import type { Config } from './exposure.ts';
export declare function decodeConfig(value: unknown): Config | undefined;
/** Validate a config before it is mounted or persisted. */
export declare function validateConfig(value: unknown): Config;
/** Resolve and normalize a config before mounting or persisting it. */
export declare function resolveConfig(value: unknown): Config;
export declare function mergeConfig(base: Config, overlay: Config | undefined): Config;
