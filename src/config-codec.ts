/** Browser-safe config decode/merge. */

import { ADAPTER_IDS, isAdapterId } from './catalog.ts'
import type { AdapterConfig, Config } from './exposure.ts'
import type { UnattendedPolicy } from './print-json-argv.ts'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asEnv(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value)
  if (record === undefined) return undefined
  const env: Record<string, string> = {}
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === 'string') env[key] = item
  }
  return env
}

function asUnattended(value: unknown): UnattendedPolicy | undefined {
  return value === 'auto' || value === 'strict' ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function decodeAdapter(value: unknown): AdapterConfig | undefined {
  const record = asRecord(value)
  if (record === undefined) return undefined
  const enabled = asBoolean(record.enabled)
  const env = asEnv(record.env)
  const unattended = asUnattended(record.unattended)
  const model = asString(record.model)
  const path = asString(record.path)
  const printTimeoutMs = asNumber(record.printTimeoutMs)
  return {
    ...enabled !== undefined ? { enabled } : {},
    ...env !== undefined ? { env } : {},
    ...unattended !== undefined ? { unattended } : {},
    ...model !== undefined ? { model } : {},
    ...path !== undefined ? { path } : {},
    ...printTimeoutMs !== undefined ? { printTimeoutMs } : {},
  }
}

export function decodeConfig(value: unknown): Config | undefined {
  const record = asRecord(value)
  if (record === undefined) return undefined
  const adaptersRecord = asRecord(record.adapters)
  const adapters: NonNullable<Config['adapters']> = {}
  if (adaptersRecord !== undefined) {
    for (const id of ADAPTER_IDS) {
      const row = decodeAdapter(adaptersRecord[id])
      if (row !== undefined) adapters[id] = row
    }
  }
  const pinned = asString(record.defaultAdapter)
  return {
    ...Object.keys(adapters).length > 0 ? { adapters } : {},
    ...pinned !== undefined && isAdapterId(pinned) ? { defaultAdapter: pinned } : {},
  }
}

export function mergeConfig(base: Config, overlay: Config | undefined): Config {
  if (overlay === undefined) return base
  const adapters: NonNullable<Config['adapters']> = { ...base.adapters }
  for (const id of ADAPTER_IDS) {
    const left = base.adapters?.[id]
    const right = overlay.adapters?.[id]
    if (left === undefined && right === undefined) continue
    adapters[id] = { ...left, ...right, env: { ...left?.env, ...right?.env } }
  }
  const defaultAdapter = overlay.defaultAdapter ?? base.defaultAdapter
  return {
    adapters,
    ...defaultAdapter !== undefined ? { defaultAdapter } : {},
  }
}
