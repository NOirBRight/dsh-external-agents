/** Shared Product Worker execution for foreground and background delegation tools. */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import { settleRun, type SubagentResult, type SubagentRun } from '@deepseek-ai/dsh-subagent'

export interface ProductWorkerRequest {
  provider: string
  label: string
  prompt: string
  parent: Agent
}

export type ForegroundWorkerResult = {
  readonly kind: 'foreground'
  readonly runId: SubagentRun['id']
  readonly output: JsonValue[]
}

export function outputValueText(values: JsonValue[]): string {
  return values
    .filter((value): value is { type: 'text', text: string } =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
      && value.type === 'text' && typeof value.text === 'string')
    .map(value => value.text)
    .join('')
}

function stopReasonError(result: SubagentResult): string | undefined {
  switch (result.stopReason) {
    case 'completed': return undefined
    case 'aborted': return '外部 Agent 运行被取消'
    case 'error': return '外部 Agent 运行失败'
    case 'max-tokens': return '外部 Agent 在完成前耗尽了上下文'
    case 'refusal': return '外部 Agent 拒绝了该任务'
    default: return '外部 Agent 异常结束（' + String(result.stopReason) + '）'
  }
}

function withPartialText(error: string, output: ContentBlock[]): string {
  const text = output
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
  return text.length === 0 ? error : error + '\n结束前的部分输出：\n' + text
}

async function settleForegroundRun(run: SubagentRun): Promise<ForegroundWorkerResult> {
  const [execution] = await Promise.allSettled([
    run.result.then((result): ForegroundWorkerResult => {
      const error = stopReasonError(result)
      if (error !== undefined) throw new Error(withPartialText(error, result.output))
      return { kind: 'foreground', runId: run.id, output: result.output as unknown as JsonValue[] }
    }),
  ])
  const [disposal] = await Promise.allSettled([Promise.resolve().then(() => run.dispose())])
  if (execution.status === 'rejected') {
    if (disposal.status === 'rejected') {
      throw new AggregateError([execution.reason, disposal.reason],
        '外部 Agent 运行失败：' + String(execution.reason) + '；dispose 失败：' + String(disposal.reason))
    }
    throw execution.reason
  }
  if (disposal.status === 'rejected') throw disposal.reason
  return execution.value
}

async function settleStart(start: Promise<SubagentRun>, signal: AbortSignal) {
  try {
    return await settleRun(await start)
  } catch (error: unknown) {
    return signal.aborted
      ? { status: 'killed' as const }
      : { status: 'failed' as const, detail: String(error) }
  }
}

function startRequest(request: ProductWorkerRequest, signal: AbortSignal) {
  return {
    label: request.label,
    prompt: [{ type: 'text' as const, text: request.prompt }],
    parent: request.parent,
    signal,
  }
}

export async function startForegroundProductWorker(
  ctx: Context,
  request: ProductWorkerRequest,
  signal: AbortSignal,
): Promise<ForegroundWorkerResult> {
  const run = await ctx.subagents.start(request.provider, startRequest(request, signal))
  return settleForegroundRun(run)
}

export function startBackgroundProductWorker(ctx: Context, request: ProductWorkerRequest): string {
  const jobs = ctx.get('jobs')
  if (jobs === undefined) throw new Error('后台 Job 不可用：需要加载 @deepseek-ai/dsh-jobs')
  return jobs.start({
    kind: 'subagent',
    label: request.label,
    owner: request.parent,
    run: () => {
      const controller = new AbortController()
      const start = ctx.subagents.start(request.provider, startRequest(request, controller.signal))
      return {
        cancel: (reason?: string) => { controller.abort(reason ?? 'background subagent task killed') },
        done: settleStart(start, controller.signal),
      }
    },
  })
}
