/** External Agents Plan-review router and registered child entry. */

import type { CSSProperties } from 'react'
import type { PendingWait } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, IconEditOutline16, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { CONTINUE_IN_DSH_SLOT, type ContinueInDshOwner, type ExternalAgentsSnapshot } from '../client-contract.ts'
import { planReviewOf } from './plan-review.ts'
import { usePlanReviewController } from './plan-review-controller.ts'

export { CONTINUE_IN_DSH_SLOT } from '../client-contract.ts'
export type { ContinueInDshOwner, ExternalAgentPlanTargetId, PlanExternalAgentTarget, PlanTargetId } from '../client-contract.ts'

/** Backward-compatible ./client target shape from the original child-slot API. */
export interface PlanWorkerTarget {
  id: string
  label: string
  description?: string
  disabled?: boolean
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'external-agents.plan-review.continue-in-dsh': { kind: 'single'; scope: 'session'; owner: ContinueInDshOwner }
  }
}

type QuestionWait = PendingWait<'question'>
export interface ExternalPlanReviewFace { loadTargets: () => Promise<ExternalAgentsSnapshot> }
export type ExternalPlanReviewCardProps = PropsRuntime<'conversation.composer'>
  & PropsRenderSlots<typeof CONTINUE_IN_DSH_SLOT>
  & PropsLocale<'settings.external-agents'>
  & InjectFace<ExternalPlanReviewFace>
  & { matched: QuestionWait }

const frame: CSSProperties = {
  width: '100%', display: 'flex', justifyContent: 'center',
  padding: '12px max(16px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
}
const card: CSSProperties = { width: 'min(860px, 100%)', maxHeight: 'min(760px, calc(100vh - 120px))', display: 'flex', flexDirection: 'column', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 18, background: 'var(--dsw-alias-bg-layer-2)', overflow: 'hidden', boxShadow: 'var(--dsw-shadow-lv2)' }
const head: CSSProperties = { padding: '20px 22px 14px', borderBottom: '1px solid var(--dsw-alias-border-l2)' }
const kicker: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-tertiary)', textTransform: 'uppercase', letterSpacing: '.08em' }
const title: CSSProperties = { margin: '4px 0 0', fontSize: 20, lineHeight: '28px', color: 'var(--dsw-alias-label-primary)' }
const body: CSSProperties = { flex: 1, minHeight: 120, overflow: 'auto', padding: '18px 22px' }
const router: CSSProperties = { padding: '14px 22px', borderTop: '1px solid var(--dsw-alias-border-l2)', display: 'flex', flexDirection: 'column', gap: 10 }
const fallbackSelect: CSSProperties = { width: '100%', minHeight: 36, padding: '7px 10px', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8 }
const footer: CSSProperties = {
  padding: '12px 22px 18px', display: 'flex', gap: 8, justifyContent: 'space-between',
  alignItems: 'center', flexWrap: 'wrap',
}

function CurrentModelSelector({ owner, label }: { owner: ContinueInDshOwner; label: string }) {
  return <select
    aria-label={label}
    style={fallbackSelect}
    disabled={owner.locked}
    value={owner.selectedTarget}
    onChange={event => { owner.selectTarget(event.currentTarget.value as ContinueInDshOwner['selectedTarget']) }}
  >
    <option value='dsh'>{label}</option>
    {owner.targets.map(target => <option key={target.id} value={target.id} disabled>{target.label}</option>)}
  </select>
}

export function ExternalPlanReviewCard(props: ExternalPlanReviewCardProps) {
  const review = planReviewOf(props.matched.payload.questions)
  if (review === undefined) return null
  const controller = usePlanReviewController({ matched: props.matched, review, loadTargets: props.loadTargets, t: props.t })
  const owner: ContinueInDshOwner = {
    locked: controller.busy || controller.blocked,
    targets: controller.targets,
    targetsLabel: props.t('plan.workers'),
    selectedTarget: controller.selectedTarget,
    selectTarget: controller.selectTarget,
    registerCommit: controller.registerCommit,
  }

  return <div style={frame} data-external-plan-review={props.matched.key}>
    <section style={card} aria-label={review.question}>
      <header style={head}><span style={kicker}>{props.t('plan.kicker')}</span><h2 style={title}>{props.t('plan.title')}</h2></header>
      <div style={body}><MarkdownText text={review.plan} /></div>
      <div style={router}>
        <strong style={{ color: 'var(--dsw-alias-label-primary)', fontSize: 13 }}>{props.t('plan.executeWith')}</strong>
        {props.renderSlot(CONTINUE_IN_DSH_SLOT, owner, {
          fallback: <CurrentModelSelector owner={owner} label={props.t('plan.currentModel')} />,
        })}
        <span role='status' style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 }}>{props.t('plan.externalUnavailable')}</span>
      </div>
      <footer style={footer}>
        <div role='status' style={{ color: 'var(--dsw-alias-label-error)', fontSize: 12 }}>{controller.error}</div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button variant='ghost' icon={<IconEditOutline16 size={14} />} disabled={controller.busy || controller.blocked}
            onClick={controller.discuss}>{props.t('plan.discuss')}</Button>
          {review.decline !== undefined && <Button variant='ghost' disabled={controller.busy || controller.blocked}
            onClick={controller.keepPlanning}>{props.t('plan.keep')}</Button>}
          <Button disabled={!controller.approvalReady} onClick={controller.approve}>{props.t('plan.approve')}</Button>
        </div>
      </footer>
    </section>
  </div>
}
