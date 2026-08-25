/** External Agents Plan-review router and registered child entry. */
import type { PendingWait } from '@deepseek-ai/dsh-client-runtime/client';
import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { CONTINUE_IN_DSH_SLOT, type ContinueInDshOwner, type ExternalAgentsSnapshot } from '../client-contract.ts';
export { CONTINUE_IN_DSH_SLOT } from '../client-contract.ts';
export type { ContinueInDshOwner, ExternalAgentPlanTargetId, PlanExternalAgentTarget, PlanTargetId } from '../client-contract.ts';
/** Backward-compatible ./client target shape from the original child-slot API. */
export interface PlanWorkerTarget {
    id: string;
    label: string;
    description?: string;
    disabled?: boolean;
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
export interface ExternalPlanReviewFace {
    loadTargets: () => Promise<ExternalAgentsSnapshot>;
}
export type ExternalPlanReviewCardProps = PropsRuntime<'conversation.composer'> & PropsRenderSlots<typeof CONTINUE_IN_DSH_SLOT> & PropsLocale<'settings.external-agents'> & InjectFace<ExternalPlanReviewFace> & {
    matched: QuestionWait;
};
export declare function ExternalPlanReviewCard(props: ExternalPlanReviewCardProps): import("react").JSX.Element | null;
