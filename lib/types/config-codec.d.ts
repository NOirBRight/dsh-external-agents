/** Browser-safe config decode/merge. */
import type { Config } from './exposure.ts';
export declare function decodeConfig(value: unknown): Config | undefined;
export declare function mergeConfig(base: Config, overlay: Config | undefined): Config;
//# sourceMappingURL=config-codec.d.ts.map