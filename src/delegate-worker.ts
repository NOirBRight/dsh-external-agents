/** Generic Delegation Tool. Routes to the Default Adapter or an explicit one. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-jobs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ADAPTER_IDS, GENERIC_TOOL_NAME } from './catalog.ts'
import { resolveDelegationTarget, type Exposure } from './exposure.ts'
import {
  outputValueText,
  startBackgroundProductWorker,
  startForegroundProductWorker,
} from './worker-runner.ts'

/** Register the generic delegate_worker tool against the current Exposure. */
export function registerDelegateWorker(ctx: Context, exposure: Exposure): () => void {
  return ctx.tools.register(defineTool({
    name: GENERIC_TOOL_NAME,
    description:
      '把一段自包含任务交给默认外部 Agent（本机第三方编码产品）一次性执行。'
      + '父对话不会被复制过去，所以 prompt 必须写全目标、路径、验收和禁止事项。'
      + '可用 adapter 点名 Codex / Claude Code；省略则走 Default Adapter。'
      + '默认前台等待最终文本。设 run_in_background: true 则返回 job id，出现在会话头 Job Panel。',
    parameters: {
      description: { type: 'string', required: true, description: '3–5 词，进入 Job 标签。' },
      prompt: { type: 'string', required: true, description: '交给外部 Agent 的 Bounded Task。它看不到本对话，必须自包含。' },
      adapter: { type: 'string', description: '点名一个 Adapter：' + ADAPTER_IDS.join(' / ') + '。省略则用 Default Adapter。' },
      run_in_background: { type: 'boolean', description: '是否作为后台 Job 并立即返回 id。默认 false；用 job_output / job_kill 收集或取消。' },
    },
    output: {
      schema: {
        oneOf: [
          {
            type: 'object', additionalProperties: false, properties: {
              kind: { type: 'string', required: true, const: 'background' },
              jobId: { type: 'string', required: true },
            },
          },
          {
            type: 'object', additionalProperties: false, properties: {
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
          ? 'started background subagent task ' + value.jobId
          : outputValueText(value.output),
      }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parent = exec.agent
      if (!parent) throw new Error('delegate_worker 需要调用方 Agent（exec.agent 为空）')
      const target = resolveDelegationTarget(exposure, args.adapter)
      if (!target.ok) throw new Error(target.error)
      const request = { provider: target.provider, label: args.description, prompt: args.prompt, parent }
      if (args.run_in_background === true) {
        return { kind: 'background' as const, jobId: startBackgroundProductWorker(ctx, request) }
      }
      return startForegroundProductWorker(ctx, request, exec.signal)
    },
  }))
}
