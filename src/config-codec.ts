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

/** Validate a config before it is mounted or persisted. */
export function validateConfig(value: unknown): Config {
  const record = asRecord(value)
  if (record === undefined) throw new TypeError('external-agents config must be an object')
  const adaptersRecord = record.adapters === undefined ? undefined : asRecord(record.adapters)
  if (record.adapters !== undefined && adaptersRecord === undefined) {
    throw new TypeError('external-agents config.adapters must be an object')
  }
  const adapters: NonNullable<Config['adapters']> = {}
  if (adaptersRecord !== undefined) {
    for (const [rawId, rawAdapter] of Object.entries(adaptersRecord)) {
      if (!isAdapterId(rawId)) throw new TypeError('external-agents config.adapters has unknown Adapter ' + JSON.stringify(rawId))
      if (rawAdapter === undefined) continue
      const adapter = asRecord(rawAdapter)
      if (adapter === undefined) throw new TypeError('external-agents config.adapters.' + rawId + ' must be an object')
      const enabled = adapter.enabled
      if (enabled !== undefined && typeof enabled !== 'boolean') throw new TypeError('external-agents config.adapters.' + rawId + '.enabled must be boolean')
      const path = adapter.path
      if (path !== undefined && typeof path !== 'string') throw new TypeError('external-agents config.adapters.' + rawId + '.path must be string')
      const model = adapter.model
      if (model !== undefined && typeof model !== 'string') throw new TypeError('external-agents config.adapters.' + rawId + '.model must be string')
      const normalizedModel = model === undefined ? undefined : model.trim()
      if (enabled === true && (normalizedModel === undefined || normalizedModel.length === 0)) {
        throw new TypeError('external-agents config.adapters.' + rawId + '.model must be a non-empty string when enabled')
      }
      const unattended = adapter.unattended
      if (unattended !== undefined && unattended !== 'auto' && unattended !== 'strict') {
        throw new TypeError('external-agents config.adapters.' + rawId + '.unattended must be \"auto\" or \"strict\"')
      }
      const printTimeoutMs = adapter.printTimeoutMs
      if (printTimeoutMs !== undefined && (typeof printTimeoutMs !== 'number' || !Number.isFinite(printTimeoutMs) || printTimeoutMs <= 0)) {
        throw new TypeError('external-agents config.adapters.' + rawId + '.printTimeoutMs must be a positive finite number')
      }
      const env = adapter.env
      if (env !== undefined) {
        const envRecord = asRecord(env)
        if (envRecord === undefined || Object.entries(envRecord).some(([, item]) => typeof item !== 'string')) {
          throw new TypeError('external-agents config.adapters.' + rawId + '.env must contain only string values')
        }
      }
      adapters[rawId] = {
        ...enabled === undefined ? {} : { enabled },
        ...path === undefined ? {} : { path },
        ...normalizedModel === undefined ? {} : { model: normalizedModel },
        ...unattended === undefined ? {} : { unattended },
        ...printTimeoutMs === undefined ? {} : { printTimeoutMs },
        ...env === undefined ? {} : { env: { ...(env as Record<string, string>) } },
      }
    }
  }
  const defaultAdapter = record.defaultAdapter
  if (defaultAdapter !== undefined && (typeof defaultAdapter !== 'string' || !isAdapterId(defaultAdapter))) {
    throw new TypeError('external-agents config.defaultAdapter must be a known Adapter')
  }
  if (defaultAdapter !== undefined && adapters[defaultAdapter]?.enabled !== true) {
    throw new TypeError('external-agents config.defaultAdapter must name an enabled Adapter')
  }
  return {
    ...Object.keys(adapters).length > 0 ? { adapters } : {},
    ...defaultAdapter === undefined ? {} : { defaultAdapter },
  }
}

/** Resolve and normalize a config before mounting or persisting it. */
export function resolveConfig(value: unknown): Config {
  return validateConfig(value)
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
    ...defaultAdapter !== undefined && adapters[defaultAdapter]?.enabled === true ? { defaultAdapter } : {},
  }
}
