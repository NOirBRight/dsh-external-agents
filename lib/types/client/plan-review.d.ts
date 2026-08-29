/** Plan-review narrowing plus the fail-closed external handoff capability seam. */
import type { PendingWait } from './shim.js';
import { type AdapterId } from '../catalog.ts';
import type { PlanExternalAgentTarget, PlanTargetId } from '../client-contract.ts';
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
export interface QuestionItem {
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
interface QuestionWaitLike extends Omit<PendingWait<'question'>, 'payload' | 'questions'> {
    key: string;
    questions?: readonly QuestionItem[];
    payload?: {
        questions: readonly QuestionItem[];
    };
}
interface ComposerOwner {
    /** alpha.1: the single effective interaction, undefined when none. */
    pendingInteraction?: {
        kind: string;
        key?: string;
        payload?: unknown;
        questions?: unknown;
    } | undefined;
    /** rc.2: the pending-interaction array. Kept as a fallback. */
    interactions?: readonly {
        kind: string;
        key?: string;
        payload?: unknown;
        questions?: unknown;
    }[];
}
export declare function planReviewOf(questions: readonly QuestionItem[]): PlanReview | undefined;
export declare function selectPlanReview(owner: ComposerOwner): QuestionWaitLike | null;
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
}): PlanExternalAgentTarget[];
export declare function selectPlanTarget(target: string): PlanTargetId | null;
export {};
