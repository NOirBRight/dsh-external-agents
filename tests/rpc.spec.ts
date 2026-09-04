import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  EXTERNAL_AGENTS_RPC_CHANNEL,
  PROBE_ENDPOINT,
  SAVE_ENDPOINT,
  SNAPSHOT_ENDPOINT,
} from '../src/client-contract.ts'
import { createExternalAgentsRpcHandler, registerExternalAgentsRpc, type ExternalAgentsRpcDeps } from '../src/rpc.ts'

const storeState = vi.hoisted(() => ({
  dshHome: vi.fn(() => '/tmp/dsh-external-agents-rpc-test'),
  savePersistedConfig: vi.fn(),
}))
vi.mock('../src/store.ts', () => storeState)

function deps(overrides: Partial<ExternalAgentsRpcDeps> = {}): ExternalAgentsRpcDeps {
  return {
    liveConfig: () => ({ adapters: { codex: { enabled: true, model: 'codex-model' } } }),
    applyConfig: vi.fn(async () => undefined),
    cachedProbes: () => ({}),
    setCachedProbes: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  storeState.savePersistedConfig.mockReset()
})

describe('External Agents RPC', () => {
  it('returns a catalog snapshot', async () => {
    const result = await createExternalAgentsRpcHandler(deps())(
      SNAPSHOT_ENDPOINT, {}, new AbortController().signal,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.config.adapters?.codex?.enabled).toBe(true)
      expect(result.value.catalog.length).toBeGreaterThan(0)
    }
  })

  it('rejects an unknown endpoint', async () => {
    const result = await createExternalAgentsRpcHandler(deps())(
      'unknown.endpoint', {}, new AbortController().signal,
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'internal' } })
  })

  it('reports missing executable capability with typed details', async () => {
    const result = await createExternalAgentsRpcHandler(deps())(
      PROBE_ENDPOINT, {}, new AbortController().signal,
    )
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'internal', details: { capability: 'subprocess' } },
    })
  })

  it('applies before persisting a valid config', async () => {
    const events: string[] = []
    const applyConfig = vi.fn(async () => { events.push('apply') })
    storeState.savePersistedConfig.mockImplementation(() => { events.push('persist') })
    const result = await createExternalAgentsRpcHandler(deps({ applyConfig }))(
      SAVE_ENDPOINT, { adapters: { cursor: { enabled: true, model: 'cursor-model' } } }, new AbortController().signal,
    )
    expect(result).toMatchObject({ ok: true, value: { saved: true } })
    expect(events).toEqual(['apply', 'persist'])
    expect(applyConfig).toHaveBeenCalledWith({ adapters: { cursor: { enabled: true, model: 'cursor-model' } } })
  })

  it('clears a disabled Default Adapter before applying and persisting', async () => {
    const applyConfig = vi.fn(async () => undefined)
    const result = await createExternalAgentsRpcHandler(deps({ applyConfig }))(
      SAVE_ENDPOINT,
      {
        adapters: {
          codex: { enabled: false, model: 'codex-model' },
          cursor: { enabled: true, model: 'cursor-model' },
        },
        defaultAdapter: 'codex',
      },
      new AbortController().signal,
    )

    const expected = {
      adapters: {
        codex: { enabled: false, model: 'codex-model' },
        cursor: { enabled: true, model: 'cursor-model' },
      },
    }
    expect(result).toMatchObject({ ok: true, value: { saved: true } })
    expect(applyConfig).toHaveBeenCalledWith(expected)
    expect(storeState.savePersistedConfig).toHaveBeenCalledWith(expect.any(String), expected)
  })

  it('does not persist when remount fails', async () => {
    const applyConfig = vi.fn(async () => { throw new Error('mount rejected') })
    const result = await createExternalAgentsRpcHandler(deps({ applyConfig }))(
      SAVE_ENDPOINT, { adapters: { cursor: { enabled: true, model: 'cursor-model' } } }, new AbortController().signal,
    )
    expect(result).toMatchObject({ ok: false })
    expect(storeState.savePersistedConfig).not.toHaveBeenCalled()
  })

  it('restores live state when persistence fails', async () => {
    const previous = { adapters: { codex: { enabled: true, model: 'codex-model' } } }
    const applyConfig = vi.fn(async () => undefined)
    storeState.savePersistedConfig.mockImplementation(() => { throw new Error('disk full') })
    const result = await createExternalAgentsRpcHandler(deps({
      liveConfig: () => previous,
      applyConfig,
    }))(
      SAVE_ENDPOINT, { adapters: { cursor: { enabled: true, model: 'cursor-model' } } }, new AbortController().signal,
    )
    expect(result).toMatchObject({ ok: false })
    expect(applyConfig).toHaveBeenNthCalledWith(1, { adapters: { cursor: { enabled: true, model: 'cursor-model' } } })
    expect(applyConfig).toHaveBeenNthCalledWith(2, previous)
  })

  it('registers the official channel disposer through an effect', () => {
    const dispose = vi.fn(async () => undefined)
    const handle = vi.fn(() => dispose)
    const effect = vi.fn((setup: () => unknown) => setup())
    const ctx = { connection: { rpc: { handle } }, effect }
    registerExternalAgentsRpc(ctx as never, deps())
    expect(effect).toHaveBeenCalledTimes(1)
    expect(handle).toHaveBeenCalledTimes(1)
    expect(handle.mock.calls[0]?.[0]).toBe(EXTERNAL_AGENTS_RPC_CHANNEL)
    expect(handle.mock.calls[0]?.[1]).toBeTypeOf('function')
  })
})
