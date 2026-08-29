/** Plan-review narrowing plus the fail-closed external handoff capability seam. */

import type { PendingWait } from './shim.js'
import { ADAPTER_IDS, type AdapterId } from '../catalog.ts'
import type { PlanExternalAgentTarget, PlanTargetId } from '../client-contract.ts'

export interface PlanReviewOption { label: string; description?: string }
export interface PlanReview {
  id: string
  question: string
  plan: string
  approve: PlanReviewOption
  decline?: PlanReviewOption
}
export interface QuestionItem {
  id: string
  question: string
  detail?: string
  multiSelect?: boolean
  options?: readonly PlanReviewOption[]
  intent?: { kind: string, approve?: string }
}
interface QuestionWaitLike extends Omit<PendingWait<'question'>, 'payload' | 'questions'> { key: string; questions?: readonly QuestionItem[]; payload?: { questions: readonly QuestionItem[] } }
interface ComposerOwner {
  /** alpha.1: the single effective interaction, undefined when none. */
  pendingInteraction?: { kind: string; key?: string; payload?: unknown; questions?: unknown } | undefined
  /** rc.2: the pending-interaction array. Kept as a fallback. */
  interactions?: readonly { kind: string; key?: string; payload?: unknown; questions?: unknown }[]
}

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

function isQuestionWait(value: { kind: string; key?: string; payload?: unknown; questions?: unknown }): value is QuestionWaitLike {
  if (value.kind !== 'question' && value.kind !== 'plan-review') return false
  if (Array.isArray((value as { questions?: unknown }).questions)) return true
  if (value.payload === undefined || typeof value.payload !== 'object' || value.payload === null) return false
  return Array.isArray((value.payload as { questions?: unknown }).questions)
}

function questionsOf(wait: QuestionWaitLike): readonly QuestionItem[] {
  if (Array.isArray(wait.questions)) return wait.questions as readonly QuestionItem[]
  if (wait.payload !== undefined && typeof wait.payload === 'object' && wait.payload !== null) {
    const qs = (wait.payload as { questions?: unknown }).questions
    if (Array.isArray(qs)) return qs as readonly QuestionItem[]
  }
  return []
}

export function selectPlanReview(owner: ComposerOwner): QuestionWaitLike | null {
  // alpha.1 replaced the pending-interaction array with one effective value.
  const candidates = owner.pendingInteraction !== undefined
    ? [owner.pendingInteraction]
    : owner.interactions ?? []
  const wait = candidates.find(isQuestionWait)
  if (wait === undefined) return null
  return planReviewOf(questionsOf(wait)) === undefined ? null : wait
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
): PlanExternalAgentTarget[] {
  return snapshot.catalog.map((row) => ({
      id: `external-agent:${row.id}`,
      adapterId: row.id,
      label: copy.labelOf(row.id),
      description: (snapshot.probes[row.id]?.found === false ? copy.missingLabel : copy.productOf(row.id))
        + ' · ' + copy.unavailableLabel,
      disabled: true,
    }))
}

export function selectPlanTarget(target: string): PlanTargetId | null {
  if (target === 'dsh') return target
  if (!target.startsWith('external-agent:')) return null
  const adapter = target.slice('external-agent:'.length)
  return ADAPTER_IDS.includes(adapter as AdapterId) ? target as PlanTargetId : null
}
