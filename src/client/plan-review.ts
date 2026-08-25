/** Plan-review narrowing plus the fail-closed external handoff capability seam. */

import type { PendingWait } from '@deepseek-ai/dsh-client-runtime/client'
import type { AdapterId } from '../catalog.ts'
import { EXTERNAL_PLAN_HANDOFF_UNAVAILABLE } from '../client-contract.ts'

export interface PlanReviewOption { label: string; description?: string }
export interface PlanReview {
  id: string
  question: string
  plan: string
  approve: PlanReviewOption
  decline?: PlanReviewOption
}
interface QuestionItem {
  id: string
  question: string
  detail?: string
  multiSelect?: boolean
  options?: readonly PlanReviewOption[]
  intent?: { kind: string, approve?: string }
}
type QuestionWaitLike = PendingWait<'question'>
interface ComposerOwner { interactions: readonly PendingWait[] }

export function planReviewOf(questions: readonly QuestionItem[]): PlanReview | undefined {
  if (questions.length !== 1) return undefined
  const question = questions[0]
  if (question === undefined || question.intent?.kind !== 'plan-review' || question.detail === undefined) return undefined
  if (question.multiSelect === true) return undefined
  const options = question.options ?? []
  if (options.length > 2) return undefined
  const approve = options.find(option => option.label === question.intent?.approve)
  if (approve === undefined) return undefined
  const decline = options.find(option => option.label !== question.intent?.approve)
  return { id: question.id, question: question.question, plan: question.detail, approve,
    ...decline === undefined ? {} : { decline } }
}

function isQuestionWait(value: PendingWait): value is QuestionWaitLike {
  return value.kind === 'question'
}

export function selectPlanReview(owner: ComposerOwner): QuestionWaitLike | null {
  const wait = owner.interactions.find(isQuestionWait)
  return wait === undefined || planReviewOf(wait.payload.questions) === undefined ? null : wait
}

export function planHandoffAvailability() {
  return { available: false as const, reasonKey: 'plan.externalUnavailable' as const }
}

export interface DisabledPlanWorker {
  id: AdapterId
  label: string
  description: string
  disabled: true
}

export function disabledPlanWorkers(
  snapshot: {
    catalog: readonly { id: AdapterId }[]
    config: { adapters?: Partial<Record<AdapterId, { enabled?: boolean }>> }
    probes: Partial<Record<AdapterId, { found: boolean }>>
  },
  copy: {
    labelOf: (id: AdapterId) => string
    productOf: (id: AdapterId) => string
    missingLabel: string
    unavailableLabel: string
  },
): DisabledPlanWorker[] {
  return snapshot.catalog
    .filter(row => snapshot.config.adapters?.[row.id]?.enabled !== false)
    .map((row) => ({
      id: row.id,
      label: copy.labelOf(row.id),
      description: (snapshot.probes[row.id]?.found === false ? copy.missingLabel : copy.productOf(row.id))
        + ' · ' + copy.unavailableLabel,
      disabled: true,
    }))
}

export function selectPlanTarget(target: string): 'dsh' | null {
  return target === 'dsh' ? 'dsh' : null
}

export type PrepareHandoffResult = { state: 'prepared', token: string } | { state: 'submitted', jobId: string }
export type CommitHandoffResult = { state: 'submitted', jobId: string }

/** Fail closed before any pending-question response or Product Worker side effect. */
export async function approveDshPlan(
  commit: (() => Promise<boolean>) | null,
  respond: () => Promise<void>,
): Promise<boolean> {
  if (commit !== null && !await commit()) return false
  await respond()
  return true
}

export async function handoffPlan(_args: {
  prepare: () => Promise<PrepareHandoffResult>
  cancel: () => Promise<void>
  commit: (token: string) => Promise<CommitHandoffResult>
  remember?: (token: string) => void
}): Promise<CommitHandoffResult> {
  throw new Error(EXTERNAL_PLAN_HANDOFF_UNAVAILABLE)
}
