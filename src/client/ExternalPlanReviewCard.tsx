/** External Agents plan-review router. */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PendingWait } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, IconEditOutline16, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { ADAPTERS, type AdapterId } from '../catalog.ts'
import type { ExternalAgentsSnapshot } from '../client-contract.ts'
import { approveDshPlan, disabledPlanWorkers, planReviewOf, selectPlanTarget } from './plan-review.ts'
import type { ExternalAgentsKey } from './locales.ts'

export const CONTINUE_IN_DSH_SLOT = 'external-agents.plan-review.continue-in-dsh' as const

export interface PlanWorkerTarget {
  id: string
  label: string
  description?: string
  disabled?: boolean
}

export interface ContinueInDshOwner {
  locked: boolean
  workers: readonly PlanWorkerTarget[]
  workersLabel: string
  selectedTarget: string
  selectTarget: (target: string) => void
  registerCommit: (commit: (() => Promise<boolean>) | null) => () => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'external-agents.plan-review.continue-in-dsh': {
      kind: 'single'
      scope: 'session'
      owner: ContinueInDshOwner
    }
  }
}

type QuestionWait = PendingWait<'question'>

type Props = PropsRuntime<'conversation.composer'>
  & PropsRenderSlots<typeof CONTINUE_IN_DSH_SLOT>
  & { matched: QuestionWait }
  & {
    t: (key: ExternalAgentsKey) => string
    load: () => Promise<ExternalAgentsSnapshot>
  }

async function respond(wait: QuestionWait, id: string, label: string): Promise<void> {
  const receipt = await wait.respond({
    ok: true,
    value: { sessionId: wait.sessionId, answer: { answers: [{ id, selected: [label] }] } },
  })
  if (!receipt.accepted) throw new Error('question response rejected: ' + receipt.reason)
}


async function cancel(wait: QuestionWait, message: string): Promise<void> {
  const receipt = await wait.respond({
    ok: false,
    error: { code: 'cancelled', message, details: {} },
  })
  if (!receipt.accepted) throw new Error('question cancellation rejected: ' + receipt.reason)
}

const frame: CSSProperties = { width: '100%', display: 'flex', justifyContent: 'center', padding: '12px 16px' }
const card: CSSProperties = { width: 'min(860px, 100%)', maxHeight: 'min(760px, calc(100vh - 120px))', display: 'flex', flexDirection: 'column', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 18, background: 'var(--dsw-alias-bg-layer-2)', overflow: 'hidden', boxShadow: 'var(--dsw-shadow-lv2)' }
const head: CSSProperties = { padding: '20px 22px 14px', borderBottom: '1px solid var(--dsw-alias-border-l2)' }
const kicker: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-tertiary)', textTransform: 'uppercase', letterSpacing: '.08em' }
const title: CSSProperties = { margin: '4px 0 0', fontSize: 20, lineHeight: '28px', color: 'var(--dsw-alias-label-primary)' }
const body: CSSProperties = { flex: 1, minHeight: 120, overflow: 'auto', padding: '18px 22px' }
const router: CSSProperties = { padding: '14px 22px', borderTop: '1px solid var(--dsw-alias-border-l2)', display: 'flex', flexDirection: 'column', gap: 10 }
const fallbackSelect: CSSProperties = { width: '100%', minHeight: 36, padding: '7px 10px', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8 }
const workerLabels: Record<AdapterId, string> = { codex: 'Codex Worker', 'claude-code': 'Claude Worker', cursor: 'Cursor Worker', antigravity: 'Antigravity Worker' }
const footer: CSSProperties = { padding: '12px 22px 18px', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }

export function ExternalPlanReviewCard(props: Props) {
  const review = useMemo(() => planReviewOf(props.matched.payload.questions as Parameters<typeof planReviewOf>[0]), [props.matched])
  const [snapshot, setSnapshot] = useState<ExternalAgentsSnapshot | null>(null)
  const [target, setTarget] = useState<'dsh' | AdapterId>('dsh')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dshCommit = useRef<(() => Promise<boolean>) | null>(null)

  useEffect(() => { void props.load().then(setSnapshot, cause => { setError(String(cause)) }) }, [props.load])
  if (review === undefined) return null

  const workers: PlanWorkerTarget[] = snapshot === null ? [] : disabledPlanWorkers(snapshot, {
    labelOf: id => workerLabels[id],
    productOf: id => ADAPTERS[id].displayName,
    missingLabel: props.t('probeMissing'),
    unavailableLabel: props.t('plan.externalUnavailable'),
  })
  const selectTarget = (next: string): void => {
    const selected = selectPlanTarget(next)
    if (selected !== null) setTarget(selected)
  }
  const registerCommit = (commit: (() => Promise<boolean>) | null): (() => void) => {
    dshCommit.current = commit
    return () => { if (dshCommit.current === commit) dshCommit.current = null }
  }
  const settle = (work: () => Promise<void>): void => {
    setBusy(true)
    setError(null)
    void work().catch((cause: unknown) => { setBusy(false); setError(cause instanceof Error ? cause.message : String(cause)) })
  }
  const approveDsh = (): void => {
    settle(async () => {
      const committed = await approveDshPlan(
        dshCommit.current,
        () => respond(props.matched, review.id, review.approve.label),
      )
      if (!committed) throw new Error(props.t('plan.modelFailed'))
    })
  }

  return <div style={frame} data-external-plan-review={props.matched.key}>
    <section style={card} aria-label={review.question}>
      <header style={head}><span style={kicker}>{props.t('plan.kicker')}</span><h2 style={title}>{props.t('plan.title')}</h2></header>
      <div style={body}><MarkdownText text={review.plan} /></div>
      <div style={router}>
        <strong style={{ color: 'var(--dsw-alias-label-primary)', fontSize: 13 }}>{props.t('plan.executeWith')}</strong>
        {props.renderSlot(CONTINUE_IN_DSH_SLOT, {
          locked: busy, workers, workersLabel: props.t('plan.workers'), selectedTarget: target, selectTarget, registerCommit,
        }, {
          fallback: <select aria-label={props.t('plan.executeWith')} style={fallbackSelect} value={target} disabled={busy} onChange={event => { selectTarget(event.target.value) }}>
            <option value='dsh'>{props.t('plan.currentModel')}</option>
            {workers.map(worker => <option key={worker.id} value={worker.id} disabled={worker.disabled}>{worker.label}</option>)}
          </select>,
        })}
        <span role='status' style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 }}>{props.t('plan.externalUnavailable')}</span>
      </div>
      <footer style={footer}>
        <div role='status' style={{ color: 'var(--dsw-alias-label-error)', fontSize: 12 }}>{error}</div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <Button variant='ghost' icon={<IconEditOutline16 size={14} />} disabled={busy} onClick={() => { settle(() => cancel(props.matched, 'the user closed this plan review to discuss it')) }}>{props.t('plan.discuss')}</Button>
          {review.decline !== undefined && <Button variant='ghost' disabled={busy} onClick={() => { settle(() => respond(props.matched, review.id, review.decline!.label)) }}>{props.t('plan.keep')}</Button>}
          <Button disabled={busy} onClick={approveDsh}>{props.t('plan.approve')}</Button>
        </div>
      </footer>
    </section>
  </div>
}
