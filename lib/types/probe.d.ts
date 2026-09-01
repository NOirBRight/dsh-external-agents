/** PATH / version / login probes. Never run synchronously from apply(). */
import type { Context } from '@deepseek-ai/cordis';
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import { type AdapterId } from './catalog.ts';
import type { AdapterProbe } from './client-contract.ts';
export type ExecutableResolver = SubprocessRuntime['resolveExecutable'];
export declare function probeAdapter(id: AdapterId, resolveExecutable: ExecutableResolver, signal: AbortSignal, overridePath?: string): Promise<AdapterProbe>;
export declare function probeAll(resolveExecutable: ExecutableResolver, signal: AbortSignal, paths?: Partial<Record<AdapterId, string>>): Promise<Partial<Record<AdapterId, AdapterProbe>>>;
export declare function probeModels(probes: Partial<Record<AdapterId, AdapterProbe>>, signal?: AbortSignal): Promise<Partial<Record<AdapterId, AdapterProbe>>>;
/** Start background probes with timer, cancellation, and work owned by one effect. */
export declare function startOfficialProbes(ctx: Context): void;
