import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const React = require('react')
const { act, create } = require('react-test-renderer')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pathArgument = process.argv.slice(2).find(argument => argument !== '--')
const composerRoot = resolve(pathArgument ?? process.env.DSH_COMPOSER_PICKER_REPO ?? join(root, '..', 'dsh-composer-picker'))
const temporary = mkdtempSync(join(tmpdir(), 'dsh-plugin-compat-'))
const PRIVATE_PLAN_CONTRACTS = [
  'EXTERNAL_PLAN_HANDOFF_SENTINEL',
  'conversation.composer.plan-review.execution-model',
  'setApprovalPreparation', 'PlanReviewExecutionModelAdapter',
  'PREPARE_PLAN_ENDPOINT', 'COMMIT_PLAN_ENDPOINT', 'handoffPlan', 'PrepareHandoffResult', 'CommitHandoffResult',
]

function parsePackReport(output) {
  const start = output.lastIndexOf('\n[') + 1
  const report = JSON.parse(output.slice(start))[0]
  assert.ok(report?.filename, 'npm pack returned no artifact filename')
  return report
}

function packedClient(repo, expectedName, label) {
  const destination = join(temporary, label)
  const extracted = join(destination, 'extracted')
  mkdirSync(extracted, { recursive: true })
  const output = execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', destination], {
    cwd: repo,
    encoding: 'utf8',
  })
  const report = parsePackReport(output)
  execFileSync('tar', ['-xzf', join(destination, report.filename), '-C', extracted])
  const packageRoot = join(extracted, 'package')
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  assert.equal(manifest.name, expectedName)
  const packedPublicCode = (report.files ?? [])
    .map(entry => entry.path)
    .filter(path => /^lib\/.*(?:\.js|\.d\.ts)$/u.test(path))
    .map(path => readFileSync(join(packageRoot, path), 'utf8'))
    .join('\n')
  for (const forbidden of PRIVATE_PLAN_CONTRACTS) {
    assert.equal(
      packedPublicCode.includes(forbidden), false,
      expectedName + ' packed tarball contains private Plan slot/contract ' + forbidden,
    )
  }
  const rootExport = manifest.exports?.['.']
  const rootPath = typeof rootExport === 'string' ? rootExport : rootExport?.default
  const clientExport = manifest.exports?.['./client']
  const clientPath = typeof clientExport === 'string' ? clientExport : clientExport?.default
  assert.equal(typeof rootPath, 'string', expectedName + ' has no public package-root runtime entry')
  assert.equal(typeof clientPath, 'string', expectedName + ' has no public ./client runtime entry')
  assert.match(clientPath, /^\.\//u)
  assert.doesNotMatch(clientPath, /(?:^|\/)src(?:\/|$)/u)
  assert.equal(JSON.stringify(manifest.exports).includes('/src/'), false, expectedName + ' exports source-checkout paths')
  assert.ok(existsSync(join(packageRoot, rootPath.slice(2))), expectedName + ' packed root export is missing')
  assert.ok(existsSync(join(packageRoot, clientPath.slice(2))), expectedName + ' packed client export is missing')
  return {
    manifest,
    packageRoot,
    rootPath: join(packageRoot, rootPath.slice(2)),
    path: join(packageRoot, clientPath.slice(2)),
  }
}


function checkPackedTypeComposition(external, composer) {
  const consumer = join(temporary, 'typescript-consumer')
  const modules = join(consumer, 'node_modules')
  mkdirSync(modules, { recursive: true })
  symlinkSync(external.packageRoot, join(modules, 'dsh-external-agents'), 'dir')
  symlinkSync(composer.packageRoot, join(modules, 'dsh-composer-picker'), 'dir')
  const deepseekPackages = join(composerRoot, 'node_modules', '@deepseek-ai')
  const typePackages = join(composerRoot, 'node_modules', '@types')
  assert.ok(existsSync(deepseekPackages), 'composer checkout has no installed @deepseek-ai type dependencies')
  assert.ok(existsSync(typePackages), 'composer checkout has no installed @types dependencies')
  symlinkSync(deepseekPackages, join(modules, '@deepseek-ai'), 'dir')
  symlinkSync(typePackages, join(modules, '@types'), 'dir')
  symlinkSync(modules, join(external.packageRoot, 'node_modules'), 'dir')
  symlinkSync(modules, join(composer.packageRoot, 'node_modules'), 'dir')
  writeFileSync(join(consumer, 'index.ts'), [
    "import '@deepseek-ai/dsh-client-ui-slots'",
    "declare module '@deepseek-ai/dsh-client-ui-slots' {",
    "  interface SlotMap {",
    "    'conversation.composer': { kind: 'chain'; scope: 'session'; owner: { interactions: readonly unknown[] } }",
    "  }",
    "}",
    "import { CONTINUE_IN_DSH_SLOT } from 'dsh-external-agents/client'",
    "import type { PlanWorkerTarget } from 'dsh-external-agents/client'",
    "import 'dsh-composer-picker/client'",
    "import type { SlotMap } from '@deepseek-ai/dsh-client-ui-slots'",
    "type CombinedOwner = SlotMap['external-agents.plan-review.continue-in-dsh']['owner']",
    'declare const owner: CombinedOwner',
    "const legacyTarget: PlanWorkerTarget = { id: 'external-agent:legacy', label: 'Legacy' }",
    'void owner',
    'void legacyTarget',
    'void CONTINUE_IN_DSH_SLOT',
    '',
  ].join('\n'))
  writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext',
      strict: true, exactOptionalPropertyTypes: true, skipLibCheck: false, noEmit: true,
    },
    include: ['index.ts'],
  }, null, 2))
  execFileSync('pnpm', ['exec', 'tsc', '-p', join(consumer, 'tsconfig.json')], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

function primitiveModule() {
  const Button = ({ children, icon, ...props }) => React.createElement('button', props, icon, children)
  const Input = props => React.createElement('input', props)
  const Text = ({ children, text, ...props }) => React.createElement('span', props, text ?? children)
  const Stub = props => React.createElement('span', props)
  return new Proxy({ Button, Input, MarkdownText: Text, Toast: Text }, {
    get(target, key) {
      if (typeof key !== 'string') return target[key]
      return target[key] ?? Stub
    },
  })
}

async function materializeClient(clientPath) {
  let definition
  const previousWindow = globalThis.window
  globalThis.window = { __ModuleLoader__: { load(value) { definition = value } } }
  try {
    await import(pathToFileURL(clientPath).href + '?compat=' + encodeURIComponent(clientPath))
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
  assert.equal(typeof definition?.factory, 'function', clientPath + ' did not register a client factory')
  const primitives = primitiveModule()
  return definition.factory((id) => {
    if (id === 'react') return React
    if (id === 'react/jsx-runtime') return require('react/jsx-runtime')
    if (id === 'react-dom') return require('react-dom')
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error('packed client requested unexpected runtime module: ' + id)
  })
}

class PublicSlotsRegistry {
  constructor() {
    this.entries = []
    this.declarations = new Map([
      ['conversation.composer', { kind: 'chain', scope: 'session' }],
      ['conversation.input.model', { kind: 'single', scope: 'session' }],
      ['settings.section', { kind: 'list', scope: 'root' }],
    ])
    this.waiting = new Map()
  }

  inject(name, callback) {
    if (this.declarations.has(name)) return callback()
    const callbacks = this.waiting.get(name) ?? []
    callbacks.push(callback)
    this.waiting.set(name, callbacks)
    return () => {
      const index = callbacks.indexOf(callback)
      if (index >= 0) callbacks.splice(index, 1)
    }
  }

  register(spec, component) {
    assert.ok(this.declarations.has(spec.name), 'registration into undeclared slot ' + spec.name)
    const entry = { spec, component }
    this.entries.push(entry)
    for (const [name, childSpec] of Object.entries(spec.children ?? {})) {
      assert.ok(!this.declarations.has(name), 'duplicate child declaration ' + name)
      this.declarations.set(name, { ...childSpec, owner: entry })
      const callbacks = this.waiting.get(name) ?? []
      this.waiting.delete(name)
      for (const callback of callbacks) callback()
    }
    return () => {
      const index = this.entries.indexOf(entry)
      if (index >= 0) this.entries.splice(index, 1)
    }
  }
}

function directoryFixture(invocations) {
  const selected = []
  const snapshot = {
    current: { provider: 'codex', model: 'gpt-5.6-sol' },
    groups: [], failures: [], status: 'ready', error: null,
  }
  const store = {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
  }
  return {
    selected,
    directory: {
      store,
      load: async () => undefined,
      select: async selection => { invocations.push('select'); selected.push(selection); return true },
    },
  }
}

function contextFor(registry, directory) {
  const locale = {
    register: () => () => undefined,
    bind: () => key => key,
  }
  const ctx = {
    locale,
    slots: registry,
    sessions: { subagentAddress: () => undefined },
    modelDirectories: { directoryFor: () => directory },
    effect: callback => callback(),
    inject: (_services, callback) => callback(ctx),
    get: () => ({ rpc: { call: () => new Promise(() => undefined) } }),
  }
  return ctx
}

function bindInjectFace(face) {
  const { hooks = {}, ...plain } = face
  for (const [name, source] of Object.entries(hooks)) {
    const hookName = 'use' + name[0].toUpperCase() + name.slice(1)
    plain[hookName] = selector => selector(source.getSnapshot())
  }
  return plain
}

function planOwner(responses, invocations) {
  return {
    interactions: [{
      kind: 'question',
      key: 'packed-plan-1',
      sessionId: 'session-1',
      respond: async value => { invocations.push('respond'); responses.push(value); return { accepted: true } },
      payload: { questions: [{
        id: 'approve-plan',
        question: 'Ready?',
        detail: '# Packed composition plan',
        multiSelect: false,
        intent: { kind: 'plan-review', approve: 'Approve' },
        options: [{ label: 'Approve' }, { label: 'Keep planning' }],
      }] },
    }],
  }
}

async function verifyOrder(label, plugins) {
  const registry = new PublicSlotsRegistry()
  const invocations = []
  const fixture = directoryFixture(invocations)
  const ctx = contextFor(registry, fixture.directory)
  for (const plugin of plugins) plugin.apply(ctx)

  const chain = registry.entries.filter(entry => entry.spec.name === 'conversation.composer')
  assert.equal(chain.length, 2, label + ': both packed plugins must contribute to the public composer chain')
  assert.deepEqual(chain.map(entry => entry.spec.priority).sort((a, b) => a - b), [-6, -5])
  const responses = []
  const owner = planOwner(responses, invocations)
  const matches = chain
    .map(entry => ({ entry, matched: entry.spec.select(owner) }))
    .filter(candidate => candidate.matched !== null)
    .sort((left, right) => left.entry.spec.priority - right.entry.spec.priority)
  assert.equal(matches.length, 2, label + ': both selectors should recognize the same public plan-review owner')
  const elected = matches.slice(0, 1)
  assert.equal(elected.length, 1, label + ': chain dispatch must elect exactly one top Plan card')
  assert.equal(elected[0].entry.spec.priority, -6)

  const childNames = Object.keys(elected[0].entry.spec.children ?? {})
  assert.equal(childNames.length, 1, label + ': elected owner must declare exactly one child slot')
  const childName = childNames[0]
  const childEntries = registry.entries.filter(entry => entry.spec.name === childName)
  assert.equal(childEntries.length, 1, label + ': composer picker must contribute exactly one child through the declared slot')

  let capturedOwner
  const renderSlot = (name, owner) => {
    assert.equal(name, childName)
    assert.equal(typeof owner.locked, 'boolean')
    assert.ok(Array.isArray(owner.targets))
    assert.equal(typeof owner.targetsLabel, 'string')
    assert.equal(typeof owner.selectedTarget, 'string')
    assert.equal(typeof owner.selectTarget, 'function')
    assert.equal(typeof owner.registerCommit, 'function', label + ': Composer must register the execution commit')
    assert.equal(owner.publishDraft, undefined, label + ': top owner must not take over Composer draft ownership')
    assert.equal(owner.current, undefined)
    assert.equal(owner.draft, undefined)
    capturedOwner = owner
    const child = childEntries[0]
    const face = bindInjectFace(child.spec.inject?.('session-1') ?? {})
    return React.createElement(child.component, {
      ...owner,
      ...face,
      sessionId: 'session-1',
      t: key => key,
    })
  }

  const ownerFace = bindInjectFace(elected[0].entry.spec.inject?.('session-1') ?? {})
  let tree
  await act(async () => {
    tree = create(React.createElement(elected[0].entry.component, {
      ...ownerFace,
      matched: elected[0].matched,
      sessionId: 'session-1',
      t: key => key,
      renderSlot,
    }))
    await Promise.resolve()
  })
  assert.equal(tree.root.findAll(node => node.props?.['data-external-plan-review'] === 'packed-plan-1').length, 1,
    label + ': assembled output must contain exactly one top Plan card')
  assert.ok(capturedOwner, label + ': top card must render its public child slot owner')
  const approve = tree.root.findAllByType('button').find(button => button.children.includes('plan.approve'))
  assert.ok(approve, label + ': assembled card must render Approve')
  await act(async () => {
    approve.props.onClick()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
  assert.deepEqual(fixture.selected, [{ provider: 'codex', model: 'gpt-5.6-sol' }],
    label + ': Composer child must commit its Model Directory selection')
  assert.equal(responses.length, 1,
    label + ': ready child must produce exactly one official Plan response')
  assert.deepEqual(invocations, ['select', 'respond'],
    label + ': model selection must commit before the official Plan response')
  await act(async () => { tree.unmount() })
}

try {
  const external = packedClient(root, 'dsh-external-agents', 'external')
  const composer = packedClient(composerRoot, 'dsh-composer-picker', 'composer')
  const composerRootEntry = await import(pathToFileURL(composer.rootPath).href)
  assert.equal(typeof composerRootEntry.parsePickerId, 'function', 'composer must preserve parsePickerId at package root')
  assert.equal(typeof composerRootEntry.groupFamilies, 'function', 'composer must preserve groupFamilies at package root')
  assert.deepEqual(composerRootEntry.parsePickerId('gpt-5.6-sol-272k-fast'), {
    base: 'gpt-5.6-sol', fast: true, contextTier: '272k', contextTokens: 272_000,
  }, 'composer must preserve v0.1.3 parsePickerId behavior')
  assert.deepEqual(composerRootEntry.groupFamilies([]), [], 'composer must preserve empty catalog grouping behavior')
  const externalRuntimeDeps = { ...external.manifest.dependencies, ...external.manifest.optionalDependencies, ...external.manifest.peerDependencies }
  const composerRuntimeDeps = { ...composer.manifest.dependencies, ...composer.manifest.optionalDependencies, ...composer.manifest.peerDependencies }
  assert.equal(externalRuntimeDeps['dsh-composer-picker'], undefined, 'external-agents must not gain a composer-picker runtime dependency')
  assert.equal(composerRuntimeDeps['dsh-external-agents'], undefined, 'composer-picker must not gain an external-agents runtime dependency')

  checkPackedTypeComposition(external, composer)

  const externalPlugin = await materializeClient(external.path)
  const composerPlugin = await materializeClient(composer.path)
  assert.equal(typeof externalPlugin.apply, 'function')
  assert.equal(externalPlugin.CONTINUE_IN_DSH_SLOT, 'external-agents.plan-review.continue-in-dsh')
  assert.equal(typeof composerPlugin.apply, 'function')

  await verifyOrder('external-first', [externalPlugin, composerPlugin])
  await verifyOrder('composer-first', [composerPlugin, externalPlugin])
  console.log('cross-plugin packed compatibility passed: dual-package types, packed runtime both orders, v0.1.3-compatible root surface, priorities -6/-5, one Plan card, one registered-commit child, Composer commit-before-response')
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
