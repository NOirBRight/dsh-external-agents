import { readFileSync } from 'node:fs'
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
const rootManifest = JSON.parse(readFileSync(fixturePath('package.json'), 'utf8'))
const artifactRecords = new Map(provenance.artifacts.map(record => [record.path, record]))
const DSH_RANGE = '>=0.1.2-alpha.4 <1.0.0 || 0.1.2-alpha.5 || 0.1.2-rc.1'

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

  it('records registry archives and explicit optional platform gaps', () => {
    const registry = provenance.artifacts.filter(record => record.source === 'registry')
    expect(registry.length).toBeGreaterThan(0)
    for (const record of registry) {
      expect(artifactRecords.get(record.path)).toMatchObject(record)
    }
    expect(provenance.platformAliases.nonCurrentPlatformGaps).toEqual(
      expect.arrayContaining(provenance.parentEdges
        .filter(edge => edge.status === 'platform-gap')
        .map(edge => expect.objectContaining({ name: edge.dependency, status: 'gap' }))),
    )
  })

  it('keeps the plugin release and dual-runtime DSH ranges', () => {
    expect(rootManifest.version).toBe('0.2.3')
    for (const section of ['dependencies', 'peerDependencies']) {
      for (const [name, version] of Object.entries(rootManifest[section] ?? {})) {
        if (name.startsWith('@deepseek-ai/dsh-')) {
          expect(version).toBe(DSH_RANGE)
        }
      }
    }
  })

  it('binds every resolved parent edge to an immutable archive digest', () => {
    expect(provenance.parentEdges.length).toBeGreaterThan(100)
    for (const edge of provenance.parentEdges.filter(record => record.status === 'resolved')) {
      expect(edge.artifact).toEqual(expect.any(String))
      expect(artifactRecords.get(edge.artifact)).toMatchObject({
        integrity: edge.integrity,
        sha256: edge.sha256,
      })
    }
  })

  it('keeps required imports on Alpha.4 and records resolved parent edges', () => {
    expect(provenance.scope.roots).toContain('dsh-external-agents@0.2.2')
    expect(provenance.official.tag).toBe('dsh-v0.1.2-alpha.4')
    expect(provenance.official.commit).toBe(
      '4e84901e6471b79ec0338099867ebb4606d12bb5',
    )
    expect(provenance.hostPlatform).toEqual({ os: 'linux', cpu: 'x64', libc: 'glibc' })
    const officialImports = provenance.requiredImports.filter(record => record.name.startsWith('@deepseek-ai/dsh-')
      || ['@deepseek-ai/cordis', '@deepseek-ai/schemastery'].includes(record.name))
    expect(officialImports.every(record => record.version === '0.1.2-alpha.4'
      || (record.name === '@deepseek-ai/cordis' && record.version === '4.0.2')
      || (record.name === '@deepseek-ai/schemastery' && record.version === '3.18.2'))).toBe(true)
    expect(provenance.parentEdges.length).toBeGreaterThan(100)
    for (const edge of provenance.parentEdges.filter(record => record.status === 'resolved')) {
      expect(edge.artifact).toEqual(expect.any(String))
      expect(artifactRecords.get(edge.artifact)).toMatchObject({
        integrity: edge.integrity,
        sha256: edge.sha256,
      })
    }
  })

  it('indexes duplicate package versions by exact graph identity', () => {
    const graph = indexFixtureProvenance(provenance)
    expect(graph.artifactsByIdentity.size).toBe(provenance.artifacts.length)
    const identities = new Map()
    for (const record of provenance.artifacts) {
      const versions = identities.get(record.name) ?? []
      versions.push(record.version)
      identities.set(record.name, versions)
    }
    const duplicate = [...identities.entries()].find(([, versions]) => new Set(versions).size > 1)
    expect(duplicate).toBeDefined()
    expect([...graph.lockEdges.keys()].some(key => key.includes(duplicate[0] + '@'))).toBe(true)
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

  it('keeps duplicate versions addressable by exact graph identity', () => {
    const graph = indexFixtureProvenance(provenance)
    for (const edge of provenance.parentEdges.filter(record => record.status === 'resolved')) {
      expect(graph.lockEdges.get(edge.parent + '->' + edge.resolved)).toEqual(expect.any(Array))
    }
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
