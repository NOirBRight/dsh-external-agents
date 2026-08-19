/** Persist Exposure to a profile-local file. RPC writes are authoritative. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AdapterId } from './catalog.ts'
import type { AdapterProbe } from './client-contract.ts'
import type { Config } from './exposure.ts'
import { decodeConfig } from './config-codec.ts'

export { decodeConfig, mergeConfig } from './config-codec.ts'

export const SETTINGS_FILE_NAME = 'external-agents.settings.json'

export function settingsFilePath(home: string, profile = 'web'): string {
  return join(home, 'profiles', profile, SETTINGS_FILE_NAME)
}

export function persistEnabled(): boolean {
  return process.env.VITEST !== 'true' && typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.length > 0
}

export function loadPersistedConfig(home: string, profile = 'web'): Config | undefined {
  if (!persistEnabled()) return undefined
  try {
    const raw = readFileSync(settingsFilePath(home, profile), 'utf8')
    return decodeConfig(JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

export function savePersistedConfig(home: string, config: Config, profile = 'web'): void {
  if (!persistEnabled()) return
  const path = settingsFilePath(home, profile)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

export function dshHome(): string {
  return process.env.DSH_HOME ?? join(process.env.HOME ?? '/tmp', '.dsh')
}

export const PROBES_FILE_NAME = 'external-agents.probes.json'

export function probesFilePath(home: string, profile = 'web'): string {
  return join(home, 'profiles', profile, PROBES_FILE_NAME)
}

export function loadPersistedProbes(home: string, profile = 'web'): Partial<Record<AdapterId, AdapterProbe>> {
  if (!persistEnabled()) return {}
  try {
    const raw = JSON.parse(readFileSync(probesFilePath(home, profile), 'utf8')) as unknown
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return raw as Partial<Record<AdapterId, AdapterProbe>>
  } catch {
    return {}
  }
}

export function savePersistedProbes(
  home: string,
  probes: Partial<Record<AdapterId, AdapterProbe>>,
  profile = 'web',
): void {
  if (!persistEnabled()) return
  const path = probesFilePath(home, profile)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(probes, null, 2) + '\n', 'utf8')
}
