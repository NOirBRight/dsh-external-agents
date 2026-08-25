import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: () => null, IconEditOutline16: () => null, MarkdownText: () => null,
}))

import { CONTINUE_IN_DSH_SLOT } from '../src/client-contract.ts'
import { apply, CONTINUE_IN_DSH_SLOT as CLIENT_CONTINUE_IN_DSH_SLOT } from '../src/client/index.ts'

function registrationBench(rpcCall = vi.fn()) {
  const entries: Array<{ spec: Record<string, unknown>; component: unknown }> = []
  const localeDispose = vi.fn()
  const registerLocale = vi.fn(() => localeDispose)
  const effects: unknown[] = []
  const slots = {
    inject: (_name: string, register: () => unknown) => register(),
    register: (spec: Record<string, unknown>, component: unknown) => {
      entries.push({ spec, component }); return () => undefined
    },
  }
  const directory = {
    store: { subscribe: vi.fn(), getSnapshot: vi.fn(() => ({ current: null, error: null })) },
    load: vi.fn(async () => undefined), select: vi.fn(async () => undefined),
  }
  const directoryFor = vi.fn(() => directory)
  const ctx = {
    locale: { register: registerLocale, bind: vi.fn(() => (key: string) => key) },
    slots, modelDirectories: { directoryFor },
    inject: (_names: string[], callback: (scope: unknown) => void) => callback(ctx),
    effect: (register: () => unknown) => { const value = register(); effects.push(value); return value },
    get: vi.fn(() => ({ rpc: { call: rpcCall } })),
  }
  apply(ctx as never)
  return { entries, effects, localeDispose, registerLocale, directory, directoryFor }
}

describe('client plugin composition', () => {
  it('keeps the loaded target catalog when the follow-up probe fails', async () => {
    const snapshot = {
      config: { adapters: {} }, probes: {},
      catalog: [{
        id: 'codex', displayName: 'Codex', executable: 'codex', toolName: 'subagent_codex',
        docsUrl: 'https://example.test', loginMode: 'product-managed', supportsUnattended: true,
        knownModels: [],
      }],
    }
    const rpcCall = vi.fn()
      .mockResolvedValueOnce({ ok: true, value: snapshot })
      .mockResolvedValueOnce({ ok: false, error: { message: 'probe unavailable' } })
    const { entries } = registrationBench(rpcCall)
    const face = (entries[0]!.spec.inject as () => { loadTargets: () => Promise<typeof snapshot> })()
    await expect(face.loadTargets()).resolves.toMatchObject({ catalog: [{ id: 'codex' }], probes: {} })
  })

  it('registers the Plan owner and settings section through public slots', () => {
    const { entries, effects, localeDispose, registerLocale, directoryFor } = registrationBench()
    expect(CLIENT_CONTINUE_IN_DSH_SLOT).toBe(CONTINUE_IN_DSH_SLOT)
    expect(entries.map(({ spec }) => spec.name)).toEqual(['conversation.composer', 'settings.section'])

    const planReview = entries[0]!.spec
    expect(planReview.priority).toBe(-6)
    expect(typeof planReview.select).toBe('function')
    expect(planReview.children).toEqual({ [CONTINUE_IN_DSH_SLOT]: { kind: 'single', scope: 'session' } })
    expect(JSON.stringify(planReview)).not.toContain('conversation.composer.plan-review.execution-model')
    const face = (planReview.inject as (sessionId: string) => Record<string, unknown>)('session-1')
    expect(directoryFor).not.toHaveBeenCalled()
    expect(face).toEqual({ loadTargets: expect.any(Function) })
    expect(face).not.toHaveProperty('selectModel')

    const settings = entries[1]!.spec
    expect(settings).toMatchObject({ id: 'external-agents', order: 14 })
    expect(typeof settings.label).toBe('function')
    expect(typeof settings.inject).toBe('function')

    expect(registerLocale).toHaveBeenCalledWith('settings.external-agents', expect.objectContaining({ en: expect.any(Object), zh: expect.any(Object) }))
    expect(effects).toContain(localeDispose)
  })
})
