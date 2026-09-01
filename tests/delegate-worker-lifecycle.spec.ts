import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-subagent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepseek-ai/dsh-subagent')>()
  return {
    ...actual,
    settleRun: vi.fn(async (run: { result: Promise<{ stopReason: string }>; dispose: () => void | Promise<void> }) => {
      const result = await run.result
      await run.dispose()
      return result.stopReason === 'completed'
        ? { status: 'completed' as const }
        : { status: 'failed' as const, detail: result.stopReason }
    }),
  }
})

import { registerDelegateWorker } from '../src/delegate-worker.ts'
import { resolveExposure } from '../src/exposure.ts'

type RegisteredTool = {
  execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown>
}

type JobRegistration = {
  kind: string
  label: string
  owner: unknown
  run: () => { cancel: (reason?: string) => void; done: Promise<unknown> }
}

const exposure = resolveExposure({
  defaultAdapter: 'codex',
  adapters: {
    codex: { enabled: true },
    'claude-code': { enabled: false },
    cursor: { enabled: false },
    antigravity: { enabled: false },
  },
})

function bench(run: Record<string, unknown>) {
  let tool: RegisteredTool | undefined
  let job: JobRegistration | undefined
  const subagents = { start: vi.fn(async () => run) }
  const jobs = {
    start: vi.fn((registration: JobRegistration) => {
      job = registration
      return 'job-1'
    }),
  }
  const ctx = {
    tools: {
      register: vi.fn((registered: RegisteredTool) => {
        tool = registered
        return () => undefined
      }),
    },
    subagents,
    jobs,
  }
  registerDelegateWorker(ctx as never, exposure)
  if (tool === undefined) throw new Error('delegate_worker was not registered')
  return { tool, jobs, subagents, job: () => job }
}

const parent = { id: 'parent-agent' }
const args = { description: 'review change', prompt: 'Review this bounded change.' }

describe('delegate_worker lifecycle through its registered tool', () => {
  it('settles foreground output and always disposes the run', async () => {
    const dispose = vi.fn(async () => undefined)
    const { tool, subagents } = bench({
      id: 'run-1',
      result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'done' }] }),
      dispose,
    })

    await expect(tool.execute(args, { agent: parent, signal: new AbortController().signal })).resolves.toEqual({
      kind: 'foreground',
      runId: 'run-1',
      output: [{ type: 'text', text: 'done' }],
    })
    expect(subagents.start).toHaveBeenCalledWith('codex', expect.objectContaining({
      label: 'review change',
      prompt: [{ type: 'text', text: 'Review this bounded change.' }],
      parent,
    }))
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('preserves partial output and disposal failure when foreground execution fails', async () => {
    const { tool } = bench({
      id: 'run-2',
      result: Promise.resolve({ stopReason: 'error', output: [{ type: 'text', text: 'partial' }] }),
      dispose: vi.fn(async () => { throw new Error('dispose failed') }),
    })

    const failure = tool.execute(args, { agent: parent, signal: new AbortController().signal })
    await expect(failure).rejects.toBeInstanceOf(AggregateError)
    await expect(failure).rejects.toThrow(/partial.*dispose failed/su)
  })

  it('registers a background Job and settles its run', async () => {
    const dispose = vi.fn(async () => undefined)
    const { tool, jobs, job } = bench({
      id: 'run-3',
      result: Promise.resolve({ stopReason: 'completed', output: [] }),
      dispose,
    })

    await expect(tool.execute({ ...args, run_in_background: true }, {
      agent: parent,
      signal: new AbortController().signal,
    })).resolves.toEqual({ kind: 'background', jobId: 'job-1' })
    expect(jobs.start).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'subagent',
      label: 'review change',
      owner: parent,
    }))
    await expect(job()?.run().done).resolves.toEqual({ status: 'completed' })
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('cleanup via dispose is idempotent', async () => {
    const dispose = vi.fn(async () => undefined)
    const { tool } = bench({ id: 'run-dispose', result: Promise.resolve({ stopReason: 'completed', output: [] }), dispose })
    await tool.execute(args, { agent: parent, signal: new AbortController().signal })
    await expect(dispose).toHaveBeenCalled()
    await expect((await import('../src/worker-runner.ts')).outputValueText([{ type: 'text', text: 'x' }])).toBe('x')
  })

  it('maps cancellation during background startup to killed', async () => {
    let tool: RegisteredTool | undefined
    let job: JobRegistration | undefined
    const jobs = {
      start: (registration: JobRegistration) => {
        job = registration
        return 'job-cancel'
      },
    }
    const ctx = {
      tools: { register: (registered: RegisteredTool) => { tool = registered } },
      jobs,
      subagents: {
        start: vi.fn(async (_provider: string, request: { signal: AbortSignal }) => new Promise((_, reject) => {
          request.signal.addEventListener('abort', () => reject(new Error('startup aborted')), { once: true })
        })),
      },
    }
    registerDelegateWorker(ctx as never, exposure)
    await tool!.execute({ ...args, run_in_background: true }, {
      agent: parent,
      signal: new AbortController().signal,
    })
    const handle = job!.run()
    handle.cancel('stop now')
    await expect(handle.done).resolves.toEqual({ status: 'killed' })
  })
})
