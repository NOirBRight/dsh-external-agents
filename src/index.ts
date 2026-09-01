/**
 * Host-plane External Agents control plane.
 * Registers official Product Worker tools from this plugin's config.
 * @module dsh-external-agents
 */

import type { Context, Plugin } from '@deepseek-ai/cordis'
import { createScope, type Scope } from '@deepseek-ai/dsh-scope'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-jobs'
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import * as subagentClaudeCode from '@deepseek-ai/dsh-subagent-claude-code'
import * as subagentCodex from '@deepseek-ai/dsh-subagent-codex'
import * as toolSubagent from '@deepseek-ai/dsh-tool-subagent'
import { ADAPTER_IDS, type AdapterId } from './catalog.ts'
import { registerDelegateWorker } from './delegate-worker.ts'
import { resolveExposure, type Config as ExposureConfig } from './exposure.ts'
import { antigravityPlugin, cursorPlugin } from './print-json-provider.ts'
import { startOfficialProbes } from './probe.ts'
import { registerRoutingSkill } from './routing-skill.ts'
import { registerExternalAgentsRpc } from './rpc.ts'
import { mergeConfig, resolveConfig } from './config-codec.ts'
import { dshHome, loadPersistedConfig, loadPersistedProbes, savePersistedProbes } from './store.ts'

export { ADAPTERS, ADAPTER_IDS, GENERIC_TOOL_NAME, OFFICIAL_ADAPTER_IDS } from './catalog.ts'
export { resolveDelegationTarget, resolveExposure } from './exposure.ts'
export type { AdapterConfig, Exposure, NamedToolExposure } from './exposure.ts'
export {
  EXTERNAL_AGENTS_RPC_CHANNEL,
  PICK_ENDPOINT,
  PROBE_ENDPOINT,
  SAVE_ENDPOINT,
  SNAPSHOT_ENDPOINT,
} from './client-contract.ts'

export const name = 'external-agents'
/** Services required by every mounted feature of this control plane. */
export const inject = ['tools', 'subagents', 'jobs', 'connection', 'systemPrompt']

export type Config = ExposureConfig

export const Config: z<Config> = z.object({
  adapters: z.object({
    codex: z.object({
      enabled: z.boolean().default(false),
      env: z.dict(z.string()).default({}),
      model: z.transform(z.string().pattern(/\S/u), value => value.trim()),
      path: z.string(),
    }),
    'claude-code': z.object({
      enabled: z.boolean().default(false),
      env: z.dict(z.string()).default({}),
      model: z.transform(z.string().pattern(/\S/u), value => value.trim()),
      path: z.string(),
    }),
    cursor: z.object({
      enabled: z.boolean().default(false),
      env: z.dict(z.string()).default({}),
      unattended: z.union(['auto', 'strict'] as const).default('auto'),
      model: z.transform(z.string().pattern(/\S/u), value => value.trim()),
      path: z.string(),
    }),
    antigravity: z.object({
      enabled: z.boolean().default(false),
      env: z.dict(z.string()).default({}),
      unattended: z.union(['auto', 'strict'] as const).default('auto'),
      model: z.transform(z.string().pattern(/\S/u), value => value.trim()),
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

function providerConfig(config: Config, id: AdapterId): Record<string, unknown> {
  const adapter = config.adapters?.[id]
  const model = adapter?.model?.trim()
  if (adapter?.enabled !== true || model === undefined || model.length === 0) {
    throw new TypeError('external-agents adapter ' + id + ' requires a non-empty model when enabled')
  }
  const common = { env: adapter.env ?? {}, model }
  if (id === 'codex' || id === 'claude-code') return common
  if (id === 'cursor') {
    return {
      ...common,
      unattended: adapter.unattended ?? 'auto',
      ...adapter.path === undefined ? {} : { executable: adapter.path },
    }
  }
  return {
    ...common,
    unattended: adapter.unattended ?? 'auto',
    ...adapter.printTimeoutMs === undefined ? {} : { printTimeoutMs: adapter.printTimeoutMs },
    ...adapter.path === undefined ? {} : { executable: adapter.path },
  }
}

/** Mount one provider plugin and wait for its Cordis fiber to become active. */
async function mountPlugin(scope: Scope, plugin: Plugin, config: Record<string, unknown>): Promise<void> {
  await scope.ctx.plugin(plugin, config)
}

/**
 * Mount available official Delegation Tools and the generic delegate_worker.
 * Loading this plugin does not start any product process; without the optional
 * subprocess capability, no model-visible delegation tools are registered.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const home = dshHome()
  const initial = resolveConfig(mergeConfig(config, loadPersistedConfig(home)))
  let live = initial
  let currentScope: Scope | undefined
  let updates = Promise.resolve()
  let disposed = false

  const providerPlugins: readonly (readonly [AdapterId, Plugin])[] = [
    ['codex', subagentCodex],
    ['claude-code', subagentClaudeCode],
    ['cursor', cursorPlugin],
    ['antigravity', antigravityPlugin],
  ]

  const mountConfig = async (next: Config): Promise<Scope> => {
    const validated = resolveConfig(next)
    const exposure = resolveExposure(validated)
    const scope = createScope(ctx, {})
    try {
      const subprocess = scope.ctx.get('subprocess')
      const hasSubprocess = subprocess !== undefined
      if (!hasSubprocess) {
        ctx.logger.warn('external-agents: executable capability unavailable; load @deepseek-ai/dsh-subprocess to mount Product Worker providers')
      } else {
        for (const [id, plugin] of providerPlugins) {
          if (validated.adapters?.[id]?.enabled !== true) continue
          await mountPlugin(scope, plugin, providerConfig(validated, id))
        }
      }

      if (hasSubprocess) {
        for (const row of exposure.named) {
          await mountPlugin(scope, toolSubagent, {
            provider: row.provider,
            toolName: row.toolName,
            ...NAMED_TOOL_CONFIG,
          })
        }
        if (exposure.delegateWorker) {
          scope.ctx.effect(
            () => registerDelegateWorker(scope.ctx, exposure),
            'external-agents: delegate_worker tool',
          )
        }
      }
      return scope
    } catch (error) {
      try {
        await scope.dispose()
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'external-agents: setup failed and cleanup failed')
      }
      throw error
    }
  }

  const remountNow = async (next: Config): Promise<void> => {
    const validated = resolveConfig(next)
    const previousScope = currentScope
    let candidate: Scope | undefined
    try {
      candidate = await mountConfig(validated)
    } catch (error) {
      throw error
    }
    if (previousScope !== undefined) {
      try {
        await previousScope.dispose()
      } catch (disposeError) {
        try {
          await candidate.dispose()
        } catch (candidateError) {
          throw new AggregateError([disposeError, candidateError], 'external-agents: disposing previous scope failed and new candidate cleanup failed')
        }
        throw disposeError
      }
    }
    currentScope = candidate
    live = validated
  }

  const remount = (next: Config): Promise<void> => {
    const operation = updates.then(async () => {
      if (disposed) throw new Error('external-agents: config update arrived after disposal')
      await remountNow(resolveConfig(next))
    })
    updates = operation.then(() => undefined, () => undefined)
    return operation
  }

  const cleanup = async (): Promise<void> => {
    disposed = true
    await updates
    const scope = currentScope
    currentScope = undefined
    await scope?.dispose()
  }

  try {
    await remountNow(initial)
    registerRoutingSkill(ctx)
    startOfficialProbes(ctx)
    let probeCache = loadPersistedProbes(home)
    const subprocess = ctx.get('subprocess')
    registerExternalAgentsRpc(ctx, {
      liveConfig: () => live,
      applyConfig: remount,
      cachedProbes: () => probeCache,
      setCachedProbes: (probes) => {
        probeCache = probes
        savePersistedProbes(dshHome(), probes)
      },
      ...(subprocess === undefined ? {} : {
        resolveExecutable: subprocess.resolveExecutable.bind(subprocess),
      }),
    })
    ctx.effect(() => cleanup, 'external-agents: dynamic mount')
  } catch (error) {
    try {
      await cleanup()
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'external-agents: setup failed and cleanup failed')
    }
    throw error
  }
}
