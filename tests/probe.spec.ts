import { afterEach, describe, expect, it, vi } from 'vitest'

import { probeAll } from '../src/probe.ts'

afterEach(() => {
  vi.useRealTimers()
})

describe('Product Worker probes', () => {
  it('settles when executable resolution ignores cancellation', async () => {
    vi.useFakeTimers()
    const pending = new Promise<string>(() => undefined)
    const work = probeAll(async () => pending, new AbortController().signal)
    let result: Awaited<typeof work> | undefined
    void work.then((value) => { result = value })

    await vi.advanceTimersByTimeAsync(2_501)

    expect(result).toEqual({
      codex: { found: false },
      'claude-code': { found: false },
      cursor: { found: false },
      antigravity: { found: false },
    })
  })
})
