import { builtinModules, createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inspectFixtureTarball, listFixtureTarballs, readFixturePackageManifest, readFixtureProvenance, satisfiesFixtureRange, validateFixtureClosure } from './fixture-helpers.mjs'

const rootPath = fileURLToPath(new URL('..', import.meta.url))
const provenance = readFixtureProvenance()
validateFixtureClosure(provenance, listFixtureTarballs())
const temp = mkdtempSync(join(tmpdir(), 'dsh-external-agents-pack-'))
const store = join(temp, 'store')
const invalidRegistry = 'https://invalid.dsh.example.invalid/'
const builtin = new Set(builtinModules)
const rootManifestPath = join(rootPath, 'package.json')
const rootManifest = JSON.parse(readFileSync(rootManifestPath, 'utf8'))

function fail(message) {
  throw new Error(message)
}

const SAFE_ENVIRONMENT_KEYS = new Set([
  'PATH',
  'HOME',
  'USER',
  'LANG',
  'TMPDIR',
  'TMP',
  'TEMP',
  'CI',
  'SystemRoot',
  'WINDIR',
  'ProgramData',
  'ProgramFiles',
  'ProgramFiles(x86)',
  'ProgramW6432',
  'CommonProgramFiles',
  'CommonProgramFiles(x86)',
  'CommonProgramW6432',
  'LOCALAPPDATA',
  'APPDATA',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'COMSPEC',
  'PATHEXT',
])
const FORBIDDEN_ENVIRONMENT_KEYS = /(?:^|_)(?:AUTH|TOKEN|SECRET|PASSWORD|API[_-]?KEY|CREDENTIAL|CLOUD)(?:$|_)/iu

function scrubEnvironment(env) {
  const sanitized = {}
  for (const [name, value] of Object.entries(env)) {
    if (!SAFE_ENVIRONMENT_KEYS.has(name) || FORBIDDEN_ENVIRONMENT_KEYS.test(name)) continue
    sanitized[name] = value
  }
  sanitized.NODE_PATH = ''
  sanitized.NODE_OPTIONS = ''
  return sanitized
}

const CHILD_ENVIRONMENT = scrubEnvironment(process.env)

function run(command, args, cwd, env = CHILD_ENVIRONMENT) {
  try {
    return execFileSync(command, args, { cwd, env: scrubEnvironment(env), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const detail = error?.stderr?.toString?.() || error?.stdout?.toString?.() || String(error)
    fail(command + ' failed: ' + detail.trim())
  }
}

function packageName(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/')
  return specifier.split('/')[0]
}

function exportTargets(value, trail = 'exports') {
  if (typeof value === 'string') return [{ target: value, trail }]
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value.flatMap((entry, index) => exportTargets(entry, trail + '[' + index + ']'))
  if (typeof value === 'object') return Object.entries(value).flatMap(([key, entry]) => exportTargets(entry, trail + '.' + key))
  fail('manifest has invalid export target at ' + trail)
}

function setFromTar(archive, packageRoot) {
  const entries = run('tar', ['-tzf', archive], rootPath).split('\n').filter(Boolean)
  const seen = new Set()
  for (const entry of entries) {
    if (seen.has(entry)) fail('archive repeats member ' + entry + ': ' + archive)
    seen.add(entry)
  }
  const links = run('tar', ['-tvzf', archive], rootPath).split('\n').filter((line) => /^[lh]/u.test(line))
  if (links.length > 0) fail('archive contains link member: ' + archive)
  return new Set(entries
    .filter((entry) => entry.startsWith('package/') && !entry.endsWith('/'))
    .map((entry) => entry.slice('package/'.length))
    .filter((entry) => packageRoot === undefined || lstatSync(join(packageRoot, entry)).isFile()))
}

function walkFiles(directory, prefix = '', output = new Set()) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    const name = prefix ? prefix + '/' + entry.name : entry.name
    if (entry.isDirectory()) walkFiles(absolute, name, output)
    else if (entry.isFile()) output.add(name)
    else fail('package contains non-file entry: ' + name)
  }
  return output
}

function assertExports(manifest, files, archive) {
  for (const { target, trail } of exportTargets(manifest.exports ?? {})) {
    if (!target.startsWith('./') || target.includes('..') || /^(?:file|link|workspace):/u.test(target)) {
      fail('archive has checkout export at ' + trail + ': ' + target)
    }
    if (/(?:^|\/)src(?:\/|$)/u.test(target)) continue
    if (target.includes('*')) {
      const expression = new RegExp('^' + target.slice(2).replace(/[.+^$(){}|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
      if (![...files].some((file) => expression.test(file))) fail('archive wildcard export has no payload at ' + trail + ': ' + target)
    } else if (!files.has(target.slice(2))) {
      fail('archive export target is missing at ' + trail + ': ' + target)
    }
  }
}

function assertManifest(manifest, archive) {
  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']) {
    for (const [name, value] of Object.entries(manifest[section] ?? {})) {
      if (typeof value === 'string' && /^(?:file|link|workspace):/u.test(value)) fail('archive has source dependency at ' + section + '.' + name + ': ' + value)
      if (name === 'patch-package') fail('archive has forbidden patch dependency')
    }
  }
  if (manifest.patchedDependencies !== undefined || manifest.pnpm?.patchedDependencies !== undefined) fail('archive has patch metadata: ' + archive)
  if (/(?:corePatch|core-patch|deepseekHarnessPatch|deepseek-harness-patch)/iu.test(JSON.stringify(manifest))) fail('archive has Core patch metadata: ' + archive)
}

function inspectArchive(archive, record) {
  const absolute = join(rootPath, archive)
  const manifest = readFixturePackageManifest(archive)
  const extract = mkdtempSync(join(temp, 'archive-'))
  run('tar', ['-xzf', absolute, '-C', extract], rootPath)
  const packageRoot = join(extract, 'package')
  const tarFiles = setFromTar(absolute, packageRoot)
  const diskFiles = walkFiles(packageRoot)
  if (JSON.stringify([...tarFiles].sort()) !== JSON.stringify([...diskFiles].sort())) fail('tar payload differs from extracted files: ' + archive)
  const inspected = inspectFixtureTarball(archive)
  if (record === undefined) fail('archive has no provenance record: ' + archive)
  if (inspected.name !== record.name || inspected.version !== record.version || inspected.sha256 !== record.sha256 || inspected.size !== record.size) fail('archive provenance mismatch: ' + archive)
  const integrity = 'sha512-' + createHash('sha512').update(readFileSync(absolute)).digest('base64')
  if (record.integrity !== integrity) fail('archive integrity mismatch: ' + archive)
  assertManifest(manifest, archive)
  if (record.source === 'official') assertExports(manifest, tarFiles, archive)
  return { archive, absolute, manifest, tarFiles }
}

function resolveFixture(name, requested, byName) {
  let targetName = name
  const range = String(requested)
  if (range.startsWith('npm:')) {
    const alias = range.slice(4)
    const at = alias.lastIndexOf('@')
    if (at > 0) targetName = alias.slice(0, at)
  }
  return (byName.get(targetName) ?? [])
    .filter((row) => satisfiesFixtureRange(row.manifest.version, range))
    .sort((a, b) => String(a.manifest.version).localeCompare(String(b.manifest.version), undefined, { numeric: true }))
    .at(-1)
}

function edgeOverrides(byName, edges) {
  const byIdentity = new Map()
  for (const row of [...byName.values()].flat()) byIdentity.set(row.manifest.name + '@' + row.manifest.version, row)
  const overrides = {}
  for (const [name, rows] of byName) {
    if (rows.length === 1) overrides[name] = 'file:' + rows[0].absolute
  }
  for (const edge of edges) {
    if (edge.status !== 'resolved') continue
    const resolved = byIdentity.get(edge.resolved)
    const parent = byIdentity.get(edge.parent)
    if (!resolved || !parent || parent.archive !== edge.parentArtifact) {
      fail('provenance edge does not identify packed parent and child: ' + edge.parent + ' -> ' + edge.dependency)
    }
    const parentRows = byName.get(parent.manifest.name) ?? []
    const parentSelector = parentRows.length > 1 ? edge.parent : parent.manifest.name
    const key = parentSelector + '>' + edge.dependency
    const value = 'file:' + resolved.absolute
    if (overrides[key] !== undefined && overrides[key] !== value) fail('conflicting fixture overrides for ' + key)
    overrides[key] = value
  }
  return overrides
}

function latestFixture(rows) {
  return [...rows]
    .sort((a, b) => String(a.manifest.version).localeCompare(String(b.manifest.version), undefined, { numeric: true }))
    .at(-1)
}

function writeConsumer(archiveRows, packedRoot) {
  const byName = new Map()
  for (const row of archiveRows) {
    const list = byName.get(row.manifest.name) ?? []
    list.push(row)
    byName.set(row.manifest.name, list)
  }
  const dependencies = { [rootManifest.name]: 'file:' + packedRoot }
  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, requested] of Object.entries(rootManifest[section] ?? {})) {
      const fixture = resolveFixture(name, requested, byName)
      if (!fixture) fail('no fixture satisfies consumer ' + section + ' range ' + name + '@' + requested)
      dependencies[name] = 'file:' + fixture.absolute
    }
  }
  for (const [name, rows] of byName) {
    if (dependencies[name] !== undefined) continue
    dependencies[name] = 'file:' + latestFixture(rows).absolute
  }
  const packageJson = {
    name: 'dsh-external-agents-pack-consumer',
    private: true,
    type: 'module',
    dependencies,
    scripts: {},
  }
  const workspace = [
    "packages: ['.']",
    'overrides:',
    ...Object.entries(edgeOverrides(byName, provenance.parentEdges)).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => '  ' + JSON.stringify(name) + ': ' + JSON.stringify(value)),
    '',
  ].join('\n')
  writeFileSync(join(temp, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n')
  writeFileSync(join(temp, 'pnpm-workspace.yaml'), workspace)
  return byName
}

function findPackageDirectory(start, name) {
  const require = createRequire(join(start, 'package.json'))
  for (const directory of require.resolve.paths(name) ?? []) {
    const candidate = join(directory, name)
    if (existsSync(candidate)) return realpathSync(candidate)
  }
  return undefined
}

function installedPackageDirectories(base) {
  const output = []
  const seen = new Set()
  function visitModules(directory) {
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      const candidate = join(directory, entry.name)
      if (entry.name.startsWith('@')) {
        for (const scoped of readdirSync(candidate, { withFileTypes: true })) {
          if (scoped.isDirectory() || scoped.isSymbolicLink()) visitPackage(join(candidate, scoped.name))
        }
      } else if (entry.name !== '.pnpm') visitPackage(candidate)
    }
  }
  function visitPackage(directory) {
    let real
    try { real = realpathSync(directory) } catch { return }
    if (seen.has(real)) return
    seen.add(real)
    if (!existsSync(join(real, 'package.json'))) return
    output.push(real)
    visitModules(join(real, 'node_modules'))
  }
  function visitVirtualStore(directory) {
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      visitModules(join(directory, entry.name, 'node_modules'))
    }
  }
  visitModules(join(base, 'node_modules'))
  visitVirtualStore(join(base, 'node_modules', '.pnpm'))
  return output
}

function assertInstalledClosure(installRoot, archiveRows) {
  const packages = installedPackageDirectories(installRoot)
  if (!packages.some((directory) => directory === realpathSync(join(installRoot, 'node_modules', rootManifest.name)))) fail('consumer root package was not installed')
  const packageEntries = packages.map((directory) => ({
    directory,
    manifest: JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')),
  }))
  for (const { directory, manifest } of packageEntries) {
    for (const [name] of Object.entries(manifest.dependencies ?? {})) {
      if (!findPackageDirectory(directory, name)) fail('installed dependency is unresolved: ' + manifest.name + ' -> ' + name)
    }
  }
  const directoriesByIdentity = new Map()
  for (const entry of packageEntries) {
    const identity = entry.manifest.name + '@' + entry.manifest.version
    const directories = directoriesByIdentity.get(identity) ?? []
    directories.push(entry.directory)
    directoriesByIdentity.set(identity, directories)
  }
  for (const edge of provenance.parentEdges.filter((entry) => entry.status === 'resolved')) {
    const parents = directoriesByIdentity.get(edge.parent) ?? []
    const installedChildren = parents.map((parent) => {
      const child = findPackageDirectory(parent, edge.dependency)
      if (!child) return undefined
      const manifest = JSON.parse(readFileSync(join(child, 'package.json'), 'utf8'))
      return manifest.name + '@' + manifest.version
    })
    if (!installedChildren.includes(edge.resolved)) {
      const diagnostics = parents.map((parent) => {
        const resolver = createRequire(join(parent, 'package.json'))
        return { parent, paths: resolver.resolve.paths(edge.dependency), child: findPackageDirectory(parent, edge.dependency) }
      })
      fail('installed edge resolved to the wrong fixture: ' + edge.parent + ' -> ' + edge.dependency + ' expected ' + edge.resolved + ' found ' + installedChildren.filter(Boolean).join(', ') + ' diagnostics=' + JSON.stringify(diagnostics))
    }
  }
  const currentParents = [
    ['@anthropic-ai/claude-agent-sdk', '@anthropic-ai/claude-agent-sdk-linux-x64'],
    ['@openai/codex', '@openai/codex-linux-x64'],
    ['koffi', '@koromix/koffi-linux-x64'],
  ]
  for (const [parentName, name] of currentParents) {
    const parent = packages.find((directory) => JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).name === parentName)
    if (parent && archiveRows.some((row) => row.manifest.name === name) && !findPackageDirectory(parent, name)) fail('current native package is not installed: ' + name)
  }
}

function assertStaticImports(directory, manifest) {
  const declared = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})])
  const files = []
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolute)
    }
  }
  visit(join(directory, 'lib'))
  const pattern = /(?:from\s*|import\s*\(|require\s*\(\s*)["']([^"']+)["']/gu
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]
      if (specifier.startsWith('.') || specifier.startsWith('#') || specifier.startsWith('node:')) continue
      if (builtin.has(specifier) || builtin.has(packageName(specifier))) continue
      if (!declared.has(packageName(specifier))) fail('packed runtime imports undeclared package ' + specifier)
    }
  }
}

async function hostSmoke(installRoot) {
  const installedRoot = realpathSync(join(installRoot, 'node_modules', rootManifest.name))
  const hostModule = await import(pathToFileURL(join(installedRoot, 'lib/index.js')).href)
  if (typeof hostModule.apply !== 'function') fail('installed Host factory is not exported')
  let scopeCall = true
  const effects = []
  const host = {
    plugin(_plugin, config) {
      if (scopeCall && config === undefined) {
        scopeCall = false
        const scoped = Object.create(host)
        scoped.extend = () => scoped
        return { ctx: { extend: () => scoped }, dispose: async () => undefined }
      }
      return Promise.resolve(undefined)
    },
    get(name) { return this[name] },
    tools: { register: () => () => undefined },
    subagents: {},
    jobs: {},
    systemPrompt: {},
    connection: { rpc: { handle: () => () => undefined } },
    subprocess: { resolveExecutable: async () => undefined, spawn: async () => undefined },
    logger: { info: () => undefined, warn: () => undefined },
    effect(setup) { const disposer = setup(); effects.push(disposer); return disposer },
  }
  await hostModule.apply(host, { adapters: { codex: { enabled: true, model: 'codex-model' }, 'claude-code': { enabled: true, model: 'claude-model' }, cursor: { enabled: true, model: 'cursor-model' }, antigravity: { enabled: true, model: 'antigravity-model' } } })
  if (!effects.some((value) => typeof value === 'function')) fail('installed Host apply registered no lifecycle effect')
  for (const disposer of effects) if (typeof disposer === 'function') await disposer()
}

async function clientSmoke(installRoot) {
  const installedRoot = realpathSync(join(installRoot, 'node_modules', rootManifest.name))
  let registration
  const previousWindow = globalThis.window
  globalThis.window = { __ModuleLoader__: { load: (value) => { registration = value } } }
  try {
    await import(pathToFileURL(join(installedRoot, 'lib/client.js')).href)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
  if (typeof registration?.factory !== 'function') fail('installed client registration has no factory')
  const require = createRequire(join(installedRoot, 'lib/client.js'))
  const client = registration.factory(require)
  if (typeof client.apply !== 'function') fail('installed client factory has no apply')
  const callbacks = []
  const registered = []
  const clientContext = {
    locale: { register: () => () => undefined, bind: () => (key) => String(key) },
    connection: { rpc: { call: async () => ({ ok: false, error: { message: 'smoke' } }) } },
    slots: {
      inject: (_name, callback) => { callbacks.push(callback); return () => undefined },
      register: (entry) => { registered.push(entry); return () => undefined },
    },
    effect: (setup) => setup(),
  }
  client.apply(clientContext)
  if (callbacks.length === 0) fail('installed client did not register a deferred Settings section')
  for (const callback of callbacks) callback()
  if (registered.length === 0) fail('installed client Settings section did not register')
}

let primaryError
let failed = false
try {
  const artifactRecords = new Map(provenance.artifacts.map((record) => [record.path, record]))
  const archives = listFixtureTarballs()
  if (archives.length !== provenance.artifacts.length) fail('fixture archive/provenance set differs: ' + archives.length + ' vs ' + provenance.artifacts.length)
  const archiveRows = archives.map((archive) => inspectArchive(archive, artifactRecords.get(archive)))
  const packedOutput = run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temp], rootPath)
  const packedReport = JSON.parse(packedOutput)[0]
  if (!packedReport?.filename) fail('npm pack returned no artifact report')
  const packedRoot = join(temp, packedReport.filename)
  const unpacked = join(temp, 'packed')
  mkdirSync(unpacked)
  run('tar', ['-xzf', packedRoot, '-C', unpacked], rootPath)
  const packedPackage = join(unpacked, 'package')
  const packedManifest = JSON.parse(readFileSync(join(packedPackage, 'package.json'), 'utf8'))
  assertManifest(packedManifest, packedRoot)
  const packedFiles = setFromTar(packedRoot, packedPackage)
  const reportFiles = new Set((packedReport.files ?? []).map((entry) => String(entry.path).replace(/^package\//u, '')))
  if (JSON.stringify([...packedFiles].sort()) !== JSON.stringify([...reportFiles].sort())) fail('npm pack report differs from tar payload')
  const required = ['CONTEXT.md', 'README.md', 'package.json', 'cordis.patch.yml', 'docs/spec.md', 'docs/adr/README.md', 'lib/index.js', 'lib/client.js', 'lib/types/index.d.ts', 'lib/types/client/index.d.ts', 'lib/types/client-contract.d.ts', 'skills/delegate-product-worker/SKILL.md']
  for (const file of required) if (!packedFiles.has(file)) fail('packed plugin is missing ' + file)
  if (packedFiles.has('docs/adr/0007-plan-handoff-fails-closed.md')) fail('packed plugin contains retired ADR 0007')
  assertExports(packedManifest, packedFiles, packedRoot)
  assertStaticImports(packedPackage, packedManifest)
  writeConsumer(archiveRows, packedRoot)
  run('pnpm', ['install', '--offline', '--ignore-scripts', '--store-dir', store, '--registry', invalidRegistry, '--config.audit=false', '--config.fund=false'], temp)
  run('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--store-dir', store, '--registry', invalidRegistry, '--config.audit=false', '--config.fund=false'], temp)
  assertInstalledClosure(temp, archiveRows)
  await hostSmoke(temp)
  await clientSmoke(temp)
  console.log('pack check passed: ' + archives.length + ' fixture archives; fresh invalid-registry pnpm install; Host/client installed smokes')
} catch (error) {
  failed = true
  primaryError = error
  throw error
} finally {
  try {
    const temporaryRoot = resolve(tmpdir())
    const temporaryPath = resolve(temp)
    if (temporaryPath === temporaryRoot || !temporaryPath.startsWith(temporaryRoot + sep)) fail('refusing to remove an unsafe temporary path: ' + temp)
    rmSync(temporaryPath, { recursive: true, force: true })
  } catch (cleanupError) {
    if (failed) throw new AggregateError([primaryError, cleanupError], 'external-agents pack check failed and temporary cleanup failed')
    throw cleanupError
  }
}
