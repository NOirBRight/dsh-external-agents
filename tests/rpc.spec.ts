import { describe, expect, it, vi } from 'vitest'
import {
  EXTERNAL_AGENTS_RPC_CHANNEL, EXTERNAL_PLAN_HANDOFF_UNAVAILABLE, PLAN_COMMIT_ENDPOINT, PLAN_PREPARE_ENDPOINT,
  SAVE_ENDPOINT, SNAPSHOT_ENDPOINT,
} from '../src/client-contract.ts'
import { createExternalAgentsRpcHandler, registerExternalAgentsRpc } from '../src/rpc.ts'

function deps() {
  return {
    liveConfig: () => ({ adapters: { codex: { enabled: true } }, defaultAdapter: 'codex' as const }),
    applyConfig: vi.fn(),
    cachedProbes: () => ({}),
    setCachedProbes: vi.fn(),
  }
}

describe('external-agents RPC', () => {
  it('snapshots catalog and live config', async () => {
    const handler = createExternalAgentsRpcHandler(deps())
    const result = await handler(SNAPSHOT_ENDPOINT, {}, new AbortController().signal)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const value = result.value as { catalog: Array<{ id: string }>, config: { defaultAdapter?: string } }
    expect(value.catalog.map((row) => row.id)).toEqual(['codex', 'claude-code', 'cursor', 'antigravity'])
    expect(value.config.defaultAdapter).toBe('codex')
  })

  it('keeps legacy Plan handoff endpoints visibly fail-closed', async () => {
    const handler = createExternalAgentsRpcHandler(deps())
    const signal = new AbortController().signal
    for (const endpoint of [PLAN_PREPARE_ENDPOINT, PLAN_COMMIT_ENDPOINT]) {
      await expect(handler(endpoint, {}, signal)).resolves.toMatchObject({
        ok: false, error: { message: EXTERNAL_PLAN_HANDOFF_UNAVAILABLE },
      })
    }
  })

  it('registers one trusted-host RPC channel', () => {
    const handle = vi.fn()
    const ctx = { inject: vi.fn((_deps, callback) => callback({ connection: { rpc: { handle } } })) }
    registerExternalAgentsRpc(ctx as never, deps())
    expect(handle).toHaveBeenCalledOnce()
    expect(handle).toHaveBeenCalledWith(
      EXTERNAL_AGENTS_RPC_CHANNEL, expect.any(Function), { authority: 'trusted-host' },
    )
  })

  it('saves a decoded config through applyConfig', async () => {
    let saved: unknown
    const handler = createExternalAgentsRpcHandler({
      liveConfig: () => ({}),
      applyConfig: (config) => { saved = config },
      cachedProbes: () => ({}),
      setCachedProbes: () => undefined,
    })
    const result = await handler(SAVE_ENDPOINT, {
      adapters: { cursor: { enabled: true } }, defaultAdapter: 'cursor',
    }, new AbortController().signal)
    expect(result.ok).toBe(true)
    expect(saved).toEqual({ adapters: { cursor: { enabled: true } }, defaultAdapter: 'cursor' })
  })
})
