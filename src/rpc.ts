/** Host RPC: snapshot + save Exposure. */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { ADAPTERS, ADAPTER_IDS } from './catalog.ts'
import {
  EXTERNAL_AGENTS_RPC_CHANNEL,
  EXTERNAL_PLAN_HANDOFF_UNAVAILABLE,
  PICK_ENDPOINT,
  PLAN_COMMIT_ENDPOINT,
  PLAN_PREPARE_ENDPOINT,
  PROBE_ENDPOINT,
  SAVE_ENDPOINT,
  SNAPSHOT_ENDPOINT,
  type CatalogCard,
  type ExternalAgentsSnapshot,
} from './client-contract.ts'
import { resolveExposure, type Config } from './exposure.ts'
import { probeAll, probeModels } from './probe.ts'
import { decodeConfig } from './config-codec.ts'
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

function fail(message: string) {
  return {
    ok: false as const,
    error: { code: 'internal' as const, message, details: {} },
  }
}

export interface ExternalAgentsRpcDeps {
  liveConfig: () => Config
  applyConfig: (config: Config) => void
  cachedProbes: () => Partial<Record<import('./catalog.ts').AdapterId, import('./client-contract.ts').AdapterProbe>>
  setCachedProbes: (probes: Partial<Record<import('./catalog.ts').AdapterId, import('./client-contract.ts').AdapterProbe>>) => void
  resolveExecutable?: (name: string, env: Record<string, string>, signal: AbortSignal) => Promise<string>
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
        const next = await probeModels(deps.cachedProbes())
        deps.setCachedProbes(next)
        return { ok: true as const, value: { probes: next } }
      }
      const probes = deps.resolveExecutable === undefined
        ? {}
        : await probeAll(deps.resolveExecutable, signal, adapterPaths(deps.liveConfig()))
      deps.setCachedProbes(probes)
      return { ok: true as const, value: { probes } }
    }
    if (endpoint === PLAN_PREPARE_ENDPOINT || endpoint === PLAN_COMMIT_ENDPOINT) {
      return fail(EXTERNAL_PLAN_HANDOFF_UNAVAILABLE)
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
      resolveExposure(decoded)
      savePersistedConfig(dshHome(), decoded)
      deps.applyConfig(decoded)
      return { ok: true as const, value: { saved: true } }
    }
    return fail('unknown external-agents endpoint: ' + endpoint)
  }
}

export function registerExternalAgentsRpc(ctx: Context, deps: ExternalAgentsRpcDeps): void {
  ctx.inject(['connection'], (connectionCtx) => {
    connectionCtx.connection.rpc.handle(
      EXTERNAL_AGENTS_RPC_CHANNEL,
      createExternalAgentsRpcHandler(deps),
      { authority: 'trusted-host' },
    )
  })
}
