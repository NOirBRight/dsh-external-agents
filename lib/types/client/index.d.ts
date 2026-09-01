/** Browser half: External Agents page inside Settings. */
import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
import { type ExternalAgentsKey } from './locales.ts';
/** Client context uses the official browser ConnectionHandle provided by the client plugin. */
type ClientContext = Omit<Context, 'connection'> & {
    readonly connection: ConnectionHandle;
};
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'settings.external-agents': ExternalAgentsKey;
    }
}
export declare const name = "dsh-external-agents-client";
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export {};
