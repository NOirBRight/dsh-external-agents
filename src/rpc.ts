/** Host RPC: snapshot, probes, and Exposure persistence. */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-client-connection'
import { ADAPTERS, ADAPTER_IDS } from './catalog.ts'
import {
  EXTERNAL_AGENTS_RPC_CHANNEL,
  PICK_ENDPOINT,
  PROBE_ENDPOINT,
  SAVE_ENDPOINT,
  SNAPSHOT_ENDPOINT,
  type CatalogCard,
  type ExternalAgentsSnapshot,
} from './client-contract.ts'
import { resolveExposure, type Config } from './exposure.ts'
import { probeAll, probeModels } from './probe.ts'
import { decodeConfig, resolveConfig } from './config-codec.ts'
import { dshHome, savePersistedConfig } from './store.ts'

function catalogCards(): CatalogCard[] {
  return ADAPTER_IDS.map((id) => {
    const row = ADAPTERS[id]
    return {
      id: row.id,
      displayName: row.displayName,
      executable: row.executable,
      toolName: row.toolName,
      docsUrl: row.docsUrl,
      loginMode: row.loginMode,
      supportsUnattended: row.supportsUnattended,
      knownModels: row.knownModels.map((item) => ({ id: item.id, label: item.label })),
    }
  })
}

type RpcFailureCode = 'internal'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function fail(message: string, code: RpcFailureCode = 'internal', details: object = {}) {
  return {
    ok: false as const,
    error: { code, message, details },
  }
}

export interface ExternalAgentsRpcDeps {
  liveConfig: () => Config
  applyConfig: (config: Config) => Promise<void>
  cachedProbes: () => Partial<Record<import('./catalog.ts').AdapterId, import('./client-contract.ts').AdapterProbe>>
  setCachedProbes: (probes: Partial<Record<import('./catalog.ts').AdapterId, import('./client-contract.ts').AdapterProbe>>) => void
  resolveExecutable?: SubprocessRuntime['resolveExecutable']
}

function adapterPaths(config: Config): Partial<Record<import('./catalog.ts').AdapterId, string>> {
  const paths: Partial<Record<import('./catalog.ts').AdapterId, string>> = {}
  for (const id of ADAPTER_IDS) {
    const path = config.adapters?.[id]?.path
    if (path !== undefined && path.length > 0) paths[id] = path
  }
  return paths
}

export function createExternalAgentsRpcHandler(deps: ExternalAgentsRpcDeps): ConnectionRpcHandler {
  return async (endpoint, payload, signal) => {
    if (endpoint === SNAPSHOT_ENDPOINT) {
      const value: ExternalAgentsSnapshot = {
        config: deps.liveConfig(),
        catalog: catalogCards(),
        probes: deps.cachedProbes(),
      }
      return { ok: true as const, value }
    }
    if (endpoint === PROBE_ENDPOINT) {
      const wantModels = typeof payload === 'object' && payload !== null && (payload as { models?: boolean }).models === true
      if (wantModels) {
        const next = await probeModels(deps.cachedProbes(), signal)
        deps.setCachedProbes(next)
        return { ok: true as const, value: { probes: next } }
      }
      if (deps.resolveExecutable === undefined) {
        return fail(
          'executable probing unavailable: the @deepseek-ai/dsh-subprocess capability is not loaded',
          'internal',
          { capability: 'subprocess' },
        )
      }
      const probes = await probeAll(deps.resolveExecutable, signal, adapterPaths(deps.liveConfig()))
      deps.setCachedProbes(probes)
      return { ok: true as const, value: { probes } }
    }
    if (endpoint === PICK_ENDPOINT) {
      try {
        const { stdout } = await promisify(execFile)('zenity', [
          '--file-selection',
          '--title=Select executable',
        ], { encoding: 'utf8', timeout: 120_000 })
        const path = stdout.trim()
        return { ok: true as const, value: { path: path.length > 0 ? path : null } }
      } catch {
        return { ok: true as const, value: { path: null } }
      }
    }
    if (endpoint === SAVE_ENDPOINT) {
      const decoded = decodeConfig(payload)
      if (decoded === undefined) return fail('invalid external-agents config')
      const candidate = { ...(payload as Record<string, unknown>) }
      if (decoded.defaultAdapter !== undefined && decoded.adapters?.[decoded.defaultAdapter]?.enabled !== true) {
        delete candidate.defaultAdapter
      }
      let next: Config
      try {
        next = resolveConfig(candidate)
        resolveExposure(next)
      } catch (error: unknown) {
        return fail('invalid external-agents config: ' + errorText(error))
      }
      const previous = deps.liveConfig()
      try {
        await deps.applyConfig(next)
      } catch (error: unknown) {
        return fail('external-agents config was not applied: ' + errorText(error))
      }
      try {
        savePersistedConfig(dshHome(), next)
      } catch (error: unknown) {
        try {
          await deps.applyConfig(previous)
        } catch (rollbackError: unknown) {
          return fail(
            'external-agents config persistence failed and live rollback failed: '
              + errorText(error) + '; ' + errorText(rollbackError),
          )
        }
        return fail('external-agents config persistence failed; previous config restored: ' + errorText(error))
      }
      return { ok: true as const, value: { saved: true } }
    }
    return fail('unknown external-agents endpoint: ' + endpoint)
  }
}

/** Register the host channel and attach its async disposer to this fiber. */
export function registerExternalAgentsRpc(ctx: Context, deps: ExternalAgentsRpcDeps): void {
  ctx.effect(
    () => ctx.connection.rpc.handle(EXTERNAL_AGENTS_RPC_CHANNEL, createExternalAgentsRpcHandler(deps)),
    'external-agents: RPC channel',
  )
}
