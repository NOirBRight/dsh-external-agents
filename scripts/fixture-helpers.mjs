import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Absolute path to the checkout containing this helper. */
export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Relative directory containing the repository-owned package archives. */
export const FIXTURE_PACKAGE_DIRECTORY = 'fixtures/packages'

/** Relative path to the fixture provenance document. */
export const FIXTURE_PROVENANCE_PATH = 'fixtures/provenance.json'

/**
 * Resolve a repository-relative fixture path.
 * @param path Repository-relative fixture path.
 * @returns Absolute fixture path.
 */
export function fixturePath(path) {
  return resolve(REPOSITORY_ROOT, path)
}

/**
 * List repository-owned fixture archives in stable order.
 * @returns Repository-relative archive paths.
 */
export function listFixtureTarballs() {
  return readdirSync(fixturePath(FIXTURE_PACKAGE_DIRECTORY))
    .filter(name => name.endsWith('.tgz'))
    .sort()
    .map(name => FIXTURE_PACKAGE_DIRECTORY + '/' + name)
}

/**
 * Read the package manifest embedded in a fixture archive.
 * @param path Repository-relative or absolute archive path.
 * @returns The embedded package manifest.
 */
export function readFixturePackageManifest(path) {
  const archive = resolve(REPOSITORY_ROOT, path)
  return JSON.parse(execFileSync('tar', ['-xOzf', archive, 'package/package.json'], { encoding: 'utf8' }))
}

/**
 * Compute the SHA-256 digest of a fixture archive.
 * @param path Repository-relative or absolute archive path.
 * @returns Lowercase hexadecimal SHA-256 digest.
 */
export function sha256Fixture(path) {
  const digest = createHash('sha256')
  digest.update(readFileSync(resolve(REPOSITORY_ROOT, path)))
  return digest.digest('hex')
}

/**
 * Compute the npm integrity digest of a fixture archive.
 * @param path Repository-relative or absolute archive path.
 * @returns SHA-512 integrity string.
 */
export function integrityFixture(path) {
  const digest = createHash('sha512')
  digest.update(readFileSync(resolve(REPOSITORY_ROOT, path)))
  return 'sha512-' + digest.digest('base64')
}

/**
 * Inspect archive identity, size, digest, and symlink entries.
 * @param path Repository-relative or absolute archive path.
 * @returns Derived archive metadata.
 */
export function inspectFixtureTarball(path) {
  const archive = resolve(REPOSITORY_ROOT, path)
  const manifest = readFixturePackageManifest(archive)
  const listing = execFileSync('tar', ['-tvzf', archive], { encoding: 'utf8' })
  const symlinks = listing.split('\n').filter(line => line.startsWith('l') || line.includes(' -> '))
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).split('\n').filter(Boolean)
  const seen = new Set()
  const duplicateEntries = []
  for (const entry of entries) {
    if (seen.has(entry)) duplicateEntries.push(entry)
    seen.add(entry)
  }
  const repositoryPath = relative(REPOSITORY_ROOT, archive).split(sep).join('/')
  return {
    path: repositoryPath,
    name: manifest.name,
    version: manifest.version,
    sha256: sha256Fixture(archive),
    integrity: integrityFixture(archive),
    size: statSync(archive).size,
    symlinks,
    entries,
    duplicateEntries,
  }
}

/**
 * Read the checked-in fixture provenance document.
 * @returns Parsed fixture provenance.
 */
export function readFixtureProvenance() {
  return JSON.parse(readFileSync(fixturePath(FIXTURE_PROVENANCE_PATH), 'utf8'))
}

/**
 * Return the stable package identity used by fixture graph indexes.
 * @param name Package name.
 * @param version Package version.
 * @returns Package name and version joined by an at sign.
 */
export function fixturePackageIdentity(name, version) {
  return name + '@' + version
}

function parseFixtureVersion(value) {
  const match = String(value).trim().match(/^(?:v)?(\d+)(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/)
  if (match === null || [match[2], match[3]].some(part => part !== undefined && /^[xX*]$/.test(part))) return undefined
  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
    specified: match[3] === undefined ? (match[2] === undefined ? 1 : 2) : 3,
    prerelease: match[4]?.split('.') ?? [],
  }
}

function compareFixtureVersions(left, right) {
  for (const field of ['major', 'minor', 'patch']) {
    if (left[field] !== right[field]) return left[field] < right[field] ? -1 : 1
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) return 0
    return left.prerelease.length === 0 ? 1 : -1
  }
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index++) {
    const leftPart = left.prerelease[index]
    const rightPart = right.prerelease[index]
    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    if (leftPart === rightPart) continue
    const leftNumber = /^\d+$/.test(leftPart)
    const rightNumber = /^\d+$/.test(rightPart)
    if (leftNumber && rightNumber) return Number(leftPart) < Number(rightPart) ? -1 : 1
    if (leftNumber !== rightNumber) return leftNumber ? -1 : 1
    return leftPart < rightPart ? -1 : 1
  }
  return 0
}

function nextFixtureVersion(base, field) {
  return {
    major: base.major + (field === 'major' ? 1 : 0),
    minor: field === 'major' ? 0 : base.minor + (field === 'minor' ? 1 : 0),
    patch: field === 'patch' ? base.patch + 1 : 0,
    specified: 3,
    prerelease: [],
  }
}

function fixtureRangeBounds(token, operator) {
  const base = parseFixtureVersion(token)
  if (base === undefined) return undefined
  if (operator === '^') {
    const field = base.major > 0 ? 'major' : base.minor > 0 ? 'minor' : 'patch'
    return [base, nextFixtureVersion(base, field)]
  }
  if (operator === '~') return [base, nextFixtureVersion(base, base.specified === 1 ? 'major' : 'minor')]
  return [base, undefined]
}

function fixtureRangeAlternativeSatisfies(version, alternative) {
  const tokens = alternative.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  if (tokens.length === 1 && (tokens[0].startsWith('^') || tokens[0].startsWith('~'))) {
    const bounds = fixtureRangeBounds(tokens[0].slice(1), tokens[0][0])
    return bounds !== undefined
      && compareFixtureVersions(version, bounds[0]) >= 0
      && (bounds[1] === undefined || compareFixtureVersions(version, bounds[1]) < 0)
  }
  const comparisons = []
  for (let index = 0; index < tokens.length; index++) {
    let token = tokens[index]
    let operator = ''
    if (/^(?:>=|<=|>|<|=)$/.test(token)) {
      operator = token
      token = tokens[++index] ?? ''
    } else {
      const match = token.match(/^(>=|<=|>|<|=)(.*)$/)
      if (match !== null) {
        operator = match[1]
        token = match[2]
      }
    }
    if (token === '' || token.startsWith('^') || token.startsWith('~')) return false
    const parsed = parseFixtureVersion(token)
    if (parsed === undefined) return false
    if (operator === '') {
      if (parsed.specified === 3) comparisons.push(['=', parsed])
      else comparisons.push(['>=', parsed], ['<', nextFixtureVersion(parsed, parsed.specified === 1 ? 'major' : 'minor')])
    } else {
      comparisons.push([operator, parsed])
    }
  }
  return comparisons.every(([operator, target]) => {
    const comparison = compareFixtureVersions(version, target)
    return operator === '=' ? comparison === 0
      : operator === '>=' ? comparison >= 0
        : operator === '>' ? comparison > 0
          : operator === '<=' ? comparison <= 0
            : comparison < 0
  })
}

/**
 * Check whether a resolved fixture version satisfies a declared dependency range.
 * @param version Resolved package version.
 * @param range Declared dependency range or npm alias.
 * @returns Whether the version satisfies the declared range.
 */
export function satisfiesFixtureRange(version, range) {
  if (typeof range !== 'string') return false
  if (range.startsWith('npm:')) {
    const target = range.slice(4)
    const separator = target.lastIndexOf('@')
    return separator > 0 && String(version) === target.slice(separator + 1)
  }
  const parsed = parseFixtureVersion(version)
  if (parsed === undefined) return false
  return range.split('||').some(alternative => fixtureRangeAlternativeSatisfies(parsed, alternative))
}

/**
 * Index fixture artifacts and resolved lock edges by exact package identity.
 * @param provenance Parsed fixture provenance.
 * @returns Artifact and parent-to-child indexes keyed by package@version.
 */
export function indexFixtureProvenance(provenance) {
  const artifactsByPath = new Map()
  const artifactsByIdentity = new Map()
  for (const record of provenance.artifacts ?? []) {
    if (artifactsByPath.has(record.path)) throw new Error('fixture provenance contains duplicate archive paths')
    const identity = fixturePackageIdentity(record.name, record.version)
    if (artifactsByIdentity.has(identity)) {
      throw new Error('fixture provenance contains duplicate package versions: ' + identity)
    }
    artifactsByPath.set(record.path, record)
    artifactsByIdentity.set(identity, record)
  }
  const edgesByParentArtifact = new Map()
  const edgesByParentIdentity = new Map()
  const lockEdges = new Map()
  for (const edge of provenance.parentEdges ?? []) {
    const parent = artifactsByPath.get(edge.parentArtifact)
    if (parent === undefined) throw new Error('fixture edge has unknown parent archive: ' + edge.parentArtifact)
    const parentIdentity = fixturePackageIdentity(parent.name, parent.version)
    if (edge.parent !== parentIdentity) throw new Error('fixture edge parent identity mismatch: ' + edge.parent)
    const parentEdges = edgesByParentIdentity.get(parentIdentity) ?? []
    parentEdges.push(edge)
    edgesByParentIdentity.set(parentIdentity, parentEdges)
    if (edge.status !== 'resolved') continue
    const child = artifactsByPath.get(edge.artifact)
    if (child === undefined) throw new Error('fixture edge resolves to unknown archive: ' + edge.artifact)
    const childIdentity = fixturePackageIdentity(child.name, child.version)
    if (edge.resolved !== childIdentity) throw new Error('fixture edge identity mismatch: ' + edge.parent + ' -> ' + edge.dependency)
    const key = parentIdentity + '->' + childIdentity
    const lockEdgeList = lockEdges.get(key) ?? []
    lockEdgeList.push(edge)
    lockEdges.set(key, lockEdgeList)
    const children = edgesByParentArtifact.get(edge.parentArtifact) ?? []
    children.push(edge.artifact)
    edgesByParentArtifact.set(edge.parentArtifact, children)
  }
  return { artifactsByPath, artifactsByIdentity, edgesByParentArtifact, edgesByParentIdentity, lockEdges }
}

/**
 * Validate the archive graph recorded by fixture provenance.
 * @param provenance Parsed provenance to validate.
 * @param archivePaths Archive paths present in the fixture directory.
 * @returns Nothing when the archive graph is closed and exact.
 */
export function validateFixtureClosure(provenance, archivePaths = listFixtureTarballs()) {
  const artifactRecords = provenance.artifacts ?? []
  const archiveSet = new Set(archivePaths)
  if (archiveSet.size !== archivePaths.length) throw new Error('fixture archive list contains duplicate paths')
  const expectedPaths = new Set(artifactRecords.map(record => record.path))
  const extraArchives = archivePaths.filter(path => !expectedPaths.has(path))
  const missingArchives = artifactRecords.filter(record => !archiveSet.has(record.path))
  if (extraArchives.length > 0 || missingArchives.length > 0) {
    throw new Error('fixture archive set differs from provenance: extra=' + extraArchives.join(',') + ' missing=' + missingArchives.map(record => record.path).join(','))
  }

  const graph = indexFixtureProvenance(provenance)
  const artifactByPath = graph.artifactsByPath
  const manifestByPath = new Map()
  const getManifest = path => {
    if (!manifestByPath.has(path)) manifestByPath.set(path, readFixturePackageManifest(path))
    return manifestByPath.get(path)
  }
  const nonCurrentPlatformNames = new Set((provenance.platformAliases?.nonCurrentPlatformGaps ?? []).map(record => record.name))
  for (const edge of provenance.parentEdges ?? []) {
    const manifest = getManifest(edge.parentArtifact)
    const declared = manifest[edge.kind]?.[edge.dependency]
    if (declared === undefined) throw new Error('fixture edge is not declared by parent: ' + edge.parent + ' -> ' + edge.dependency)
    if (declared !== edge.requested) throw new Error('fixture edge range differs from parent declaration: ' + edge.parent + ' -> ' + edge.dependency)
    if (edge.optional) {
      if (edge.status !== 'resolved' && edge.status !== 'platform-gap') throw new Error('optional fixture edge is unresolved without a platform gap: ' + edge.parent + ' -> ' + edge.dependency)
      if (edge.status === 'platform-gap' && !nonCurrentPlatformNames.has(edge.dependency)) throw new Error('optional fixture edge has an unrecorded platform gap: ' + edge.parent + ' -> ' + edge.dependency)
    } else if (edge.status !== 'resolved') {
      throw new Error('nonoptional fixture edge is unresolved: ' + edge.parent + ' -> ' + edge.dependency)
    }
    if (edge.status !== 'resolved') continue
    const child = artifactByPath.get(edge.artifact)
    if (edge.integrity !== child.integrity || edge.sha256 !== child.sha256) throw new Error('fixture edge digest mismatch: ' + edge.parent + ' -> ' + edge.dependency)
    if (!satisfiesFixtureRange(child.version, edge.requested)) {
      throw new Error('fixture edge resolved version does not satisfy declared range: ' + edge.parent + ' -> ' + edge.dependency + ' (' + edge.requested + ' -> ' + child.version + ')')
    }
  }

  const roots = (provenance.requiredImports ?? []).map(record => {
    const artifact = artifactByPath.get(record.artifact)
    if (artifact === undefined) throw new Error('fixture root resolves to unknown archive: ' + record.artifact)
    if (record.name !== artifact.name || record.version !== artifact.version) throw new Error('fixture root identity mismatch: ' + record.name + '@' + record.version)
    return record.artifact
  })
  const reachable = new Set(roots)
  const queue = [...roots]
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const child of graph.edgesByParentArtifact.get(queue[cursor]) ?? []) {
      if (reachable.has(child)) continue
      reachable.add(child)
      queue.push(child)
    }
  }
  const unreachable = artifactRecords.filter(record => !reachable.has(record.path))
  if (unreachable.length > 0) throw new Error('fixture provenance contains unreachable archives: ' + unreachable.map(record => record.path).join(','))
}
