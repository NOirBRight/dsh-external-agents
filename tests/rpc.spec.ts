import { describe, expect, it } from 'vitest'
import { SAVE_ENDPOINT, SNAPSHOT_ENDPOINT } from '../src/client-contract.ts'
import { createExternalAgentsRpcHandler } from '../src/rpc.ts'

describe('external-agents RPC', () => {
  it('snapshots catalog and live config', async () => {
    const handler = createExternalAgentsRpcHandler({
      liveConfig: () => ({ adapters: { codex: { enabled: true } }, defaultAdapter: 'codex' }),
      applyConfig: () => undefined,
      cachedProbes: () => ({}),
      setCachedProbes: () => undefined,
    })
    const result = await handler(SNAPSHOT_ENDPOINT, {}, new AbortController().signal)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const value = result.value as { catalog: Array<{ id: string }>, config: { defaultAdapter?: string } }
    expect(value.catalog.map((row) => row.id)).toEqual(['codex', 'claude-code', 'cursor', 'antigravity'])
    expect(value.config.defaultAdapter).toBe('codex')
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
      adapters: { cursor: { enabled: true } },
      defaultAdapter: 'cursor',
    }, new AbortController().signal)
    expect(result.ok).toBe(true)
    expect(saved).toEqual({
      adapters: { cursor: { enabled: true } },
      defaultAdapter: 'cursor',
    })
  })
})
