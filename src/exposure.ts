/**
 * Exposure: which Delegation Tools the model may see.
 * Settings (P0: this plugin's config) own this; Agent Preset rows stay disabled.
 * @module dsh-external-agents/exposure
 */

import {
  ADAPTERS,
  ADAPTER_IDS,
  ENABLE_HINT,
  GENERIC_TOOL_NAME,
  IMPLEMENTED_ADAPTER_IDS,
  isAdapterId,
  isImplementedAdapterId,
  type AdapterId,
  type ImplementedAdapterId,
} from './catalog.ts'
import type { UnattendedPolicy } from './print-json-argv.ts'

export interface AdapterConfig {
  /** When false, the named tool is unregistered. Omitted means on. */
  enabled?: boolean
  /** Optional absolute path to the product executable. */
  path?: string
  /**
   * Extra env for this Adapter's worker only, merged after the credential
   * scrub. User-owned (HTTPS_PROXY, product keys, …). No built-in endpoints.
   */
  env?: Record<string, string>
  /** P1 print-json workers: auto-approve (default) or fail closed. */
  unattended?: UnattendedPolicy
  /** Optional product --model override. Empty means native default. */
  model?: string
  /** Agy --print-timeout in milliseconds. */
  printTimeoutMs?: number
}

export interface Config {
  adapters?: {
    codex?: AdapterConfig
    'claude-code'?: AdapterConfig
    cursor?: AdapterConfig
    antigravity?: AdapterConfig
  }
  /** Used when delegate_worker omits adapter. Must be enabled and implemented. */
  defaultAdapter?: AdapterId
}

export interface NamedToolExposure {
  readonly adapter: ImplementedAdapterId
  readonly provider: string
  readonly toolName: string
}

export interface Exposure {
  readonly named: readonly NamedToolExposure[]
  readonly defaultAdapter: ImplementedAdapterId | undefined
  readonly delegateWorker: boolean
}

function isEnabled(config: Config, id: AdapterId): boolean {
  return config.adapters?.[id]?.enabled !== false
}

/** Resolve live named tools and the Default Adapter from plugin config. */
export function resolveExposure(config: Config): Exposure {
  const named: NamedToolExposure[] = []
  for (const id of IMPLEMENTED_ADAPTER_IDS) {
    const descriptor = ADAPTERS[id]
    if (!isEnabled(config, id)) continue
    named.push({
      adapter: id,
      provider: descriptor.provider,
      toolName: descriptor.toolName,
    })
  }
  const enabledIds = named.map(row => row.adapter)
  const pinned = config.defaultAdapter
  const defaultAdapter = pinned !== undefined && isImplementedAdapterId(pinned) && enabledIds.includes(pinned)
    ? pinned
    : enabledIds[0]
  return {
    named,
    defaultAdapter,
    delegateWorker: defaultAdapter !== undefined,
  }
}

export type DelegationTarget =
  | { readonly ok: true; readonly adapter: ImplementedAdapterId; readonly provider: string }
  | { readonly ok: false; readonly error: string }

/** Pick the provider for one delegate_worker call. */
export function resolveDelegationTarget(
  exposure: Exposure,
  requested: string | undefined,
): DelegationTarget {
  if (requested !== undefined && requested !== '') {
    if (!isAdapterId(requested)) {
      return {
        ok: false,
        error: `未知的 Adapter「${requested}」。可用：${ADAPTER_IDS.join('、')}。`,
      }
    }
    const descriptor = ADAPTERS[requested]
    if (!descriptor.implemented || !isImplementedAdapterId(requested)) {
      return {
        ok: false,
        error: `Adapter「${descriptor.displayName}」尚未实现。${ENABLE_HINT}`,
      }
    }
    if (!exposure.named.some(row => row.adapter === requested)) {
      return {
        ok: false,
        error: `外部 Agent「${descriptor.displayName}」未启用。${ENABLE_HINT}`,
      }
    }
    return { ok: true, adapter: requested, provider: descriptor.provider }
  }
  if (exposure.defaultAdapter === undefined) {
    return {
      ok: false,
      error: `没有已启用的外部 Agent，无法调用 ${GENERIC_TOOL_NAME}。${ENABLE_HINT}`,
    }
  }
  return {
    ok: true,
    adapter: exposure.defaultAdapter,
    provider: ADAPTERS[exposure.defaultAdapter].provider,
  }
}
