import type { PendingWait } from '@deepseek-ai/dsh-client-runtime/client';
import type { ExternalAgentsSnapshot, PlanExternalAgentTarget, PlanTargetId } from '../client-contract.ts';
import { type PlanReview } from './plan-review.ts';
import type { ExternalAgentsKey } from './locales.ts';
type QuestionWait = PendingWait<'question'>;
type Translate = (key: ExternalAgentsKey) => string;
export interface PlanReviewControllerOptions {
    matched: QuestionWait;
    review: PlanReview;
    loadTargets: () => Promise<ExternalAgentsSnapshot>;
    t: Translate;
}
export interface PlanReviewController {
    busy: boolean;
    blocked: boolean;
    error: string | null;
    targets: readonly PlanExternalAgentTarget[];
    selectedTarget: PlanTargetId;
    approvalReady: boolean;
    registerCommit: (commit: (() => Promise<boolean>) | null) => () => void;
    selectTarget: (target: PlanTargetId) => void;
    approve: () => void;
    discuss: () => void;
    keepPlanning: () => void;
}
/** One top-card owner for routing, registered commit ordering, and receipt policy. */
export declare function usePlanReviewController(options: PlanReviewControllerOptions): PlanReviewController;
export {};
