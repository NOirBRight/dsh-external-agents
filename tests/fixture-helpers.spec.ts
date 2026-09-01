import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'
import {
  fixturePath,
  indexFixtureProvenance,
  inspectFixtureTarball,
  listFixtureTarballs,
  readFixtureProvenance,
  satisfiesFixtureRange,
  validateFixtureClosure,
} from '../scripts/fixture-helpers.mjs'

const provenance = readFixtureProvenance()
const workspace = parse(readFileSync(fixturePath('pnpm-workspace.yaml'), 'utf8'))
const lockfile = parse(readFileSync(fixturePath('pnpm-lock.yaml'), 'utf8'))
const rootManifest = JSON.parse(readFileSync(fixturePath('package.json'), 'utf8'))
const artifactRecords = new Map(provenance.artifacts.map(record => [record.path, record]))

describe('official DSH fixture closure', () => {
  it('matches every archive to a checked-in digest and package identity', () => {
    const archives = listFixtureTarballs()
    expect(new Set(archives).size).toBe(archives.length)
    expect(archives).toHaveLength(provenance.artifacts.length)
    expect(new Set(provenance.artifacts.map(record => record.path)).size).toBe(provenance.artifacts.length)
    for (const archive of archives) {
      const record = artifactRecords.get(archive)
      expect(record).toBeDefined()
      const inspected = inspectFixtureTarball(archive)
      expect(inspected).toMatchObject({
        path: archive,
        name: record.name,
        version: record.version,
        sha256: record.sha256,
        integrity: record.integrity,
        size: record.size,
      })
      expect(inspected.symlinks).toEqual([])
      expect(inspected.duplicateEntries).toEqual([])
      expect(inspected.version).not.toMatch(/\brc\./i)
    }
  }, 120_000)

  it('records registry archive paths and current platform identities', () => {
    const registryPaths = new Set(provenance.registryArtifacts.map(record => record.artifact))
    expect(registryPaths.size).toBe(provenance.registryArtifacts.length)
    for (const record of provenance.registryArtifacts) {
      const artifact = artifactRecords.get(record.artifact)
      expect(artifact).toMatchObject({
        name: record.name,
        version: record.version,
        sha256: record.sha256,
        integrity: record.integrity,
        size: record.size,
      })
      expect(artifact.source).toBe('registry')
    }
    const optional = provenance.platformAliases.optionalDependencies
    expect(optional.every(record => record.encoding === 'optionalDependencies')).toBe(true)
    expect(provenance.platformAliases.nonCurrentPlatformGaps).toEqual(
      optional.filter(record => record.status === 'gap'),
    )
    expect(optional.some(record => record.status === 'current'
      && record.platform.os === 'linux' && record.platform.cpu === 'x64')).toBe(true)
    for (const record of optional.filter(entry => entry.status === 'current')) {
      expect(record.artifact).toEqual(expect.any(String))
      const artifact = artifactRecords.get(record.artifact)
      expect(artifact).toMatchObject({
        sha256: record.sha256,
        integrity: record.artifactIntegrity,
        size: record.size,
      })
      expect(record.manifestName).toBeDefined()
      expect(record.manifestVersion).toBeDefined()
    }
    expect(provenance.platformAliases.nonCurrentPlatformGaps.every(record => record.status === 'gap')).toBe(true)
    const openai = optional.find(record => record.name === '@openai/codex-linux-x64' && record.status === 'current')
    expect(openai).toMatchObject({
      resolved: '@openai/codex@0.149.1-linux-x64',
      manifestName: '@openai/codex',
      manifestVersion: '0.149.1-linux-x64',
    })
    expect(optional.find(record => record.name === '@koromix/koffi-linux-x64')).toMatchObject({
      status: 'current',
      manifestName: '@koromix/koffi-linux-x64',
      manifestVersion: '3.1.1',
    })
  })

  it('keeps the plugin release and DSH pins exact', () => {
    expect(rootManifest.version).toBe('0.2.1')
    for (const section of ['dependencies', 'peerDependencies']) {
      for (const [name, version] of Object.entries(rootManifest[section] ?? {})) {
        if (name.startsWith('@deepseek-ai/dsh-')) {
          expect(['0.1.2-alpha.1', '^0.1.2-alpha.1']).toContain(version)
        }
      }
    }
  })

  it('binds each local override to its lock integrity record', () => {
    const overrides = Object.entries(workspace.overrides ?? {}).filter(([, value]) => String(value).startsWith('file:fixtures/packages/'))
    expect(overrides.length).toBeGreaterThan(100)
    const lockPackages = Object.values(lockfile.packages ?? {})
    for (const [, value] of overrides) {
      const tarball = String(value)
      const archive = 'fixtures/packages/' + tarball.slice('file:fixtures/packages/'.length)
      const artifact = artifactRecords.get(archive)
      expect(artifact).toBeDefined()
      const lockRecord = lockPackages.find(record => record?.resolution?.tarball === tarball)
      expect(lockRecord).toBeDefined()
      expect(lockRecord.resolution.integrity).toBe(artifact.integrity)
    }
  })

  it('keeps required imports on alpha1 and records resolved parent edges', () => {
    expect(provenance.scope.roots).toContain('dsh-external-agents@0.2.1')
    expect(provenance.official.tag).toBe('dsh-v0.1.2-alpha.1')
    expect(provenance.official.commit).toBe(
      'cd5ef8148158c3a752a658978873241fdf8e2bbc',
    )
    expect(provenance.hostPlatform).toEqual({ os: 'linux', cpu: 'x64', libc: 'glibc' })
    expect(provenance.requiredImports.every(record => record.version === '0.1.2-alpha.1'
      || (record.name === '@deepseek-ai/cordis' && record.version === '4.0.1')
      || (record.name === '@deepseek-ai/schemastery' && record.version === '3.18.1')
      || (['react', 'react-dom'].includes(record.name) && record.version === '18.3.1'))).toBe(true)
    expect(provenance.parentEdges.length).toBeGreaterThan(100)
    for (const edge of provenance.parentEdges.filter(record => record.status === 'resolved')) {
      expect(edge.artifact).toEqual(expect.any(String))
      expect(artifactRecords.get(edge.artifact)).toMatchObject({
        integrity: edge.integrity,
        sha256: edge.sha256,
      })
    }
    const contentType = provenance.parentEdges.filter(edge => edge.dependency === 'content-type' && edge.status === 'resolved')
    expect(new Set(contentType.map(edge => edge.resolved))).toEqual(new Set(['content-type@1.0.5', 'content-type@2.0.0']))
    expect(contentType).toEqual(expect.arrayContaining([
      expect.objectContaining({ parent: 'express@5.2.1', resolved: 'content-type@1.0.5' }),
      expect.objectContaining({ parent: 'body-parser@2.3.0', resolved: 'content-type@2.0.0' }),
      expect.objectContaining({ parent: 'type-is@2.1.0', resolved: 'content-type@2.0.0' }),
    ]))
  })

  it('indexes duplicate package versions by exact graph identity', () => {
    const graph = indexFixtureProvenance(provenance)
    expect(graph.artifactsByIdentity.size).toBe(provenance.artifacts.length)
    expect(graph.artifactsByIdentity.get('negotiator@0.6.4')).toMatchObject({
      path: 'fixtures/packages/negotiator-0.6.4.tgz',
    })
    expect(graph.artifactsByIdentity.get('negotiator@1.0.0')).toMatchObject({
      path: 'fixtures/packages/negotiator-1.0.0.tgz',
    })
    expect(graph.lockEdges.get('compression@1.8.1->negotiator@0.6.4')).toEqual(
      expect.arrayContaining([expect.objectContaining({ requested: '~0.6.4' })]),
    )
    expect(graph.lockEdges.has('compression@1.8.1->negotiator@1.0.0')).toBe(false)
  })

  it('validates declared ranges without accepting an unsatisfied edge', () => {
    expect(satisfiesFixtureRange('0.6.4', '~0.6.4')).toBe(true)
    expect(satisfiesFixtureRange('1.0.0', '~0.6.4')).toBe(false)
    expect(satisfiesFixtureRange('0.149.1-linux-x64', 'npm:@openai/codex@0.149.1-linux-x64')).toBe(true)
    const invalid = structuredClone(provenance)
    const edge = invalid.parentEdges.find(record => record.parent === 'compression@1.8.1' && record.dependency === 'negotiator')
    edge.requested = '^1.0.0'
    expect(() => validateFixtureClosure(invalid)).toThrow(/range differs from parent declaration/)
  })

  it('uses consumer-scoped overrides for nested duplicate versions', () => {
    expect(workspace.overrides).toMatchObject({
      negotiator: 'file:fixtures/packages/negotiator-1.0.0.tgz',
      'compression>negotiator': 'file:fixtures/packages/negotiator-0.6.4.tgz',
      debug: 'file:fixtures/packages/debug-4.4.3.tgz',
      'compression>debug': 'file:fixtures/packages/debug-2.6.9.tgz',
      'debug@2.6.9>ms': 'file:fixtures/packages/ms-2.0.0.tgz',
    })
    expect(lockfile.overrides).toMatchObject(workspace.overrides)
    const compression = lockfile.snapshots['compression@file:fixtures/packages/compression-1.8.1.tgz']
    expect(compression.dependencies).toMatchObject({
      debug: 'file:fixtures/packages/debug-2.6.9.tgz',
      negotiator: 'file:fixtures/packages/negotiator-0.6.4.tgz',
    })
    expect(lockfile.snapshots['debug@file:fixtures/packages/debug-2.6.9.tgz'].dependencies.ms).toBe(
      'file:fixtures/packages/ms-2.0.0.tgz',
    )
  })

  it('validates the complete reachable archive closure', () => {
    expect(() => validateFixtureClosure(provenance)).not.toThrow()
  })

  it('rejects an unresolved nonoptional edge independently', () => {
    const invalid = structuredClone(provenance)
    const edge = invalid.parentEdges.find(record => !record.optional && record.status === 'resolved')
    edge.status = 'host-supplied-or-missing'
    expect(() => validateFixtureClosure(invalid)).toThrow(/nonoptional fixture edge is unresolved/)
  })

  it('rejects an unreachable archive independently', () => {
    const invalid = structuredClone(provenance)
    const extra = { ...invalid.artifacts[0], path: 'fixtures/packages/unreachable-fixture-1.0.0.tgz', name: 'unreachable-fixture', version: '1.0.0' }
    invalid.artifacts.push(extra)
    expect(() => validateFixtureClosure(invalid, [...listFixtureTarballs(), extra.path])).toThrow(/unreachable archives/)
  })

  it('rejects duplicate package versions independently', () => {
    const invalid = structuredClone(provenance)
    const duplicate = { ...invalid.artifacts[0], path: 'fixtures/packages/duplicate-version-fixture.tgz' }
    invalid.artifacts.push(duplicate)
    expect(() => validateFixtureClosure(invalid, [...listFixtureTarballs(), duplicate.path])).toThrow(/duplicate package versions/)
  })

  it('rejects an archive set that differs from provenance', () => {
    expect(() => validateFixtureClosure(provenance, [...listFixtureTarballs(), 'fixtures/packages/extraneous-fixture.tgz'])).toThrow(/archive set differs/)
  })
})
