import { describe, expect, it, vi } from 'vitest'

import { apply, inject } from '../src/client/index.ts'

function registrationBench(rpcCall = vi.fn()) {
  const entries: Array<{ spec: Record<string, unknown>; component: unknown }> = []
  const localeDispose = vi.fn()
  const registerLocale = vi.fn(() => localeDispose)
  const effects: unknown[] = []
  const slots = {
    inject: (_name: string, register: () => unknown) => register(),
    register: (spec: Record<string, unknown>, component: unknown) => {
      entries.push({ spec, component })
      return vi.fn()
    },
  }
  const ctx = {
    locale: { register: registerLocale, bind: vi.fn(() => (key: string) => key) },
    slots,
    connection: { rpc: { call: rpcCall } },
    effect: (register: () => unknown) => { const value = register(); effects.push(value); return value },
  }
  apply(ctx as never)
  return { entries, effects, localeDispose, registerLocale }
}

describe('client plugin composition', () => {
  it('registers the External Agents settings section', () => {
    const { entries, effects, localeDispose, registerLocale } = registrationBench()
    expect(entries.map(({ spec }) => spec.name)).toEqual(['settings.section'])
    const settings = entries[0]!.spec
    expect(settings).toMatchObject({ id: 'external-agents', order: 14 })
    expect(typeof settings.label).toBe('function')
    expect(typeof settings.inject).toBe('function')
    const face = (settings.inject as () => Record<string, unknown>)()
    expect(face).toEqual(expect.objectContaining({
      t: expect.any(Function),
      load: expect.any(Function),
      probe: expect.any(Function),
      pick: expect.any(Function),
      save: expect.any(Function),
    }))
    expect(registerLocale).toHaveBeenCalledWith(
      'settings.external-agents',
      expect.objectContaining({ en: expect.any(Object), zh: expect.any(Object) }),
    )
    expect(effects).toContain(localeDispose)
  })

  it('declares the required browser services', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection'])
  })

  it('uses the RPC probe result for missing executables', async () => {
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
      .mockResolvedValueOnce({ ok: true, value: { probes: { codex: { found: false } } } })
    const { entries } = registrationBench(rpcCall)
    const face = (entries[0]!.spec.inject as () => {
      load: () => Promise<typeof snapshot>
      probe: () => Promise<Record<string, unknown>>
    })()
    const loaded = await face.load()
    expect(loaded.catalog).toHaveLength(1)
    await expect(face.probe()).resolves.toEqual({ codex: { found: false } })
  })
})
