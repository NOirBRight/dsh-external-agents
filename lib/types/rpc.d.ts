/** Host RPC: snapshot + save Exposure. */
import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection';
import { type Config } from './exposure.ts';
export interface ExternalAgentsRpcDeps {
    liveConfig: () => Config;
    applyConfig: (config: Config) => void;
    cachedProbes: () => Partial<Record<import('./catalog.ts').AdapterId, import('./client-contract.ts').AdapterProbe>>;
    setCachedProbes: (probes: Partial<Record<import('./catalog.ts').AdapterId, import('./client-contract.ts').AdapterProbe>>) => void;
    resolveExecutable?: (name: string, env: Record<string, string>, signal: AbortSignal) => Promise<string>;
}
export declare function createExternalAgentsRpcHandler(deps: ExternalAgentsRpcDeps): ConnectionRpcHandler;
export declare function registerExternalAgentsRpc(ctx: Context, deps: ExternalAgentsRpcDeps): void;
//# sourceMappingURL=rpc.d.ts.map