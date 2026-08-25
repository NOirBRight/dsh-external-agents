import { describe, expect, it, vi } from 'vitest'
import { PLAN_COMMIT_ENDPOINT, PLAN_PREPARE_ENDPOINT, SAVE_ENDPOINT, SNAPSHOT_ENDPOINT } from '../src/client-contract.ts'
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

  it('fails legacy Plan handoff RPC closed before coordinator side effects', async () => {
    const prepare = vi.fn()
    const commit = vi.fn()
    const legacyDeps = {
      liveConfig: () => ({}), applyConfig: () => undefined, cachedProbes: () => ({}),
      setCachedProbes: () => undefined,
      planHandoffs: { prepare, commit },
    }
    const handler = createExternalAgentsRpcHandler(legacyDeps)
    const signal = new AbortController().signal

    await expect(handler('plan.prepare', {
      sessionId: 's1', reviewKey: 'r1', adapter: 'codex', plan: '# Plan',
    }, signal)).resolves.toMatchObject({
      ok: false,
      error: { message: 'External Agent Plan handoff is unavailable in this DSH version' },
    })
    await expect(handler('plan.commit', {
      sessionId: 's1', reviewKey: 'r1', token: 't-1',
    }, signal)).resolves.toMatchObject({ ok: false })
    expect(prepare).not.toHaveBeenCalled()
    expect(commit).not.toHaveBeenCalled()
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
