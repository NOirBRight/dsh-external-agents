import { describe, expect, it } from 'vitest'
import * as published from 'dsh-external-agents'
import type { PlanWorkerTarget } from 'dsh-external-agents/client'

const legacyTarget: PlanWorkerTarget = { id: 'external-agent:custom', label: 'Legacy target' }

describe('published package root', () => {
  it('preserves the plugin seam and clear legacy fail-closed endpoints', () => {
    expect(published.CONTINUE_IN_DSH_SLOT).toBe('external-agents.plan-review.continue-in-dsh')
    expect(legacyTarget.label).toBe('Legacy target')
    expect(published.PLAN_PREPARE_ENDPOINT).toBe('plan.prepare')
    expect(published.PLAN_COMMIT_ENDPOINT).toBe('plan.commit')
    expect(published.EXTERNAL_PLAN_HANDOFF_UNAVAILABLE).toContain('unavailable')
    expect(published).not.toHaveProperty('handoffPlan')
  })
})
