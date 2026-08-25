import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: () => null,
  IconEditOutline16: () => null,
  MarkdownText: () => null,
}))

import { apply, CONTINUE_IN_DSH_SLOT } from '../src/client/index.ts'

function registrationBench() {
  const entries: Array<{ spec: Record<string, unknown>; component: unknown }> = []
  const slots = {
    inject: (_name: string, register: () => unknown) => register(),
    register: (spec: Record<string, unknown>, component: unknown) => {
      entries.push({ spec, component })
      return () => undefined
    },
  }
  const ctx = {
    locale: {
      register: vi.fn(() => () => undefined),
      bind: vi.fn(() => (key: string) => key),
    },
    slots,
    effect: (register: () => unknown) => register(),
    get: vi.fn(() => ({ rpc: { call: vi.fn() } })),
  }
  apply(ctx as never)
  return entries
}

describe('client plugin composition', () => {
  it('owns Plan Review at priority -6 and declares only its plugin-owned child seam', () => {
    const entries = registrationBench()
    const planReview = entries.find(({ spec }) => spec.name === 'conversation.composer')

    expect(planReview?.spec.priority).toBe(-6)
    expect(typeof planReview?.spec.select).toBe('function')
    expect(planReview?.spec.children).toEqual({
      [CONTINUE_IN_DSH_SLOT]: { kind: 'single', scope: 'session' },
    })
    expect(JSON.stringify(planReview?.spec)).not.toContain('conversation.composer.plan-review.execution-model')
  })
})
