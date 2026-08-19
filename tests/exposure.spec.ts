import { describe, expect, it } from 'vitest'
import { resolveDelegationTarget, resolveExposure } from '../src/exposure.ts'

const bothEnabled = {
  adapters: {
    codex: { enabled: true },
    'claude-code': { enabled: true },
    cursor: { enabled: false },
    antigravity: { enabled: false },
  },
}

describe('resolveExposure', () => {
  it('turns every Adapter on when the config omits enabled', () => {
    expect(resolveExposure({}).named.map(row => row.adapter)).toEqual([
      'codex', 'claude-code', 'cursor', 'antigravity',
    ])
  })

  it('registers no tools when every Adapter is off', () => {
    expect(resolveExposure({
      adapters: {
        codex: { enabled: false },
        'claude-code': { enabled: false },
        cursor: { enabled: false },
        antigravity: { enabled: false },
      },
    })).toEqual({
      named: [],
      defaultAdapter: undefined,
      delegateWorker: false,
    })
  })

  it('exposes official named tools only when enabled', () => {
    expect(resolveExposure(bothEnabled)).toEqual({
      named: [
        { adapter: 'codex', provider: 'codex', toolName: 'subagent_codex' },
        { adapter: 'claude-code', provider: 'claude-code', toolName: 'subagent_claude_code' },
      ],
      defaultAdapter: 'codex',
      delegateWorker: true,
    })
  })

  it('drops a named tool when that Adapter is disabled', () => {
    const exposure = resolveExposure({
      adapters: {
        codex: { enabled: false },
        'claude-code': { enabled: true },
        cursor: { enabled: false },
        antigravity: { enabled: false },
      },
    })
    expect(exposure.named.map(row => row.toolName)).toEqual(['subagent_claude_code'])
    expect(exposure.defaultAdapter).toBe('claude-code')
  })

  it('honors a pinned Default Adapter when that Adapter is enabled', () => {
    expect(resolveExposure({
      ...bothEnabled,
      defaultAdapter: 'claude-code',
    }).defaultAdapter).toBe('claude-code')
  })

  it('falls back when the pin is disabled', () => {
    expect(resolveExposure({
      adapters: {
        codex: { enabled: false },
        'claude-code': { enabled: true },
        cursor: { enabled: false },
        antigravity: { enabled: false },
      },
      defaultAdapter: 'codex',
    }).defaultAdapter).toBe('claude-code')
  })

  it('exposes Cursor and Antigravity tools when those Adapters are enabled', () => {
    const exposure = resolveExposure({
      adapters: {
        codex: { enabled: false },
        'claude-code': { enabled: false },
        cursor: { enabled: true },
        antigravity: { enabled: true },
      },
      defaultAdapter: 'cursor',
    })
    expect(exposure.named.map(row => row.toolName)).toEqual(['worker_cursor', 'worker_antigravity'])
    expect(exposure.defaultAdapter).toBe('cursor')
  })
})

describe('resolveDelegationTarget', () => {
  const exposure = resolveExposure(bothEnabled)

  it('uses the Default Adapter when adapter is omitted', () => {
    expect(resolveDelegationTarget(exposure, undefined)).toEqual({
      ok: true,
      adapter: 'codex',
      provider: 'codex',
    })
  })

  it('routes an explicit official Adapter', () => {
    expect(resolveDelegationTarget(exposure, 'claude-code')).toEqual({
      ok: true,
      adapter: 'claude-code',
      provider: 'claude-code',
    })
  })

  it('rejects an unknown, unimplemented, or disabled Adapter', () => {
    expect(resolveDelegationTarget(exposure, 'gemini').ok).toBe(false)
    expect(resolveDelegationTarget(exposure, 'cursor').ok).toBe(false)
    expect(resolveDelegationTarget(resolveExposure({
      adapters: {
        codex: { enabled: true },
        'claude-code': { enabled: false },
        cursor: { enabled: false },
        antigravity: { enabled: false },
      },
    }), 'claude-code').ok).toBe(false)
  })

  it('rejects a call when nothing is enabled', () => {
    const target = resolveDelegationTarget(resolveExposure({
      adapters: {
        codex: { enabled: false },
        'claude-code': { enabled: false },
        cursor: { enabled: false },
        antigravity: { enabled: false },
      },
    }), undefined)
    expect(target.ok).toBe(false)
    if (!target.ok) expect(target.error).toContain('delegate_worker')
  })
})
