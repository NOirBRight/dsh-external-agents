import { describe, expect, it } from 'vitest'
import { Config } from '../src/index.ts'
import { decodeConfig, mergeConfig, validateConfig } from '../src/config-codec.ts'

describe('decodeConfig', () => {
  it('keeps Adapter env and defaultAdapter', () => {
    expect(decodeConfig({
      adapters: {
        antigravity: { enabled: true, env: { HTTPS_PROXY: 'http://127.0.0.1:9' } },
      },
      defaultAdapter: 'antigravity',
    })).toEqual({
      adapters: {
        antigravity: { enabled: true, env: { HTTPS_PROXY: 'http://127.0.0.1:9' } },
      },
      defaultAdapter: 'antigravity',
    })
  })
})

describe('mergeConfig', () => {
  it('lets persisted settings overlay yaml defaults', () => {
    expect(mergeConfig(
      { adapters: { codex: { enabled: true } } },
      { adapters: { codex: { enabled: false }, cursor: { enabled: true } } },
    )).toEqual({
      adapters: {
        codex: { enabled: false, env: {} },
        cursor: { enabled: true, env: {} },
      },
    })
  })
})

describe('Config schema', () => {
  it.each(['', '   ', '\t\n'])('rejects an enabled model containing only %j', (model) => {
    expect(() => Config({ adapters: { codex: { enabled: true, model } } })).toThrow(/match regexp|non-empty/)
  })

  it('trims an enabled model and permits disabled adapters without one', () => {
    expect(Config({ adapters: { codex: { enabled: true, model: '  codex-model  ' } } })).toMatchObject({
      adapters: { codex: { enabled: true, model: 'codex-model' } },
    })
    expect(Config({ adapters: { codex: { enabled: false } } })).toMatchObject({
      adapters: { codex: { enabled: false } },
    })
  })
})

describe('validateConfig', () => {
  it('rejects unknown adapters and invalid environment values', () => {
    expect(() => validateConfig({ adapters: { unknown: {} } })).toThrow(/unknown Adapter/)
    expect(() => validateConfig({ adapters: { codex: { env: { PATH: 1 } } } })).toThrow(/env/)
  })

  it.each(['', '   ', '\t\n'])('rejects enabled models that are %j', (model) => {
    expect(() => validateConfig({ adapters: { codex: { enabled: true, model } } })).toThrow(/non-empty/)
  })

  it('trims an enabled model and permits a disabled adapter to omit one', () => {
    expect(validateConfig({ adapters: { codex: { enabled: true, model: '  codex-model  ' } } })).toEqual({
      adapters: { codex: { enabled: true, model: 'codex-model' } },
    })
    expect(validateConfig({ adapters: { codex: { enabled: false } } })).toEqual({
      adapters: { codex: { enabled: false } },
    })
  })

  it('requires defaultAdapter to name an enabled Adapter', () => {
    expect(() => validateConfig({
      adapters: { codex: { enabled: false } },
      defaultAdapter: 'codex',
    })).toThrow(/name an enabled Adapter/)
    expect(validateConfig({
      adapters: { codex: { enabled: true, model: 'codex-model' } },
      defaultAdapter: 'codex',
    }).defaultAdapter).toBe('codex')
  })

  it('rejects non-positive or non-finite print timeouts', () => {
    expect(() => validateConfig({ adapters: { antigravity: { printTimeoutMs: 0 } } })).toThrow(/positive finite/)
    expect(() => validateConfig({ adapters: { antigravity: { printTimeoutMs: Number.POSITIVE_INFINITY } } })).toThrow(/positive finite/)
  })
})
