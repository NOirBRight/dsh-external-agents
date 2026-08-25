import { describe, expect, it, vi } from 'vitest'
import { approveDshPlan, disabledPlanWorkers, handoffPlan, planHandoffAvailability, planReviewOf, selectPlanTarget } from '../src/client/plan-review.ts'

describe('external plan review', () => {
  it('narrows only a binary plan-review question', () => {
    expect(planReviewOf([{
      id: 'plan-review', question: 'Approve?', detail: '# Plan',
      options: [{ label: 'Approve' }, { label: 'Keep planning' }],
      intent: { kind: 'plan-review', approve: 'Approve' },
    }])).toMatchObject({ id: 'plan-review', plan: '# Plan', approve: { label: 'Approve' } })
    expect(planReviewOf([{ id: 'q', question: 'Hello?' }])).toBeUndefined()
  })

  it('renders external Plan targets visibly unavailable and unselectable', () => {
    expect(planHandoffAvailability()).toEqual({ available: false, reasonKey: 'plan.externalUnavailable' })
    const workers = disabledPlanWorkers({
      catalog: [{ id: 'codex' }],
      config: { adapters: { codex: { enabled: true } } },
      probes: { codex: { found: true } },
    }, {
      labelOf: () => 'Codex Worker',
      productOf: () => 'Codex',
      missingLabel: 'missing',
      unavailableLabel: 'External Plan handoff unavailable',
    })
    expect(workers).toEqual([{
      id: 'codex',
      label: 'Codex Worker',
      description: 'Codex · External Plan handoff unavailable',
      disabled: true,
    }])
    expect(selectPlanTarget('codex')).toBeNull()
    expect(selectPlanTarget('dsh')).toBe('dsh')
  })

  it('commits the child model before the one DSH approval response', async () => {
    const commit = vi.fn(async () => true)
    const respond = vi.fn(async () => undefined)
    await expect(approveDshPlan(commit, respond)).resolves.toBe(true)
    expect(commit.mock.invocationCallOrder[0]).toBeLessThan(respond.mock.invocationCallOrder[0]!)

    respond.mockClear()
    await expect(approveDshPlan(async () => false, respond)).resolves.toBe(false)
    expect(respond).not.toHaveBeenCalled()
  })

  it('fails closed before any external Plan handoff stage', async () => {
    const prepare = vi.fn()
    const cancel = vi.fn()
    const commit = vi.fn()

    await expect(handoffPlan({ prepare, cancel, commit })).rejects.toThrow(
      'External Agent Plan handoff is unavailable in this DSH version',
    )

    expect(prepare).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
    expect(commit).not.toHaveBeenCalled()
  })
})
