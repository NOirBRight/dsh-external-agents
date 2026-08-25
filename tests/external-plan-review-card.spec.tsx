import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  IconEditOutline16: () => <span />,
  MarkdownText: ({ text }: { text: string }) => <span>{text}</span>,
}))

import { ExternalPlanReviewCard, type ContinueInDshOwner } from '../src/client/ExternalPlanReviewCard.tsx'
import { en } from '../src/client/locales.ts'

const catalog = {
  catalog: [{ id: 'codex' }], config: { adapters: { codex: { enabled: true } } },
  probes: { codex: { found: true } },
}
function pending(respond = vi.fn(async () => ({ accepted: true })), key = 'plan-1') {
  return {
    kind: 'question', key, sessionId: 'session-1', respond,
    payload: { questions: [{
      id: 'approve-plan', question: 'Ready?', detail: '# Plan', multiSelect: false,
      intent: { kind: 'plan-review', approve: 'Approve' },
      options: [{ label: 'Approve' }, { label: 'Keep planning' }],
    }] },
  }
}
function props(wait = pending(), overrides: Record<string, unknown> = {}) {
  return {
    matched: wait as never,
    t: (key: keyof typeof en) => en[key],
    loadTargets: vi.fn(async () => catalog as never),
    renderSlot: (_slot: string, _owner: ContinueInDshOwner, options: { fallback: React.ReactNode }) => options.fallback,
    ...overrides,
  }
}
function button(card: ReactTestRenderer, label: string) {
  return card.root.findAllByType('button').find(node => node.children.includes(label))!
}
async function click(card: ReactTestRenderer, label: string) {
  await act(async () => { button(card, label).props.onClick(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
}
function RegisteredCommit({ owner, commit }: { owner: ContinueInDshOwner; commit: () => Promise<boolean> }) {
  React.useLayoutEffect(() => owner.registerCommit(commit), [commit, owner.registerCommit])
  return <button data-visible-picker disabled={owner.locked}>picker</button>
}

describe('ExternalPlanReviewCard', () => {
  it('publishes one typed child owner with unavailable External Agent targets', async () => {
    let captured!: ContinueInDshOwner
    let card!: ReactTestRenderer
    await act(async () => { card = create(<ExternalPlanReviewCard {...props(pending(), {
      renderSlot: (_slot: string, owner: ContinueInDshOwner) => { captured = owner; return <span data-child /> },
    }) as never} />); await Promise.resolve() })
    expect(Object.keys(captured).sort()).toEqual([
      'locked', 'registerCommit', 'selectTarget', 'selectedTarget', 'targets', 'targetsLabel',
    ])
    expect(captured.targets).toHaveLength(1)
    expect(captured.targets[0]).toMatchObject({ id: 'external-agent:codex', disabled: true })
    const frame = card.root.findByProps({ 'data-external-plan-review': 'plan-1' })
    expect(String(frame.props.style.padding)).toContain('safe-area-inset-bottom')
    expect(card.root.findByType('footer').props.style.flexWrap).toBe('wrap')
  })

  it('runs the Composer-owned commit exactly before the official response', async () => {
    const order: string[] = []
    const commit = vi.fn(async () => { order.push('commit'); return true })
    const respond = vi.fn(async () => { order.push('respond'); return { accepted: true } })
    let card!: ReactTestRenderer
    await act(async () => { card = create(<ExternalPlanReviewCard {...props(pending(respond), {
      renderSlot: (_slot: string, owner: ContinueInDshOwner) => <RegisteredCommit owner={owner} commit={commit} />,
    }) as never} />); await Promise.resolve() })
    await click(card, en['plan.approve'])
    expect(order).toEqual(['commit', 'respond'])
    expect(commit).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
  })

  it('keeps commit failure retryable and never answers before a successful commit', async () => {
    const commit = vi.fn<() => Promise<boolean>>().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const respond = vi.fn(async () => ({ accepted: true }))
    let card!: ReactTestRenderer
    await act(async () => { card = create(<ExternalPlanReviewCard {...props(pending(respond), {
      renderSlot: (_slot: string, owner: ContinueInDshOwner) => <RegisteredCommit owner={owner} commit={commit} />,
    }) as never} />); await Promise.resolve() })
    await click(card, en['plan.approve'])
    expect(respond).not.toHaveBeenCalled()
    expect(button(card, en['plan.approve']).props.disabled).toBe(false)
    await click(card, en['plan.approve'])
    expect(respond).toHaveBeenCalledTimes(1)
  })

  it('keeps thrown response transport errors retryable', async () => {
    const commit = vi.fn(async () => true)
    const respond = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ accepted: true })
    let card!: ReactTestRenderer
    await act(async () => { card = create(<ExternalPlanReviewCard {...props(pending(respond), {
      renderSlot: (_slot: string, owner: ContinueInDshOwner) => <RegisteredCommit owner={owner} commit={commit} />,
    }) as never} />); await Promise.resolve() })
    await click(card, en['plan.approve'])
    expect(button(card, en['plan.approve']).props.disabled).toBe(false)
    expect(card.root.findAllByProps({ role: 'status' }).some(node => node.children.includes(en['plan.responseFailed']))).toBe(true)
    await click(card, en['plan.approve'])
    expect(respond).toHaveBeenCalledTimes(2)
  })

  it('terminally blocks only an explicit post-commit approval rejection', async () => {
    const respond = vi.fn(async () => ({ accepted: false, reason: 'already-settled' }))
    let card!: ReactTestRenderer
    await act(async () => { card = create(<ExternalPlanReviewCard {...props(pending(respond), {
      renderSlot: (_slot: string, owner: ContinueInDshOwner) => <RegisteredCommit owner={owner} commit={async () => true} />,
    }) as never} />); await Promise.resolve() })
    await click(card, en['plan.approve'])
    expect(button(card, en['plan.approve']).props.disabled).toBe(true)
    expect(card.root.findAllByProps({ role: 'status' }).some(node => node.children.includes(en['plan.responseRejected']))).toBe(true)
  })

  it.each([
    [en['plan.discuss'], 'cancel'],
    [en['plan.keep'], 'keep'],
  ])('keeps rejected pre-commit %s responses retryable', async (label) => {
    const respond = vi.fn().mockResolvedValueOnce({ accepted: false }).mockResolvedValueOnce({ accepted: true })
    let card!: ReactTestRenderer
    await act(async () => { card = create(<ExternalPlanReviewCard {...props(pending(respond)) as never} />); await Promise.resolve() })
    await click(card, label)
    expect(button(card, label).props.disabled).toBe(false)
    await click(card, label)
    expect(respond).toHaveBeenCalledTimes(2)
  })

  it('resets terminal state and re-registers the Composer commit for a different pending wait', async () => {
    const commit = vi.fn(async () => true)
    const renderSlot = (_slot: string, owner: ContinueInDshOwner) => <RegisteredCommit owner={owner} commit={commit} />
    let card!: ReactTestRenderer
    await act(async () => { card = create(<ExternalPlanReviewCard {...props(
      pending(vi.fn(async () => ({ accepted: false })), 'one'), { renderSlot },
    ) as never} />) })
    await click(card, en['plan.approve'])
    expect(commit).toHaveBeenCalledTimes(1)
    expect(button(card, en['plan.approve']).props.disabled).toBe(true)
    await act(async () => { card.update(<ExternalPlanReviewCard {...props(pending(undefined, 'two'), { renderSlot }) as never} />); await Promise.resolve() })
    expect(button(card, en['plan.approve']).props.disabled).toBe(false)
    await click(card, en['plan.approve'])
    expect(commit).toHaveBeenCalledTimes(2)
  })
})
