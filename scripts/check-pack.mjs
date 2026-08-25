import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { conditionalTarget } from './export-helpers.mjs'

const root = new URL('..', import.meta.url)
const temp = mkdtempSync(join(tmpdir(), 'dsh-external-agents-pack-'))

function exportTargets(value, trail = 'exports') {
  if (typeof value === 'string') return [{ target: value, trail }]
  if (value === null) return []
  if (Array.isArray(value)) return value.flatMap((entry, index) => exportTargets(entry, trail + '[' + String(index) + ']'))
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([condition, entry]) => exportTargets(entry, trail + '.' + condition))
  }
  throw new Error('packed manifest has invalid export target at ' + trail)
}

try {
  const output = execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temp], {
    cwd: root, encoding: 'utf8',
  })
  const reportStart = output.lastIndexOf('\n[') + 1
  const report = JSON.parse(output.slice(reportStart))[0]
  if (report === undefined || typeof report.filename !== 'string') throw new Error('npm pack returned no artifact report')

  const archive = join(temp, report.filename)
  execFileSync('tar', ['-xzf', archive, '-C', temp])
  const extractedRoot = join(temp, 'package')
  const manifest = JSON.parse(readFileSync(join(extractedRoot, 'package.json'), 'utf8'))
  symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), join(extractedRoot, 'node_modules'), 'dir')
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
    .split('\n').filter(Boolean).map(path => path.replace(/^package\//u, ''))
  const files = new Set(entries)

  const required = [
    'CONTEXT.md', 'README.md', 'package.json', 'cordis.patch.yml', 'docs/spec.md',
    'docs/adr/README.md', 'docs/adr/0007-plan-handoff-fails-closed.md',
    'lib/index.js', 'lib/client.js', 'lib/types/index.d.ts', 'lib/types/client/index.d.ts',
    'lib/types/client-contract.d.ts',
    'skills/delegate-product-worker/SKILL.md',
  ]
  for (const file of required) {
    if (!files.has(file)) throw new Error('packed plugin is missing ' + file)
  }

  for (const { target, trail } of exportTargets(manifest.exports ?? {})) {
    if (!target.startsWith('./') || target.includes('..') || /(?:^|\/)src(?:\/|$)/u.test(target)
      || /^(?:file|link|workspace):/u.test(target)) {
      throw new Error('packed manifest contains source-checkout export alias at ' + trail + ': ' + target)
    }
    const packedPath = target.slice(2)
    if (!files.has(packedPath)) throw new Error('packed export target is missing at ' + trail + ': ' + packedPath)
  }

  for (const file of files) {
    if (/^(?:src|tests|scripts|node_modules|prototypes|@deepseek-ai)\//u.test(file)
      || /(?:^|\/)\.env(?:\.|$)/u.test(file)
      || /(?:credential|token|auth\.json)/iu.test(file)
      || /\.(?:patch|diff|map)$/iu.test(file)) {
      throw new Error('packed plugin contains forbidden path ' + file)
    }
  }

  const manifestStrings = []
  const collectManifestStrings = (value) => {
    if (typeof value === 'string') manifestStrings.push(value)
    else if (Array.isArray(value)) value.forEach(collectManifestStrings)
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(collectManifestStrings)
  }
  collectManifestStrings(manifest)
  for (const value of manifestStrings) {
    if (/^(?:file|link|workspace):/u.test(value)) {
      throw new Error('packed manifest contains source-checkout alias ' + value)
    }
  }

  for (const [name, value] of Object.entries({
    ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies, ...manifest.devDependencies,
  })) {
    if (name === 'patch-package' || (typeof value === 'string' && /^(?:file|link|workspace):/u.test(value))) {
      throw new Error('packed manifest contains Core/source-checkout acceptance path ' + name + ': ' + String(value))
    }
  }
  if (manifest.patchedDependencies !== undefined || manifest.pnpm?.patchedDependencies !== undefined
    || /(?:corePatch|core-patch|deepseekHarnessPatch|deepseek-harness-patch)/iu.test(JSON.stringify(manifest))) {
    throw new Error('packed manifest contains a Core-patch acceptance path')
  }

  const packedPublicCode = [...files]
    .filter(file => /^lib\/.*(?:\.js|\.d\.ts)$/u.test(file))
    .map(file => readFileSync(join(extractedRoot, file), 'utf8'))
    .join('\n')
  for (const file of files) {
    if (file.endsWith('.d.ts') && readFileSync(join(extractedRoot, file), 'utf8').includes('sourceMappingURL')) {
      throw new Error('packed declaration contains a source-map alias ' + file)
    }
  }
  for (const forbidden of [
    'EXTERNAL_PLAN_HANDOFF_SENTINEL', 'conversation.composer.plan-review.execution-model',
    'setApprovalPreparation', 'PlanReviewExecutionModelAdapter',
    'PREPARE_PLAN_ENDPOINT', 'COMMIT_PLAN_ENDPOINT', 'handoffPlan',
    'PrepareHandoffResult', 'CommitHandoffResult',
  ]) {
    if (packedPublicCode.includes(forbidden)) throw new Error('packed plugin contains Core/fork-only contract ' + forbidden)
  }

  const rootTarget = conditionalTarget(manifest.exports, '.')
  const published = await import(pathToFileURL(join(extractedRoot, rootTarget.slice(2))).href)
  if (typeof published.apply !== 'function') throw new Error('packed advertised package root did not load')
  let clientRegistration
  const previousWindow = globalThis.window
  globalThis.window = { __ModuleLoader__: { load: registration => { clientRegistration = registration } } }
  try {
    const clientTarget = conditionalTarget(manifest.exports, './client')
    await import(pathToFileURL(join(extractedRoot, clientTarget.slice(2))).href)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
  if (clientRegistration?.id !== manifest.name || typeof clientRegistration.factory !== 'function') {
    throw new Error('packed advertised client entry did not load')
  }

  console.log('pack check passed: ' + String(files.size) + ' files; all export targets exist and root/client load')
} finally {
  rmSync(temp, { recursive: true, force: true })
}
