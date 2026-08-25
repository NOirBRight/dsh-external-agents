import { describe, expect, it } from 'vitest'
import { disabledPlanWorkers, planReviewOf, selectPlanTarget } from '../src/client/plan-review.ts'

describe('external plan review', () => {
  it('narrows only a binary plan-review question', () => {
    expect(planReviewOf([{
      id: 'plan-review', question: 'Approve?', detail: '# Plan',
      options: [{ label: 'Approve' }, { label: 'Keep planning' }],
      intent: { kind: 'plan-review', approve: 'Approve' },
    }])).toMatchObject({ id: 'plan-review', plan: '# Plan', approve: { label: 'Approve' } })
    expect(planReviewOf([{ id: 'q', question: 'Hello?' }])).toBeUndefined()
  })

  it('uses collision-free target IDs and keeps External Agents unavailable', () => {
    const agents = disabledPlanWorkers({
      catalog: [{ id: 'codex' }], config: { adapters: { codex: { enabled: false } } },
      probes: { codex: { found: true } },
    }, {
      labelOf: () => 'Codex External Agent', productOf: () => 'Codex',
      missingLabel: 'missing', unavailableLabel: 'External Plan handoff unavailable',
    })
    expect(agents).toEqual([{
      id: 'external-agent:codex', adapterId: 'codex', label: 'Codex External Agent',
      description: 'Codex · External Plan handoff unavailable', disabled: true,
    }])
    expect(selectPlanTarget('codex')).toBeNull()
    expect(selectPlanTarget('external-agent:unknown')).toBeNull()
    expect(selectPlanTarget('external-agent:codex')).toBe('external-agent:codex')
    expect(selectPlanTarget('dsh')).toBe('dsh')
  })
})
