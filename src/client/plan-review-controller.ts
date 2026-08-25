import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PendingWait } from '@deepseek-ai/dsh-client-runtime/client'
import { ADAPTERS, type AdapterId } from '../catalog.ts'
import type { ExternalAgentsSnapshot, PlanExternalAgentTarget, PlanTargetId } from '../client-contract.ts'
import { disabledPlanWorkers, type PlanReview } from './plan-review.ts'
import type { ExternalAgentsKey } from './locales.ts'

type QuestionWait = PendingWait<'question'>
type Translate = (key: ExternalAgentsKey) => string
class ResponseRejectedError extends Error {}

async function respond(
  wait: QuestionWait, id: string, label: string, rejectedMessage: string, failedMessage: string,
): Promise<void> {
  let receipt
  try {
    receipt = await wait.respond({
      ok: true,
      value: { sessionId: wait.sessionId, answer: { answers: [{ id, selected: [label] }] } },
    })
  } catch {
    throw new Error(failedMessage)
  }
  if (!receipt.accepted) throw new ResponseRejectedError(rejectedMessage)
}

async function cancel(
  wait: QuestionWait, message: string, rejectedMessage: string, failedMessage: string,
): Promise<void> {
  let receipt
  try {
    receipt = await wait.respond({ ok: false, error: { code: 'cancelled', message, details: {} } })
  } catch {
    throw new Error(failedMessage)
  }
  if (!receipt.accepted) throw new ResponseRejectedError(rejectedMessage)
}

export interface PlanReviewControllerOptions {
  matched: QuestionWait
  review: PlanReview
  loadTargets: () => Promise<ExternalAgentsSnapshot>
  t: Translate
}

export interface PlanReviewController {
  busy: boolean
  blocked: boolean
  error: string | null
  targets: readonly PlanExternalAgentTarget[]
  selectedTarget: PlanTargetId
  approvalReady: boolean
  registerCommit: (commit: (() => Promise<boolean>) | null) => () => void
  selectTarget: (target: PlanTargetId) => void
  approve: () => void
  discuss: () => void
  keepPlanning: () => void
}

const labelKeys: Record<AdapterId, ExternalAgentsKey> = {
  codex: 'agent.codex', 'claude-code': 'agent.claude-code', cursor: 'agent.cursor', antigravity: 'agent.antigravity',
}

/** One top-card owner for routing, registered commit ordering, and receipt policy. */
export function usePlanReviewController(options: PlanReviewControllerOptions): PlanReviewController {
  const [waitKey, setWaitKey] = useState(options.matched.key)
  const [catalog, setCatalog] = useState<ExternalAgentsSnapshot | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<PlanTargetId>('dsh')
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetsError, setTargetsError] = useState<string | null>(null)
  const actionLocked = useRef(false)
  const activeWait = useRef(options.matched.key)
  const commitRef = useRef<(() => Promise<boolean>) | null>(null)

  if (waitKey !== options.matched.key) {
    activeWait.current = options.matched.key
    actionLocked.current = false
    commitRef.current = null
    setWaitKey(options.matched.key)
    setCatalog(null)
    setSelectedTarget('dsh')
    setBusy(false)
    setBlocked(false)
    setError(null)
    setTargetsError(null)
  }

  useEffect(() => {
    const identity = options.matched.key
    let active = true
    void options.loadTargets().then(
      value => { if (active && activeWait.current === identity) { setCatalog(value); setTargetsError(null) } },
      () => { if (active && activeWait.current === identity) { setCatalog(null); setTargetsError(options.t('plan.targetsFailed')) } },
    )
    return () => { active = false }
  }, [options.loadTargets, options.matched.key, options.t])

  const targets = useMemo(() => catalog === null ? [] : disabledPlanWorkers(catalog, {
    labelOf: id => options.t(labelKeys[id]),
    productOf: id => ADAPTERS[id].displayName,
    missingLabel: options.t('probeMissing'),
    unavailableLabel: options.t('plan.externalUnavailable'),
  }), [catalog, options.t])

  const execute = useCallback((work: () => Promise<void>, terminalOnRejected = false): void => {
    if (actionLocked.current || blocked) return
    const identity = options.matched.key
    actionLocked.current = true
    setBusy(true)
    setError(null)
    void work().catch((cause: unknown) => {
      if (activeWait.current !== identity) return
      actionLocked.current = false
      setBusy(false)
      if (terminalOnRejected && cause instanceof ResponseRejectedError) setBlocked(true)
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }, [blocked, options.matched.key])

  const registerCommit = useCallback((commit: (() => Promise<boolean>) | null): (() => void) => {
    commitRef.current = commit
    return () => { if (commitRef.current === commit) commitRef.current = null }
  }, [options.matched.key])

  const selectTarget = useCallback((target: PlanTargetId): void => {
    if (target === 'dsh' && !busy && !blocked) setSelectedTarget(target)
  }, [blocked, busy])

  const approve = useCallback((): void => {
    if (selectedTarget !== 'dsh') return
    execute(async () => {
      const commit = commitRef.current
      if (commit !== null) {
        let committed = false
        try { committed = await commit() } catch { /* localized below */ }
        if (!committed) throw new Error(options.t('plan.modelFailed'))
      }
      await respond(
        options.matched, options.review.id, options.review.approve.label,
        options.t('plan.responseRejected'), options.t('plan.responseFailed'),
      )
    }, true)
  }, [execute, options, selectedTarget])

  const discuss = useCallback((): void => {
    execute(() => cancel(
      options.matched, options.t('plan.discussCancel'),
      options.t('plan.cancelRejected'), options.t('plan.cancelFailed'),
    ))
  }, [execute, options])

  const keepPlanning = useCallback((): void => {
    if (options.review.decline === undefined) return
    execute(() => respond(
      options.matched, options.review.id, options.review.decline!.label,
      options.t('plan.responseRejected'), options.t('plan.responseFailed'),
    ))
  }, [execute, options])

  return {
    busy, blocked, error: error ?? targetsError, targets, selectedTarget,
    approvalReady: !busy && !blocked && selectedTarget === 'dsh',
    registerCommit, selectTarget, approve, discuss, keepPlanning,
  }
}
