/** Persist Exposure to a profile-local file. RPC writes are authoritative. */

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
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
  return process.env.VITEST !== 'true'
}

function writeJsonAtomically(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = path + '.' + String(process.pid) + '.' + String(Date.now()) + '.tmp'
  try {
    writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8')
    renameSync(temporary, path)
  } catch (cause) {
    try { unlinkSync(temporary) } catch { /* already renamed or never created */ }
    throw cause
  }
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
  writeJsonAtomically(settingsFilePath(home, profile), config)
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
  writeJsonAtomically(probesFilePath(home, profile), probes)
}
