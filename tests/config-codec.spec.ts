import { describe, expect, it } from 'vitest'
import { decodeConfig, mergeConfig } from '../src/config-codec.ts'

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
