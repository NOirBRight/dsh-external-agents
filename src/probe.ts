/** PATH / version / login probes. Never run synchronously from apply(). */

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-subprocess'
import { ADAPTERS, IMPLEMENTED_ADAPTER_IDS, type AdapterId } from './catalog.ts'
import type { AdapterProbe } from './client-contract.ts'

const execFileAsync = promisify(execFile)
const PROBE_TIMEOUT_MS = 2_500
const PROBE_DISPOSE_REASON = 'external-agents probe disposed'
const PROBE_TIMEOUT_REASON = 'external-agents probe timed out'

export type ExecutableResolver = SubprocessRuntime['resolveExecutable']

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function commandOutput(command: string, args: string[], signal: AbortSignal): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: PROBE_TIMEOUT_MS,
      encoding: 'utf8',
      signal,
    })
    const text = (stdout || stderr).trim()
    return text.length === 0 ? undefined : text
  } catch {
    return undefined
  }
}

function parseCursorModels(text: string): string[] {
  const ids: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9._:-]+)\s+-\s+/.exec(line.trim())
    if (match?.[1] !== undefined && !ids.includes(match[1])) ids.push(match[1])
  }
  return ids
}

function parseAgyModels(text: string): string[] {
  const ids: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || /^fetching/i.test(trimmed)) continue
    const id = trimmed.split(/\t/, 1)[0]?.trim()
    if (id !== undefined && id.length > 0 && !ids.includes(id)) ids.push(id)
  }
  return ids
}

function readCodexCachedModels(): string[] {
  try {
    const raw = readFileSync(join(homedir(), '.codex', 'models_cache.json'), 'utf8')
    const data = JSON.parse(raw) as { models?: Array<{ slug?: string, visibility?: string }> }
    return (data.models ?? [])
      .filter((row) => row.visibility !== 'hide' && typeof row.slug === 'string')
      .map((row) => row.slug as string)
  } catch {
    return []
  }
}

async function listModels(id: AdapterId, resolved: string, signal: AbortSignal): Promise<string[] | undefined> {
  signal.throwIfAborted()
  if (id === 'claude-code') return ['fable', 'opus', 'sonnet', 'haiku']
  if (id === 'codex') {
    const cached = readCodexCachedModels()
    return cached.length > 0 ? cached : undefined
  }
  if (id === 'cursor') {
    const text = await commandOutput(resolved, ['--list-models'], signal)
    const parsed = text === undefined ? [] : parseCursorModels(text)
    return parsed.length > 0 ? parsed : undefined
  }
  if (id === 'antigravity') {
    try {
      const { stdout, stderr } = await execFileAsync(resolved, ['models'], {
        timeout: 20_000,
        encoding: 'utf8',
        signal,
      })
      const parsed = parseAgyModels((stdout || stderr).trim())
      return parsed.length > 0 ? parsed : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

async function firstLine(command: string, args: string[], signal: AbortSignal): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: PROBE_TIMEOUT_MS,
      encoding: 'utf8',
      signal,
    })
    const text = (stdout || stderr).trim()
    if (text.length === 0) return undefined
    return text.split(/\r?\n/, 1)[0]
  } catch {
    return undefined
  }
}

export async function probeAdapter(
  id: AdapterId,
  resolveExecutable: ExecutableResolver,
  signal: AbortSignal,
  overridePath?: string,
): Promise<AdapterProbe> {
  const descriptor = ADAPTERS[id]
  let resolved: string
  try {
    resolved = overridePath !== undefined && overridePath.length > 0
      ? overridePath
      : await resolveExecutable(descriptor.executable, {}, signal)
  } catch {
    // Executable resolution is a presence probe; every resolver rejection means unavailable.
    return { found: false }
  }
  const [version, status] = await Promise.all([
    firstLine(resolved, ['--version'], signal),
    descriptor.loginMode === 'cursor-status' ? firstLine(resolved, ['status'], signal) : Promise.resolve(undefined),
  ])
  let login: AdapterProbe['login'] = 'product-managed'
  let loginDetail: string | undefined
  if (status !== undefined && /logged in/i.test(status)) {
    login = 'ok'
    loginDetail = status.replace(/^✓\s*/, '')
  } else if (status !== undefined) {
    login = 'unknown'
    loginDetail = status
  }
  return {
    found: true,
    path: resolved,
    ...version !== undefined ? { version } : {},
    login,
    ...loginDetail !== undefined ? { loginDetail } : {},
  }
}

async function boundedProbeAdapter(
  id: AdapterId,
  resolveExecutable: ExecutableResolver,
  signal: AbortSignal,
  overridePath?: string,
): Promise<AdapterProbe> {
  if (signal.aborted) return { found: false }
  const controller = new AbortController()
  const abortFromCaller = (): void => { controller.abort(signal.reason) }
  signal.addEventListener('abort', abortFromCaller, { once: true })
  const timer = setTimeout(() => controller.abort(PROBE_TIMEOUT_REASON), PROBE_TIMEOUT_MS)
  const aborted = new Promise<AdapterProbe>((resolve) => {
    controller.signal.addEventListener('abort', () => resolve({ found: false }), { once: true })
  })
  try {
    return await Promise.race([
      probeAdapter(id, resolveExecutable, controller.signal, overridePath),
      aborted,
    ])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abortFromCaller)
  }
}

export async function probeAll(
  resolveExecutable: ExecutableResolver,
  signal: AbortSignal,
  paths?: Partial<Record<AdapterId, string>>,
): Promise<Partial<Record<AdapterId, AdapterProbe>>> {
  const entries = await Promise.all(IMPLEMENTED_ADAPTER_IDS.map(async (id) => {
    if (signal.aborted) return [id, { found: false }] as const
    return [id, await boundedProbeAdapter(id, resolveExecutable, signal, paths?.[id])] as const
  }))
  return Object.fromEntries(entries)
}

export async function probeModels(
  probes: Partial<Record<AdapterId, AdapterProbe>>,
  signal = new AbortController().signal,
): Promise<Partial<Record<AdapterId, AdapterProbe>>> {
  const entries = await Promise.all(IMPLEMENTED_ADAPTER_IDS.map(async (id) => {
    const current = probes[id]
    if (current?.found !== true || current.path === undefined) return [id, current] as const
    const models = await listModels(id, current.path, signal)
    return [id, { ...current, ...models !== undefined && models.length > 0 ? { models } : {} }] as const
  }))
  return Object.fromEntries(entries)
}

/** Start background probes with timer, cancellation, and work owned by one effect. */
export function startOfficialProbes(ctx: Context): void {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined) {
    ctx.logger.warn('external-agents: executable capability unavailable; load @deepseek-ai/dsh-subprocess to probe Product Workers')
    return
  }
  ctx.effect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(PROBE_TIMEOUT_REASON), PROBE_TIMEOUT_MS)
    const work = (async () => {
      const probes = await probeAll(subprocess.resolveExecutable.bind(subprocess), controller.signal)
      for (const id of IMPLEMENTED_ADAPTER_IDS) {
        const probe = probes[id]
        const name = ADAPTERS[id].displayName
        if (probe?.found === true) {
          ctx.logger.info('external-agents: found ' + name + ' at ' + String(probe.path))
        } else {
          ctx.logger.info('external-agents: ' + name + ' not found')
        }
      }
    })()
    const observed = work.catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (controller.signal.aborted) return
      ctx.logger.warn('external-agents: executable probe failed: ' + errorText(error))
    })
    return async () => {
      clearTimeout(timer)
      controller.abort(PROBE_DISPOSE_REASON)
      await observed
    }
  }, 'external-agents: executable probes')
}
