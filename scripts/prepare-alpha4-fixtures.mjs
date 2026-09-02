#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const ALPHA4_ROOT = resolve(process.env.DSH_ALPHA4_CLEAN_CHECKOUT ?? '/home/noirbright/.local/opt/dsh-staging')
const ALPHA4_VERSION = '0.1.2-alpha.4'
const ALPHA4_TAG = 'dsh-v0.1.2-alpha.4'
const ALPHA4_COMMIT = '4e84901e6471b79ec0338099867ebb4606d12bb5'
const FIXTURE_ROOT = join(ROOT, 'fixtures')
const PACKAGE_ROOT = join(FIXTURE_ROOT, 'packages')
const PROVENANCE = join(FIXTURE_ROOT, 'provenance.json')
const OLD_FIXTURE_ROOT = resolve(process.env.DSH_OLD_FIXTURE_DIR ?? join(ROOT, '..', '.alpha4-fixture-backups', 'external-agents-alpha1-20260902T033000Z'))
const EXTRA_FIXTURE_ROOT = resolve(process.env.DSH_EXTRA_FIXTURE_DIR ?? join(ROOT, '..', '.alpha4-artifacts'))
const DEPENDENCY_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies']
let workspaceVersions = new Map()

function fail(message) {
  throw new Error('Alpha.4 fixture preparation failed: ' + message)
}

function run(command, args, cwd = ROOT) {
  try {
    return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const output = [error?.stdout, error?.stderr].filter(Boolean).map(String).join('\n')
    fail(command + ' ' + args.join(' ') + ' failed: ' + output)
  }
}

function readArchiveManifest(archive) {
  return JSON.parse(run('tar', ['-xOzf', archive, 'package/package.json']))
}

function archiveName(name, version) {
  const stem = name.startsWith('@') ? name.slice(1).replaceAll('/', '-') : name.replaceAll('/', '-')
  return stem + '-' + version + '.tgz'
}

function digest(path, algorithm, encoding) {
  return createHash(algorithm).update(readFileSync(path)).digest(encoding)
}

function normalizeDependencyValue(name, value) {
  if (typeof value !== 'string' || !value.startsWith('workspace:')) return value
  if (workspaceVersions.has(name)) return workspaceVersions.get(name)
  if (name.startsWith('@deepseek-ai/dsh-')) return ALPHA4_VERSION
  if (name === '@deepseek-ai/cordis') return '4.0.2'
  if (name === '@deepseek-ai/schemastery') return '3.18.2'
  return '*'
}

function normalizeManifest(manifest) {
  for (const field of [...DEPENDENCY_FIELDS, 'devDependencies']) {
    for (const [name, value] of Object.entries(manifest[field] ?? {})) manifest[field][name] = normalizeDependencyValue(name, value)
  }
  return manifest
}

function hasWorkspaceDependency(manifest) {
  return [...DEPENDENCY_FIELDS, 'devDependencies'].some(field => Object.values(manifest[field] ?? {}).some(value => typeof value === 'string' && value.startsWith('workspace:')))
}

function copyOrNormalize(source, destination) {
  const manifest = readArchiveManifest(source)
  if (!hasWorkspaceDependency(manifest)) {
    copyFileSync(source, destination)
    return
  }
  const temporary = mkdtempSync(join(tmpdir(), 'dsh-external-agents-alpha4-'))
  try {
    run('tar', ['-xzf', source, '-C', temporary])
    const packageJson = join(temporary, 'package', 'package.json')
    writeFileSync(packageJson, JSON.stringify(normalizeManifest(JSON.parse(readFileSync(packageJson, 'utf8'))), null, 2) + '\n')
    run('tar', ['-czf', destination, '-C', temporary, 'package'])
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

function parseVersion(version) {
  const match = String(version).trim().replace(/^v/u, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/u)
  if (match === null) return undefined
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ?? '' }
}

function compareVersion(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (a === undefined || b === undefined) return String(left).localeCompare(String(right))
  for (const field of ['major', 'minor', 'patch']) if (a[field] !== b[field]) return a[field] - b[field]
  if (a.pre === b.pre) return 0
  if (a.pre === '') return 1
  if (b.pre === '') return -1
  return a.pre.localeCompare(b.pre)
}

function satisfies(version, requested) {
  if (typeof requested !== 'string') return false
  const alias = requested.startsWith('npm:') ? requested.slice(4).slice(requested.lastIndexOf('@') + 1) : requested
  const value = alias.trim()
  if (value === '' || value === '*' || value === 'latest') return true
  const actual = parseVersion(version)
  if (actual === undefined) return value === version
  return value.split('||').some(alternative => {
    const token = alternative.trim()
    if (token === '*') return true
    const caret = token.match(/^\^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/u)
    if (caret !== null) {
      const base = { major: Number(caret[1]), minor: Number(caret[2] ?? 0), patch: Number(caret[3] ?? 0) }
      const upper = base.major > 0 ? { major: base.major + 1, minor: 0, patch: 0 } : base.minor > 0 ? { major: 0, minor: base.minor + 1, patch: 0 } : { major: 0, minor: 0, patch: base.patch + 1 }
      const lower = `${base.major}.${base.minor}.${base.patch}${caret[4] === undefined ? '' : '-' + caret[4]}`
      return compareVersion(version, lower) >= 0 && compareVersion(version, `${upper.major}.${upper.minor}.${upper.patch}`) < 0
    }
    const tilde = token.match(/^~(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/u)
    if (tilde !== null) {
      const lower = `${tilde[1]}.${tilde[2]}.${tilde[3]}${tilde[4] === undefined ? '' : '-' + tilde[4]}`
      return compareVersion(version, lower) >= 0 && actual.major === Number(tilde[1]) && actual.minor === Number(tilde[2])
    }
    const comparison = token.match(/^(>=|<=|>|<|=)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/u)
    if (comparison === null) return token === version
    const target = `${comparison[2]}.${comparison[3] ?? 0}.${comparison[4] ?? 0}${comparison[5] === undefined ? '' : '-' + comparison[5]}`
    const result = compareVersion(version, target)
    if (comparison[1] === undefined) {
      if (comparison[4] === undefined && comparison[3] === undefined) return actual.major === Number(comparison[2])
      if (comparison[4] === undefined) return actual.major === Number(comparison[2]) && actual.minor === Number(comparison[3])
      return token.includes('-') ? version === token : result === 0
    }
    return comparison[1] === '>=' ? result >= 0 : comparison[1] === '<=' ? result <= 0 : comparison[1] === '>' ? result > 0 : comparison[1] === '<' ? result < 0 : result === 0
  })
}

function choose(candidates, requested) {
  return candidates.filter(candidate => satisfies(candidate.version, requested)).sort((left, right) => compareVersion(left.version, right.version)).at(-1)
}

function selectRuntimeClosure(output) {
  const records = [...output.values()].map(path => ({ path, manifest: readArchiveManifest(path) }))
  const byName = new Map()
  for (const record of records) (byName.get(record.manifest.name) ?? (byName.set(record.manifest.name, []), byName.get(record.manifest.name))).push(record)
  const target = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const selected = new Set()
  const queue = []
  const addEdges = manifest => {
    for (const field of DEPENDENCY_FIELDS) for (const [name, requested] of Object.entries(manifest[field] ?? {})) {
      const child = choose((byName.get(name) ?? []).map(record => ({ ...record.manifest, path: record.path })), requested)
      if (child !== undefined) queue.push(child.path)
    }
  }
  addEdges(target)
  while (queue.length > 0) {
    const path = queue.shift()
    if (path === undefined || selected.has(path)) continue
    selected.add(path)
    addEdges(readArchiveManifest(path))
  }
  for (const record of records) if (!selected.has(record.path)) rmSync(record.path, { force: true })
  return new Map(records.filter(record => selected.has(record.path)).map(record => [record.manifest.name + '@' + record.manifest.version, record.path]))
}

function sourceFiles() {
  const directory = join(ALPHA4_ROOT, 'alpha4-tarballs')
  if (!existsSync(directory)) fail('Alpha.4 tarball directory is missing: ' + directory)
  return readdirSync(directory).filter(file => file.endsWith('.tgz')).sort().map(file => join(directory, file))
}

function oldThirdPartyFiles() {
  if (!existsSync(OLD_FIXTURE_ROOT)) fail('Alpha.1 fixture backup is missing: ' + OLD_FIXTURE_ROOT)
  return readdirSync(OLD_FIXTURE_ROOT).filter(file => file.endsWith('.tgz')).sort().map(file => join(OLD_FIXTURE_ROOT, file))
}

function extraFiles() {
  if (!existsSync(EXTRA_FIXTURE_ROOT)) return []
  return readdirSync(EXTRA_FIXTURE_ROOT).filter(file => file.endsWith('.tgz')).map(file => join(EXTRA_FIXTURE_ROOT, file))
}

function isOfficial(name) {
  return name.startsWith('@deepseek-ai/')
}

function main() {
  const output = new Map()
  const sources = sourceFiles()
  workspaceVersions = new Map(sources.map(source => {
    const manifest = readArchiveManifest(source)
    return [manifest.name, manifest.version]
  }))
  rmSync(PACKAGE_ROOT, { recursive: true, force: true })
  mkdirSync(PACKAGE_ROOT, { recursive: true })
  for (const source of sources) {
    // Native CLI payloads are platform-specific and can exceed 100 MiB. The
    // pack gate records their optional edges as platform gaps instead of
    // duplicating opaque binaries in the source repository.
    if (statSync(source).size > 20_000_000) continue
    const manifest = readArchiveManifest(source)
    const destination = join(PACKAGE_ROOT, archiveName(manifest.name, manifest.version))
    copyOrNormalize(source, destination)
    output.set(manifest.name + '@' + manifest.version, destination)
  }
  for (const source of oldThirdPartyFiles()) {
    if (statSync(source).size > 20_000_000) continue
    const manifest = readArchiveManifest(source)
    if (isOfficial(manifest.name) || output.has(manifest.name + '@' + manifest.version)) continue
    const destination = join(PACKAGE_ROOT, archiveName(manifest.name, manifest.version))
    copyFileSync(source, destination)
    output.set(manifest.name + '@' + manifest.version, destination)
  }
  for (const source of extraFiles()) {
    const manifest = readArchiveManifest(source)
    if (output.has(manifest.name + '@' + manifest.version)) continue
    const destination = join(PACKAGE_ROOT, archiveName(manifest.name, manifest.version))
    copyFileSync(source, destination)
    output.set(manifest.name + '@' + manifest.version, destination)
  }
  const selectedOutput = selectRuntimeClosure(output)
  const records = [...selectedOutput.values()].map(path => {
    const manifest = readArchiveManifest(path)
    return {
      path: 'fixtures/packages/' + path.slice(PACKAGE_ROOT.length + 1),
      name: manifest.name,
      version: manifest.version,
      sha256: digest(path, 'sha256', 'hex'),
      size: statSync(path).size,
      integrity: 'sha512-' + digest(path, 'sha512', 'base64'),
      source: isOfficial(manifest.name) ? 'official' : 'registry',
    }
  }).sort((left, right) => left.path.localeCompare(right.path))
  const byName = new Map()
  for (const record of records) (byName.get(record.name) ?? (byName.set(record.name, []), byName.get(record.name))).push(record)
  const gaps = []
  const parentEdges = []
  for (const parent of records) {
    const manifest = readArchiveManifest(join(ROOT, parent.path))
    for (const kind of DEPENDENCY_FIELDS) {
      for (const [dependency, requested] of Object.entries(manifest[kind] ?? {})) {
        const optional = kind === 'optionalDependencies' || kind === 'peerDependencies' && manifest.peerDependenciesMeta?.[dependency]?.optional === true
        const child = choose(byName.get(dependency) ?? [], requested)
        if (child === undefined) {
          if (optional) {
            gaps.push({ name: dependency, status: 'gap' })
            parentEdges.push({ parent: parent.name + '@' + parent.version, parentArtifact: parent.path, kind, dependency, requested, optional: true, status: 'platform-gap' })
          }
          continue
        }
        parentEdges.push({
          parent: parent.name + '@' + parent.version,
          parentArtifact: parent.path,
          kind,
          dependency,
          requested,
          optional,
          status: 'resolved',
          artifact: child.path,
          resolved: child.name + '@' + child.version,
          integrity: child.integrity,
          sha256: child.sha256,
        })
      }
    }
  }
  const provenance = {
    schemaVersion: 3,
    scope: {
      name: 'dsh-external-agents-plugin-closure',
      description: 'Repository-owned archives for the External Agents one-shot Process Worker adapters and their Alpha.4 runtime context.',
      roots: ['dsh-external-agents@0.2.2'],
      hostPlatform: 'linux/x64/glibc',
      nonCurrentPlatformsAreOptionalGaps: true,
    },
    official: {
      repository: 'https://github.com/deepseek-ai/deepseek-harness',
      tag: ALPHA4_TAG,
      commit: ALPHA4_COMMIT,
      checkout: 'dsh-v0.1.2-alpha.4 clean staging',
    },
    hostPlatform: { os: 'linux', cpu: 'x64', libc: 'glibc' },
    requiredImports: records.map(record => ({ name: record.name, version: record.version, artifact: record.path })),
    artifacts: records,
    platformAliases: {
      nonCurrentPlatformGaps: [...new Map(gaps.map(gap => [gap.name, gap])).values()],
    },
    parentEdges,
  }
  writeFileSync(PROVENANCE, JSON.stringify(provenance, null, 2) + '\n')
  console.log('prepared ' + records.length + ' Alpha.4/registry fixture archives and ' + parentEdges.length + ' parent edges')
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
