/** Normalize profiles_core.accessible_modules (jsonb / JSON string / array). */
export function parseModules(row) {
  if (!row?.accessibleModules && !row?.accessible_modules) return []
  const m = row.accessibleModules ?? row.accessible_modules
  if (Array.isArray(m)) return m
  if (typeof m === 'string') {
    try {
      const p = JSON.parse(m)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}
