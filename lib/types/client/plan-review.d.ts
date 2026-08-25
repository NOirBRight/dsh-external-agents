/** Plan-review narrowing plus the fail-closed external handoff capability seam. */
import type { PendingWait } from '@deepseek-ai/dsh-client-runtime/client';
import type { AdapterId } from '../catalog.ts';
export interface PlanReviewOption {
    label: string;
    description?: string;
}
export interface PlanReview {
    id: string;
    question: string;
    plan: string;
    approve: PlanReviewOption;
    decline?: PlanReviewOption;
}
interface QuestionItem {
    id: string;
    question: string;
    detail?: string;
    multiSelect?: boolean;
    options?: readonly PlanReviewOption[];
    intent?: {
        kind: string;
        approve?: string;
    };
}
type QuestionWaitLike = PendingWait<'question'>;
interface ComposerOwner {
    interactions: readonly PendingWait[];
}
export declare function planReviewOf(questions: readonly QuestionItem[]): PlanReview | undefined;
export declare function selectPlanReview(owner: ComposerOwner): QuestionWaitLike | null;
export declare function planHandoffAvailability(): {
    available: false;
    reasonKey: "plan.externalUnavailable";
};
export interface DisabledPlanWorker {
    id: AdapterId;
    label: string;
    description: string;
    disabled: true;
}
export declare function disabledPlanWorkers(snapshot: {
    catalog: readonly {
        id: AdapterId;
    }[];
    config: {
        adapters?: Partial<Record<AdapterId, {
            enabled?: boolean;
        }>>;
    };
    probes: Partial<Record<AdapterId, {
        found: boolean;
    }>>;
}, copy: {
    labelOf: (id: AdapterId) => string;
    productOf: (id: AdapterId) => string;
    missingLabel: string;
    unavailableLabel: string;
}): DisabledPlanWorker[];
export declare function selectPlanTarget(target: string): 'dsh' | null;
export type PrepareHandoffResult = {
    state: 'prepared';
    token: string;
} | {
    state: 'submitted';
    jobId: string;
};
export type CommitHandoffResult = {
    state: 'submitted';
    jobId: string;
};
/** Fail closed before any pending-question response or Product Worker side effect. */
export declare function approveDshPlan(commit: (() => Promise<boolean>) | null, respond: () => Promise<void>): Promise<boolean>;
export declare function handoffPlan(_args: {
    prepare: () => Promise<PrepareHandoffResult>;
    cancel: () => Promise<void>;
    commit: (token: string) => Promise<CommitHandoffResult>;
    remember?: (token: string) => void;
}): Promise<CommitHandoffResult>;
export {};
//# sourceMappingURL=plan-review.d.ts.map