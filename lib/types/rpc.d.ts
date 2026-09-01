/** Host RPC: snapshot, probes, and Exposure persistence. */
import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection';
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import { type Config } from './exposure.ts';
export interface ExternalAgentsRpcDeps {
    liveConfig: () => Config;
    applyConfig: (config: Config) => Promise<void>;
    cachedProbes: () => Partial<Record<import('./catalog.ts').AdapterId, import('./client-contract.ts').AdapterProbe>>;
    setCachedProbes: (probes: Partial<Record<import('./catalog.ts').AdapterId, import('./client-contract.ts').AdapterProbe>>) => void;
    resolveExecutable?: SubprocessRuntime['resolveExecutable'];
}
export declare function createExternalAgentsRpcHandler(deps: ExternalAgentsRpcDeps): ConnectionRpcHandler;
/** Register the host channel and attach its async disposer to this fiber. */
export declare function registerExternalAgentsRpc(ctx: Context, deps: ExternalAgentsRpcDeps): void;
