/** External Agents plan-review router. */
import type { PendingWait } from '@deepseek-ai/dsh-client-runtime/client';
import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ExternalAgentsSnapshot } from '../client-contract.ts';
import type { ExternalAgentsKey } from './locales.ts';
export declare const CONTINUE_IN_DSH_SLOT: "external-agents.plan-review.continue-in-dsh";
export interface PlanWorkerTarget {
    id: string;
    label: string;
    description?: string;
    disabled?: boolean;
}
export interface ContinueInDshOwner {
    locked: boolean;
    workers: readonly PlanWorkerTarget[];
    workersLabel: string;
    selectedTarget: string;
    selectTarget: (target: string) => void;
    registerCommit: (commit: (() => Promise<boolean>) | null) => () => void;
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'external-agents.plan-review.continue-in-dsh': {
            kind: 'single';
            scope: 'session';
            owner: ContinueInDshOwner;
        };
    }
}
type QuestionWait = PendingWait<'question'>;
type Props = PropsRuntime<'conversation.composer'> & PropsRenderSlots<typeof CONTINUE_IN_DSH_SLOT> & {
    matched: QuestionWait;
} & {
    t: (key: ExternalAgentsKey) => string;
    load: () => Promise<ExternalAgentsSnapshot>;
};
export declare function ExternalPlanReviewCard(props: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=ExternalPlanReviewCard.d.ts.map