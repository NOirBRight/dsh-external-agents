/**
 * Host-plane External Agents control plane.
 * Registers official Product Worker tools from this plugin's config.
 * @module dsh-external-agents
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import * as subagentClaudeCode from '@deepseek-ai/dsh-subagent-claude-code'
import * as subagentCodex from '@deepseek-ai/dsh-subagent-codex'
import * as toolSubagent from '@deepseek-ai/dsh-tool-subagent'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-subprocess'
import { ADAPTER_IDS } from './catalog.ts'
import { registerDelegateWorker } from './delegate-worker.ts'
import { resolveExposure, type Config as ExposureConfig } from './exposure.ts'
import { antigravityPlugin, cursorPlugin } from './print-json-provider.ts'
import { startOfficialProbes } from './probe.ts'
import { registerRoutingSkill } from './routing-skill.ts'
import { registerExternalAgentsRpc } from './rpc.ts'
import { mergeConfig } from './config-codec.ts'
import { dshHome, loadPersistedConfig, loadPersistedProbes, savePersistedProbes } from './store.ts'

export { ADAPTERS, ADAPTER_IDS, GENERIC_TOOL_NAME, OFFICIAL_ADAPTER_IDS } from './catalog.ts'
export { resolveDelegationTarget, resolveExposure } from './exposure.ts'
export type { AdapterConfig, Exposure, NamedToolExposure } from './exposure.ts'
export {
  EXTERNAL_AGENTS_RPC_CHANNEL,
  PICK_ENDPOINT,
  PLAN_COMMIT_ENDPOINT,
  PLAN_PREPARE_ENDPOINT,
  PROBE_ENDPOINT,
  SAVE_ENDPOINT,
  SNAPSHOT_ENDPOINT,
} from './client-contract.ts'

export const name = 'external-agents'
export const inject = ['tools', 'subagents']

export type Config = ExposureConfig

export const Config: z<Config> = z.object({
  adapters: z.object({
    codex: z.object({
      enabled: z.boolean().default(false),
      env: z.dict(z.string()).default({}),
      path: z.string(),
    }),
    'claude-code': z.object({
      enabled: z.boolean().default(false),
      env: z.dict(z.string()).default({}),
      path: z.string(),
    }),
    cursor: z.object({
      enabled: z.boolean().default(false),
      env: z.dict(z.string()).default({}),
      unattended: z.union(['auto', 'strict'] as const).default('auto'),
      model: z.string(),
      path: z.string(),
    }),
    antigravity: z.object({
      enabled: z.boolean().default(false),
      env: z.dict(z.string()).default({}),
      unattended: z.union(['auto', 'strict'] as const).default('auto'),
      model: z.string(),
      path: z.string(),
      printTimeoutMs: z.number(),
    }),
  }),
  defaultAdapter: z.union(ADAPTER_IDS.map(id => z.const(id))),
})

const NAMED_TOOL_CONFIG = {
  backgroundMode: 'one-shot' as const,
  maxDepth: 'provider-managed' as const,
}

function rememberDisposer(bucket: Array<() => void>, value: unknown): void {
  if (typeof value === 'function') {
    bucket.push(value as () => void)
    return
  }
  if (value !== null && typeof value === 'object' && 'dispose' in value) {
    const dispose = (value as { dispose?: unknown }).dispose
    if (typeof dispose === 'function') bucket.push(() => { (dispose as () => void)() })
  }
}

/**
 * Mount enabled official Delegation Tools and the generic delegate_worker.
 * Loading this plugin does not start any product process.
 */
export function apply(ctx: Context, config: Config): void {
  let live = mergeConfig(config, loadPersistedConfig(dshHome()))
  const disposers: Array<() => void> = []

  const remount = (next: Config): void => {
    live = next
    while (disposers.length > 0) disposers.pop()?.()
    rememberDisposer(disposers, ctx.plugin(subagentCodex, { env: live.adapters?.codex?.env ?? {} }))
    rememberDisposer(disposers, ctx.plugin(subagentClaudeCode, { env: live.adapters?.['claude-code']?.env ?? {} }))
    rememberDisposer(disposers, ctx.plugin(cursorPlugin, {
      env: live.adapters?.cursor?.env ?? {},
      unattended: live.adapters?.cursor?.unattended ?? 'auto',
      ...live.adapters?.cursor?.model !== undefined ? { model: live.adapters.cursor.model } : {},
      ...live.adapters?.cursor?.path !== undefined ? { executable: live.adapters.cursor.path } : {},
    }))
    rememberDisposer(disposers, ctx.plugin(antigravityPlugin, {
      env: live.adapters?.antigravity?.env ?? {},
      unattended: live.adapters?.antigravity?.unattended ?? 'auto',
      ...live.adapters?.antigravity?.model !== undefined ? { model: live.adapters.antigravity.model } : {},
      ...live.adapters?.antigravity?.printTimeoutMs !== undefined
        ? { printTimeoutMs: live.adapters.antigravity.printTimeoutMs }
        : {},
      ...live.adapters?.antigravity?.path !== undefined ? { executable: live.adapters.antigravity.path } : {},
    }))
    const exposure = resolveExposure(live)
    for (const row of exposure.named) {
      rememberDisposer(disposers, ctx.plugin(toolSubagent, {
        provider: row.provider,
        toolName: row.toolName,
        ...NAMED_TOOL_CONFIG,
      }))
    }
    if (exposure.delegateWorker) {
      rememberDisposer(disposers, registerDelegateWorker(ctx, exposure))
    }
  }

  remount(live)
  registerRoutingSkill(ctx)
  startOfficialProbes(ctx)
  const home = dshHome()
  const subprocess = ctx.get('subprocess')
  let probeCache = loadPersistedProbes(home)
  registerExternalAgentsRpc(ctx, {
    liveConfig: () => live,
    applyConfig: remount,
    cachedProbes: () => probeCache,
    setCachedProbes: (probes) => {
      probeCache = probes
      savePersistedProbes(dshHome(), probes)
    },
    ...subprocess === undefined ? {} : { resolveExecutable: subprocess.resolveExecutable.bind(subprocess) },
  })
  ctx.effect(() => () => {
    while (disposers.length > 0) disposers.pop()?.()
  })
}
