/** Browser-safe RPC contract for the External Agents settings page. */

import { ADAPTER_IDS, type AdapterId } from './catalog.ts'
import type { Config } from './exposure.ts'

export const EXTERNAL_AGENTS_RPC_CHANNEL = '/external-agents'
export const SNAPSHOT_ENDPOINT = 'snapshot'
export const SAVE_ENDPOINT = 'save'
export const PROBE_ENDPOINT = 'probe'
export const PICK_ENDPOINT = 'pick'

export interface AdapterProbe {
  found: boolean
  path?: string
  version?: string
  login?: 'product-managed' | 'ok' | 'unknown'
  loginDetail?: string
  /** Product model ids the settings dropdown can offer. */
  models?: string[]
}

export interface CatalogCard {
  id: AdapterId
  displayName: string
  executable: string
  toolName: string
  docsUrl: string
  loginMode: 'cursor-status' | 'product-managed'
  supportsUnattended: boolean
  knownModels: { id: string, label: string }[]
}

export interface ExternalAgentsSnapshot {
  config: Config
  catalog: CatalogCard[]
  probes: Partial<Record<AdapterId, AdapterProbe>>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function decodeSnapshot(value: unknown): ExternalAgentsSnapshot | undefined {
  if (!isRecord(value) || !isRecord(value.config) || !Array.isArray(value.catalog) || !isRecord(value.probes)) {
    return undefined
  }
  const catalog: CatalogCard[] = []
  for (const row of value.catalog) {
    if (!isRecord(row)) return undefined
    if (!(ADAPTER_IDS as readonly string[]).includes(String(row.id))) return undefined
    if (typeof row.displayName !== 'string' || typeof row.executable !== 'string') return undefined
    if (typeof row.toolName !== 'string' || typeof row.docsUrl !== 'string') return undefined
    if (row.loginMode !== 'cursor-status' && row.loginMode !== 'product-managed') return undefined
    if (typeof row.supportsUnattended !== 'boolean') return undefined
    const knownModels = Array.isArray(row.knownModels)
      ? row.knownModels.filter((item): item is { id: string, label: string } => {
        return typeof item === 'object' && item !== null
          && typeof (item as { id?: unknown }).id === 'string'
          && typeof (item as { label?: unknown }).label === 'string'
      })
      : []
    catalog.push({
      id: row.id as AdapterId,
      displayName: row.displayName,
      executable: row.executable,
      toolName: row.toolName,
      docsUrl: row.docsUrl,
      loginMode: row.loginMode,
      supportsUnattended: row.supportsUnattended,
      knownModels,
    })
  }
  return {
    config: value.config as Config,
    catalog,
    probes: value.probes as Partial<Record<AdapterId, AdapterProbe>>,
  }
}
