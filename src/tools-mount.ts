/** Mount named Delegation Tools and delegate_worker for one Exposure. */

import type { Context } from '@deepseek-ai/cordis'
import * as toolSubagent from '@deepseek-ai/dsh-tool-subagent'
import { registerDelegateWorker } from './delegate-worker.ts'
import type { Exposure } from './exposure.ts'

const NAMED_TOOL_CONFIG = {
  backgroundMode: 'one-shot' as const,
  maxDepth: 'provider-managed' as const,
}

export function mountExposureTools(ctx: Context, exposure: Exposure): void {
  for (const row of exposure.named) {
    ctx.plugin(toolSubagent, {
      provider: row.provider,
      toolName: row.toolName,
      ...NAMED_TOOL_CONFIG,
    })
  }
  if (exposure.delegateWorker) {
    registerDelegateWorker(ctx, exposure)
  }
}
