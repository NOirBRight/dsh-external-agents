/** Shared Product Worker execution for foreground and background delegation tools. */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { JsonValue } from '@deepseek-ai/dsh-session';
import { type SubagentRun } from '@deepseek-ai/dsh-subagent';
export interface ProductWorkerRequest {
    provider: string;
    label: string;
    prompt: string;
    parent: Agent;
}
export type ForegroundWorkerResult = {
    readonly kind: 'foreground';
    readonly runId: SubagentRun['id'];
    readonly output: JsonValue[];
};
export declare function outputValueText(values: JsonValue[]): string;
export declare function startForegroundProductWorker(ctx: Context, request: ProductWorkerRequest, signal: AbortSignal): Promise<ForegroundWorkerResult>;
export declare function startBackgroundProductWorker(ctx: Context, request: ProductWorkerRequest): string;
