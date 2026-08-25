/** Resolve package conditions in manifest key order, as Node does. */
export function conditionalTarget(exportsMap, key, conditions = ['node', 'import']) {
  const resolve = (value) => {
    if (typeof value === 'string') return value
    if (value === null || typeof value !== 'object') return undefined
    for (const [condition, target] of Object.entries(value)) {
      if (condition !== 'default' && !conditions.includes(condition)) continue
      const resolved = resolve(target)
      if (resolved !== undefined) return resolved
    }
    return undefined
  }
  const target = resolve(exportsMap?.[key])
  if (target === undefined) throw new Error('packed manifest has no runtime target for ' + key)
  return target
}
