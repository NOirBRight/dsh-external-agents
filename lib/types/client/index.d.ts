/** Browser half: External Agents page inside Settings. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type ExternalAgentsKey } from './locales.ts';
export { CONTINUE_IN_DSH_SLOT } from './ExternalPlanReviewCard.tsx';
export type { ContinueInDshOwner, PlanWorkerTarget } from './ExternalPlanReviewCard.tsx';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'settings.external-agents': ExternalAgentsKey;
    }
}
export declare const name = "dsh-external-agents-client";
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map