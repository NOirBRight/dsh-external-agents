/** PATH / version / login probes. Never run synchronously from apply(). */
import type { Context } from '@deepseek-ai/cordis';
import { type AdapterId } from './catalog.ts';
import type { AdapterProbe } from './client-contract.ts';
export declare function probeAdapter(id: AdapterId, resolveExecutable: (name: string, env: Record<string, string>, signal: AbortSignal) => Promise<string>, signal: AbortSignal, overridePath?: string): Promise<AdapterProbe>;
export declare function probeAll(resolveExecutable: (name: string, env: Record<string, string>, signal: AbortSignal) => Promise<string>, signal: AbortSignal, paths?: Partial<Record<AdapterId, string>>): Promise<Partial<Record<AdapterId, AdapterProbe>>>;
export declare function probeModels(probes: Partial<Record<AdapterId, AdapterProbe>>): Promise<Partial<Record<AdapterId, AdapterProbe>>>;
export declare function startOfficialProbes(ctx: Context): void;
