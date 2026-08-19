import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'

function fakeContext() {
  const plugins: unknown[] = []
  const tools: string[] = []
  return {
    plugins,
    tools,
    ctx: {
      plugin: (_mod: unknown, config: unknown) => {
        plugins.push(config)
      },
      tools: {
        register: (definition: { name: string }) => {
          tools.push(definition.name)
          return () => undefined
        },
      },
      get: () => undefined,
      inject: () => undefined,
      logger: { info: () => undefined },
      effect: () => undefined,
      connection: { rpc: { handle: () => undefined } },
    },
  }
}

describe('apply', () => {
  it('mounts one-shot official tools only for enabled Adapters', () => {
    const { ctx, plugins, tools } = fakeContext()
    apply(ctx as never, {
      adapters: {
        codex: { enabled: true },
        'claude-code': { enabled: false },
        cursor: { enabled: false },
        antigravity: { enabled: false },
      },
    })
    expect(plugins).toEqual([
      { env: {} },
      { env: {} },
      { env: {}, unattended: 'auto' },
      { env: {}, unattended: 'auto' },
      {
        provider: 'codex',
        toolName: 'subagent_codex',
        backgroundMode: 'one-shot',
        maxDepth: 'provider-managed',
      },
    ])
    expect(tools).toEqual(['delegate_worker'])
  })

  it('registers nothing when Exposure is empty', () => {
    const { ctx, plugins, tools } = fakeContext()
    apply(ctx as never, {
      adapters: {
        codex: { enabled: false },
        'claude-code': { enabled: false },
        cursor: { enabled: false },
        antigravity: { enabled: false },
      },
    })
    expect(plugins).toEqual([
      { env: {} },
      { env: {} },
      { env: {}, unattended: 'auto' },
      { env: {}, unattended: 'auto' },
    ])
    expect(tools).toEqual([])
  })
})
