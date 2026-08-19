/**
 * One-shot print-json Product Worker provider over ctx.subprocess.
 * @module dsh-external-agents/print-json-provider
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  NO_START_CAPABILITIES,
  assertPositiveFinite,
  resolveChildCwd,
  settleRunResult,
  subprocessRunHandle,
  type ResolvedSubagentStartRequest,
  type SubagentCapabilities,
  type SubagentProvider,
  type SubagentResult,
} from '@deepseek-ai/dsh-subagent'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import type {} from '@deepseek-ai/dsh-subprocess'
import { agyArgv, cursorArgv, type UnattendedPolicy } from './print-json-argv.ts'
import { interpretPrintJson } from './print-json-result.ts'

export const DEFAULT_DISPOSE_GRACE_MS = 3_000
export const DEFAULT_PRINT_TIMEOUT_MS = 5 * 60 * 1000
const STDOUT_MAX_BYTES = 2_000_000
const STDERR_MAX_BYTES = 256_000

export interface PrintJsonProviderConfig {
  env?: Record<string, string>
  disposeGraceMs?: number
  unattended?: UnattendedPolicy
  printTimeoutMs?: number
  model?: string
  executable?: string
}

type ResolvedPrintJsonConfig = {
  env: Record<string, string>
  disposeGraceMs: number
  unattended: UnattendedPolicy
  printTimeoutMs: number
  model?: string
  executable?: string
}

type Product = 'cursor' | 'agy'

function textTask(prefix: string, prompt: readonly ContentBlock[]): string {
  if (prompt.length === 0) throw new Error(prefix + ': the one-shot task must contain only text blocks')
  const texts: string[] = []
  for (const block of prompt) {
    if (block.type !== 'text') throw new Error(prefix + ': the one-shot task must contain only text blocks')
    texts.push(block.text)
  }
  if (texts.every(text => text.trim().length === 0)) {
    throw new Error(prefix + ': the one-shot task must not be empty')
  }
  return texts.join('')
}

function collectedText(reader: { readFrom(fromByte: number): { text: string } } | undefined): string {
  return reader?.readFrom(0).text ?? ''
}

class PrintJsonProvider implements SubagentProvider {
  readonly capabilities: SubagentCapabilities = NO_START_CAPABILITIES
  readonly inheritsParentContext = false

  constructor(
    readonly name: string,
    private readonly product: Product,
    private readonly displayName: string,
    private readonly binary: string,
    private readonly ctx: Context,
    private readonly config: ResolvedPrintJsonConfig,
  ) {}

  async start(request: ResolvedSubagentStartRequest) {
    const prefix = 'subagent-' + this.name
    const parentCwd = request.parent.session.header.cwd
    if (parentCwd === undefined) {
      throw new Error(prefix + ': no working directory for the child — delegate from a parent session that has one')
    }
    const cwd = resolveChildCwd(prefix, undefined, parentCwd)
    const task = textTask(prefix, request.prompt)
    const executable = this.config.executable !== undefined && this.config.executable.length > 0
      ? this.config.executable
      : await this.ctx.subprocess.resolveExecutable(this.binary, this.config.env, request.signal)
    const argv = this.product === 'cursor'
      ? cursorArgv({
        executable,
        cwd,
        task,
        unattended: this.config.unattended,
        ...this.config.model !== undefined ? { model: this.config.model } : {},
      })
      : agyArgv({
        executable,
        task,
        unattended: this.config.unattended,
        printTimeoutMs: this.config.printTimeoutMs,
        ...this.config.model !== undefined ? { model: this.config.model } : {},
      })

    const controller = new AbortController()
    const requestCancel = (): void => {
      if (!controller.signal.aborted) controller.abort(new Error(prefix + ': run cancelled locally'))
    }
    const onAbort = (): void => { requestCancel() }
    request.signal.addEventListener('abort', onAbort, { once: true })
    if (request.signal.aborted) {
      request.signal.removeEventListener('abort', onAbort)
      throw new Error(prefix + ': request was aborted before spawn')
    }

    const child = this.ctx.subprocess.spawn({
      argv,
      cwd,
      env: this.config.env,
      graceMs: this.config.disposeGraceMs,
      signal: controller.signal,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: STDOUT_MAX_BYTES },
        stderr: { maxBytes: STDERR_MAX_BYTES },
      },
    })

    let lastFailure: string | undefined
    const result = settleRunResult({
      attempt: async (): Promise<SubagentResult> => {
        const outcome = await child.done
        const mapped = interpretPrintJson({
          product: this.product,
          displayName: this.displayName,
          exitCode: outcome.exitCode,
          stdout: collectedText(child.collected.stdout),
          stderr: collectedText(child.collected.stderr),
        })
        if (!mapped.ok) {
          lastFailure = mapped.error
          throw new Error(mapped.error)
        }
        return { output: [{ type: 'text', text: mapped.text }], stopReason: 'completed' }
      },
      collectOutput: () => {
        if (lastFailure !== undefined) return [{ type: 'text' as const, text: lastFailure }]
        const stdout = collectedText(child.collected.stdout).trim()
        return stdout.length === 0 ? [] : [{ type: 'text' as const, text: stdout.slice(0, 4000) }]
      },
      cancelled: () => controller.signal.aborted,
      onError: (error, stopReason) => {
        this.ctx.logger.warn(prefix + ': child run failed (' + stopReason + '): ' + error.message)
      },
      signal: request.signal,
      onAbort,
    })

    return subprocessRunHandle({
      id: SessionId(randomUUID()),
      result,
      signal: request.signal,
      onAbort,
      requestCancel,
      teardown: async () => {
        child.terminate()
        await child.waitForExit()
      },
    })
  }
}

function resolveProviderConfig(config: PrintJsonProviderConfig): ResolvedPrintJsonConfig {
  return {
    env: config.env ?? {},
    disposeGraceMs: config.disposeGraceMs ?? DEFAULT_DISPOSE_GRACE_MS,
    unattended: config.unattended ?? 'auto',
    printTimeoutMs: config.printTimeoutMs ?? DEFAULT_PRINT_TIMEOUT_MS,
    ...config.model !== undefined ? { model: config.model } : {},
    ...config.executable !== undefined ? { executable: config.executable } : {},
  }
}

function assertTiming(prefix: string, config: ReturnType<typeof resolveProviderConfig>): void {
  assertPositiveFinite(prefix, 'disposeGraceMs', config.disposeGraceMs)
  assertPositiveFinite(prefix, 'printTimeoutMs', config.printTimeoutMs)
  if (config.disposeGraceMs > MAX_TIMER_DELAY_MS) {
    throw new Error(prefix + ': disposeGraceMs must be no greater than ' + String(MAX_TIMER_DELAY_MS))
  }
  if (config.printTimeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error(prefix + ': printTimeoutMs must be no greater than ' + String(MAX_TIMER_DELAY_MS))
  }
}

export function applyCursorProvider(ctx: Context, config: PrintJsonProviderConfig = {}): void {
  const resolved = resolveProviderConfig(config)
  assertTiming('subagent-cursor', resolved)
  ctx.subagents.registerProvider(new PrintJsonProvider('cursor', 'cursor', 'Cursor Agent', 'cursor-agent', ctx, resolved))
}

export function applyAntigravityProvider(ctx: Context, config: PrintJsonProviderConfig = {}): void {
  const resolved = resolveProviderConfig(config)
  assertTiming('subagent-antigravity', resolved)
  ctx.subagents.registerProvider(new PrintJsonProvider('antigravity', 'agy', 'Antigravity', 'agy', ctx, resolved))
}

export const cursorPlugin = {
  name: 'subagent-cursor',
  inject: ['subagents', 'subprocess'],
  apply: applyCursorProvider,
}

export const antigravityPlugin = {
  name: 'subagent-antigravity',
  inject: ['subagents', 'subprocess'],
  apply: applyAntigravityProvider,
}
