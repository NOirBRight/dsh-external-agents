/**
 * Generic Delegation Tool. Routes to the Default Adapter or an explicit one.
 * @module dsh-external-agents/delegate-worker
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import { settleRun, type SubagentResult, type SubagentRun } from '@deepseek-ai/dsh-subagent'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ADAPTER_IDS, GENERIC_TOOL_NAME } from './catalog.ts'
import { resolveDelegationTarget, type Exposure } from './exposure.ts'

function outputValueText(values: JsonValue[]): string {
  return values
    .filter((value): value is { type: 'text'; text: string } =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
      && value.type === 'text' && typeof value.text === 'string')
    .map(value => value.text)
    .join('')
}

function stopReasonError(result: SubagentResult): string | undefined {
  switch (result.stopReason) {
    case 'completed':
      return undefined
    case 'aborted':
      return '外部 Agent 运行被取消'
    case 'error':
      return '外部 Agent 运行失败'
    case 'max-tokens':
      return '外部 Agent 在完成前耗尽了上下文'
    case 'refusal':
      return '外部 Agent 拒绝了该任务'
    default:
      return `外部 Agent 异常结束（${String(result.stopReason)}）`
  }
}

function withPartialText(error: string, output: ContentBlock[]): string {
  const text = output
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
  return text.length === 0 ? error : `${error}\n结束前的部分输出：\n${text}`
}

type ForegroundToolResult = {
  readonly kind: 'foreground'
  readonly runId: SubagentRun['id']
  readonly output: JsonValue[]
}

async function settleForegroundRun(run: SubagentRun): Promise<ForegroundToolResult> {
  const [execution] = await Promise.allSettled([
    run.result.then((result): ForegroundToolResult => {
      const error = stopReasonError(result)
      if (error !== undefined) {
        throw new Error(withPartialText(error, result.output))
      }
      return {
        kind: 'foreground',
        runId: run.id,
        output: result.output as unknown as JsonValue[],
      }
    }),
  ])
  const [disposal] = await Promise.allSettled([Promise.resolve().then(() => run.dispose())])
  if (execution.status === 'rejected') {
    if (disposal.status === 'rejected') {
      throw new AggregateError(
        [execution.reason, disposal.reason],
        `外部 Agent 运行失败：${String(execution.reason)}；dispose 失败：${String(disposal.reason)}`,
      )
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

/** Register the generic delegate_worker tool against the current Exposure. */
export function registerDelegateWorker(ctx: Context, exposure: Exposure): (() => void) | void {
  return ctx.tools.register(defineTool({
    name: GENERIC_TOOL_NAME,
    description:
      '把一段自包含任务交给默认外部 Agent（本机第三方编码产品）一次性执行。'
      + '父对话不会被复制过去，所以 prompt 必须写全目标、路径、验收和禁止事项。'
      + '可用 adapter 点名 Codex / Claude Code；省略则走 Default Adapter。'
      + '默认前台等待最终文本。设 run_in_background: true 则返回 job id，出现在会话头 Job Panel。',
    parameters: {
      description: {
        type: 'string',
        required: true,
        description: '3–5 词，进入 Job 标签。',
      },
      prompt: {
        type: 'string',
        required: true,
        description: '交给外部 Agent 的 Bounded Task。它看不到本对话，必须自包含。',
      },
      adapter: {
        type: 'string',
        description: `点名一个 Adapter：${ADAPTER_IDS.join(' / ')}。省略则用 Default Adapter。`,
      },
      run_in_background: {
        type: 'boolean',
        description: '是否作为后台 Job 并立即返回 id。默认 false；用 job_output / job_kill 收集或取消。',
      },
    },
    output: {
      schema: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', required: true, const: 'background' },
              jobId: { type: 'string', required: true },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', required: true, const: 'foreground' },
              runId: { type: 'string', required: true },
              output: { type: 'array', required: true, items: { type: 'json' } },
            },
          },
        ],
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.kind === 'background'
          ? `started background subagent task ${value.jobId}`
          : outputValueText(value.output),
      }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parent = exec.agent
      if (!parent) {
        throw new Error('delegate_worker 需要调用方 Agent（exec.agent 为空）')
      }
      const target = resolveDelegationTarget(exposure, args.adapter)
      if (!target.ok) throw new Error(target.error)

      const request = {
        label: args.description,
        prompt: [{ type: 'text', text: args.prompt }] as ContentBlock[],
        parent,
      }

      if (args.run_in_background === true) {
        const jobs = ctx.get('jobs')
        if (jobs === undefined) {
          throw new Error('后台 Job 不可用：需要加载 @deepseek-ai/dsh-jobs')
        }
        const id = jobs.start({
          kind: 'subagent',
          label: args.description,
          owner: parent as Agent,
          run: () => {
            const controller = new AbortController()
            const start = ctx.subagents.start(target.provider, { ...request, signal: controller.signal })
            return {
              cancel: (reason?: string) => {
                controller.abort(reason ?? 'background subagent task killed')
              },
              done: settleStart(start, controller.signal),
            }
          },
        })
        return { kind: 'background' as const, jobId: id }
      }

      const run = await ctx.subagents.start(target.provider, {
        ...request,
        signal: exec.signal,
      })
      return settleForegroundRun(run)
    },
  }))
}
