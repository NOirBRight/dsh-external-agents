import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url)
const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: root,
  encoding: 'utf8',
})
const reportStart = output.lastIndexOf('\n[') + 1
const report = JSON.parse(output.slice(reportStart))[0]
if (report === undefined || !Array.isArray(report.files)) throw new Error('npm pack returned no file report')
const files = new Set(report.files.map(file => file.path))
const required = [
  'CONTEXT.md',
  'README.md',
  'package.json',
  'cordis.patch.yml',
  'docs/spec.md',
  'docs/adr/README.md',
  'docs/adr/0007-plan-handoff-fails-closed.md',
  'lib/index.js',
  'lib/client.js',
  'lib/types/index.d.ts',
  'lib/types/client/index.d.ts',
  'skills/delegate-product-worker/SKILL.md',
]
for (const file of required) {
  if (!files.has(file)) throw new Error('packed plugin is missing ' + file)
}
for (const file of files) {
  if (/^(?:src|tests|scripts|node_modules|prototypes|@deepseek-ai)\//u.test(file)
    || /(?:^|\/)\.env(?:\.|$)/u.test(file)
    || /(?:credential|token|auth\.json)/iu.test(file)
    || /(?:^|\/)(?:core|deepseek-harness).*\.(?:diff|patch)$/iu.test(file)) {
    throw new Error('packed plugin contains forbidden path ' + file)
  }
}
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
if (JSON.stringify(manifest.exports ?? {}).includes('/src/')) throw new Error('packed manifest exports source-checkout paths')
for (const value of Object.values({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies })) {
  if (typeof value === 'string' && /^(?:file|link|workspace):/u.test(value)) {
    throw new Error('packed manifest contains source-checkout dependency alias ' + value)
  }
}
const packedRuntime = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  + readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
for (const forbidden of [
  'EXTERNAL_PLAN_HANDOFF_SENTINEL',
  'conversation.composer.plan-review.execution-model',
  'setApprovalPreparation',
  'PlanReviewExecutionModelAdapter',
]) {
  if (packedRuntime.includes(forbidden)) throw new Error('packed plugin contains fork-only contract ' + forbidden)
}
console.log('pack check passed: ' + String(files.size) + ' files')
