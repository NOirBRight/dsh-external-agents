import { describe, expect, it, vi, beforeEach } from 'vitest'

const storeState = vi.hoisted(() => ({
  savePersistedConfig: vi.fn(),
  dshHome: vi.fn(() => '/tmp/dsh-external-agents-test'),
  loadPersistedConfig: vi.fn(() => undefined),
  loadPersistedProbes: vi.fn(() => ({})),
  savePersistedProbes: vi.fn(),
}))
const scopeState = vi.hoisted(() => ({
  scopes: [] as Array<{ ctx: Record<string, unknown>, dispose: ReturnType<typeof vi.fn> }>,
  disposeErrors: [] as Error[],
}))

vi.mock('../src/store.ts', () => storeState)
vi.mock('@deepseek-ai/dsh-scope', () => ({
  createScope: (ctx: Record<string, unknown>) => {
    const scope = {
      ctx,
      dispose: vi.fn(async () => {
        const error = scopeState.disposeErrors.shift()
        if (error !== undefined) throw error
      }),
    }
    scopeState.scopes.push(scope)
    return scope
  },
}))

import { apply, inject } from '../src/index.ts'
import { SAVE_ENDPOINT } from '../src/client-contract.ts'

function fakeContext(options: { failPluginCall?: number, strictServiceAccess?: boolean, withSubprocess?: boolean } = {}) {
  const plugins: unknown[] = []
  const tools: string[] = []
  const effects: unknown[] = []
  let pluginCalls = 0
  const rpcHandle = vi.fn(() => vi.fn(async () => undefined))
  const target: Record<string, unknown> = {
    plugin: vi.fn((_plugin: unknown, config: unknown) => {
      pluginCalls += 1
      plugins.push(config)
      if (options.failPluginCall === pluginCalls) throw new Error('candidate mount failed')
      return Promise.resolve(undefined)
    }),
    tools: {
      register: vi.fn((definition: { name: string }) => {
        tools.push(definition.name)
        return vi.fn()
      }),
    },
    subagents: {},
    jobs: {},
    systemPrompt: {},
    connection: { rpc: { handle: rpcHandle } },
    subprocess: options.withSubprocess === false ? undefined : {
      resolveExecutable: vi.fn(),
      spawn: vi.fn(),
    },
    skills: undefined,
    logger: { info: vi.fn(), warn: vi.fn() },
    effect: vi.fn((setup: () => unknown) => {
      const disposer = setup()
      effects.push(disposer)
      return disposer
    }),
  }
  target.get = vi.fn((name: string) => target[name])
  const ctx = options.strictServiceAccess === true
    ? new Proxy(target, {
        get(target, property, receiver) {
          if (property === 'subprocess' || property === 'skills') {
            throw new Error(`cannot get property "${String(property)}" without inject`)
          }
          return Reflect.get(target, property, receiver)
        },
      })
    : target
  return { ctx, plugins, tools, effects, rpcHandle }
}

beforeEach(() => {
  storeState.savePersistedConfig.mockReset()
  storeState.loadPersistedConfig.mockReturnValue(undefined)
  storeState.loadPersistedProbes.mockReturnValue({})
  storeState.savePersistedProbes.mockReset()
  scopeState.scopes.length = 0
  scopeState.disposeErrors.length = 0
})

describe('apply', () => {
  it('mounts only the enabled provider and its named tool', async () => {
    const { ctx, plugins, tools } = fakeContext()
    await apply(ctx as never, {
      adapters: {
        codex: { enabled: true, model: 'codex-model' },
        'claude-code': { enabled: false },
        cursor: { enabled: false },
        antigravity: { enabled: false },
      },
    })
    expect(plugins).toEqual([
      { env: {}, model: 'codex-model' },
      {
        provider: 'codex',
        toolName: 'subagent_codex',
        backgroundMode: 'one-shot',
        maxDepth: 'provider-managed',
      },
    ])
    expect(tools).toEqual(['delegate_worker'])
  })

  it('passes each enabled model explicitly to its provider', async () => {
    const { ctx, plugins } = fakeContext()
    await apply(ctx as never, {
      adapters: {
        codex: { enabled: true, model: '  codex-model  ' },
        'claude-code': { enabled: true, model: 'claude-model' },
      },
    })
    expect(plugins.slice(0, 2)).toEqual([
      { env: {}, model: 'codex-model' },
      { env: {}, model: 'claude-model' },
    ])
  })

  it('mounts no providers or tools when every Adapter is disabled', async () => {
    const { ctx, plugins, tools } = fakeContext()
    await apply(ctx as never, {
      adapters: {
        codex: { enabled: false },
        'claude-code': { enabled: false },
        cursor: { enabled: false },
        antigravity: { enabled: false },
      },
    })
    expect(plugins).toEqual([])
    expect(tools).toEqual([])
  })

  it('does not expose tools when subprocess capability is unavailable', async () => {
    const { ctx, plugins, tools } = fakeContext({ withSubprocess: false })
    await apply(ctx as never, { adapters: { codex: { enabled: true, model: 'codex-model' } } })
    expect(plugins).toEqual([])
    expect(tools).toEqual([])
    expect((ctx.logger as { warn: ReturnType<typeof vi.fn> }).warn).toHaveBeenCalledWith(
      expect.stringContaining('executable capability unavailable'),
    )
  })

  it('declares every host capability required by the mounted features', () => {
    expect(inject).toEqual(['tools', 'subagents', 'jobs', 'connection', 'systemPrompt'])
  })

  it('reads optional host capabilities through ctx.get', async () => {
    const { ctx, plugins } = fakeContext({ strictServiceAccess: true })
    await apply(ctx as never, {
      adapters: { codex: { enabled: true, model: 'codex-model' } },
    })
    expect((ctx.get as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('subprocess')
    expect((ctx.get as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('skills')
    expect(plugins).toHaveLength(2)
  })

  it('restores the previous scope when a candidate mount fails', async () => {
    const { ctx, rpcHandle } = fakeContext({ failPluginCall: 3 })
    await apply(ctx as never, { adapters: { codex: { enabled: true, model: 'codex-model' }, 'claude-code': { enabled: false }, cursor: { enabled: false }, antigravity: { enabled: false } } })
    const handler = rpcHandle.mock.calls[0]?.[1]
    expect(handler).toBeTypeOf('function')

    const result = await handler(SAVE_ENDPOINT, {
      adapters: { codex: { enabled: false }, cursor: { enabled: true, model: 'cursor-model' } },
    }, new AbortController().signal)

    expect(result.ok).toBe(false)
    expect(result.error.message).toMatch(/not applied/)
    expect(storeState.savePersistedConfig).not.toHaveBeenCalled()
    expect(scopeState.scopes).toHaveLength(3)
    expect(scopeState.scopes[0]?.dispose).toHaveBeenCalled()
    expect(scopeState.scopes[1]?.dispose).toHaveBeenCalled()
    expect(scopeState.scopes[2]?.dispose).not.toHaveBeenCalled()
    const snapshot = await handler('snapshot', {}, new AbortController().signal)
    expect(snapshot.value.config).toEqual({ adapters: { codex: { enabled: true, model: 'codex-model' }, 'claude-code': { enabled: false }, cursor: { enabled: false }, antigravity: { enabled: false } } })
  })

  it('rolls live state back when persistence fails after remount', async () => {
    storeState.savePersistedConfig.mockImplementationOnce(() => { throw new Error('disk full') })
    const { ctx, rpcHandle } = fakeContext()
    await apply(ctx as never, { adapters: { codex: { enabled: true, model: 'codex-model' }, 'claude-code': { enabled: false }, cursor: { enabled: false }, antigravity: { enabled: false } } })
    const handler = rpcHandle.mock.calls[0]?.[1]
    const result = await handler(SAVE_ENDPOINT, {
      adapters: { codex: { enabled: false }, cursor: { enabled: true, model: 'cursor-model' } },
    }, new AbortController().signal)

    expect(result.ok).toBe(false)
    expect(result.error.message).toMatch(/persistence failed/)
    expect(storeState.savePersistedConfig).toHaveBeenCalledTimes(1)
    const snapshot = await handler('snapshot', {}, new AbortController().signal)
    expect(snapshot.value.config).toEqual({ adapters: { codex: { enabled: true, model: 'codex-model' }, 'claude-code': { enabled: false }, cursor: { enabled: false }, antigravity: { enabled: false } } })
    expect(scopeState.scopes).toHaveLength(3)
  })

  it('preserves setup and cleanup errors during an initial mount failure', async () => {
    scopeState.disposeErrors.push(new Error('cleanup failed'))
    const { ctx } = fakeContext({ failPluginCall: 1 })
    let caught: unknown
    try {
      await apply(ctx as never, { adapters: { codex: { enabled: true, model: 'codex-model' } } })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(AggregateError)
    expect((caught as AggregateError).errors).toHaveLength(2)
    expect((caught as AggregateError).errors[0]).toMatchObject({ message: 'candidate mount failed' })
    expect((caught as AggregateError).errors[1]).toMatchObject({ message: 'cleanup failed' })
  })
})
