export type ClientContext = import('@deepseek-ai/cordis').Context & Record<string, any>;
export interface PendingWait<_K extends string> {
    readonly kind: _K;
    readonly key: string;
    readonly sessionId: unknown;
    readonly payload?: {
        questions?: readonly unknown[];
    } & Record<string, unknown>;
    readonly questions?: readonly unknown[];
    respond?(message: unknown): Promise<{
        accepted: boolean;
    }>;
    answer?(answer: unknown): Promise<void>;
    cancel?(): Promise<void>;
}
