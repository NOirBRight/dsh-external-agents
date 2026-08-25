import React, { useEffect } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  IconEditOutline16: () => <span />,
  MarkdownText: ({ text }: { text: string }) => <span>{text}</span>,
}))

import { ExternalPlanReviewCard, type ContinueInDshOwner } from '../src/client/ExternalPlanReviewCard.tsx'

const snapshot = {
  catalog: [{ id: 'codex' }],
  config: { adapters: { codex: { enabled: true } } },
  probes: { codex: { found: true } },
}
function wait(respond = vi.fn(async () => ({ accepted: true }))) {
  return {
    matched: {
      kind: 'question', key: 'plan-1', sessionId: 'session-1', respond,
      payload: { questions: [{
        id: 'approve-plan', question: 'Ready?', detail: '# Plan', multiSelect: false,
        intent: { kind: 'plan-review', approve: 'Approve' },
        options: [{ label: 'Approve' }, { label: 'Keep planning' }],
      }] },
    },
    respond,
  }
}
function CombinedSlot({ owner, commit }: { owner: ContinueInDshOwner; commit: () => Promise<boolean> }) {
  useEffect(() => owner.registerCommit(commit), [owner, commit])
  return <select aria-label={owner.workersLabel} value={owner.selectedTarget} onChange={event => owner.selectTarget(event.target.value)}>
    <option value='dsh'>DSH</option>
    {owner.workers.map(worker => <option key={worker.id} value={worker.id} disabled={worker.disabled}>{worker.label}</option>)}
  </select>
}

describe('ExternalPlanReviewCard', () => {
  it('shows one external-only card with unavailable disabled Workers and no response', async () => {
    const pending = wait()
    let card!: ReturnType<typeof create>
    await act(async () => {
      card = create(<ExternalPlanReviewCard
        matched={pending.matched as never}
        t={key => key}
        load={async () => snapshot as never}
        renderSlot={(_slot, _owner, options) => options.fallback}
      />)
      await Promise.resolve()
    })
    expect(card.root.findAllByProps({ 'data-external-plan-review': 'plan-1' })).toHaveLength(1)
    expect(card.root.findAllByType('select')).toHaveLength(1)
    const worker = card.root.findAllByType('option').find(option => option.props.value === 'codex')!
    expect(worker.props.disabled).toBe(true)
    expect(card.root.findAllByProps({ role: 'status' }).some(node => node.children.includes('plan.externalUnavailable'))).toBe(true)
    await act(async () => { card.root.findByType('select').props.onChange({ target: { value: 'codex' } }) })
    expect(card.root.findByType('select').props.value).toBe('dsh')
    expect(pending.respond).not.toHaveBeenCalled()
  })

  it('combines into one selector and commits before the single approval response', async () => {
    const pending = wait()
    const commit = vi.fn(async () => true)
    let card!: ReturnType<typeof create>
    await act(async () => {
      card = create(<ExternalPlanReviewCard
        matched={pending.matched as never}
        t={key => key}
        load={async () => snapshot as never}
        renderSlot={(_slot, owner) => <CombinedSlot owner={owner} commit={commit} />}
      />)
      await Promise.resolve()
    })
    expect(card.root.findAllByProps({ 'data-external-plan-review': 'plan-1' })).toHaveLength(1)
    expect(card.root.findAllByType('select')).toHaveLength(1)
    const approve = card.root.findAllByType('button').filter(button => button.children.includes('plan.approve'))
    expect(approve).toHaveLength(1)
    await act(async () => { approve[0]!.props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(commit).toHaveBeenCalledTimes(1)
    expect(pending.respond).toHaveBeenCalledTimes(1)
    expect(commit.mock.invocationCallOrder[0]).toBeLessThan(pending.respond.mock.invocationCallOrder[0]!)
  })
})
