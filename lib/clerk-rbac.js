import { PERMISSIONS } from '@/lib/permissions'

/** All permission strings — use in DB `accessible_modules` or Clerk `publicMetadata.accessible_modules` for non-admin “full” access. */
export const ALL_PERMISSION_STRINGS = Object.values(PERMISSIONS)

/**
 * Read role + module list from Clerk JWT session claims and/or public metadata.
 * Customize the session token in Clerk Dashboard so these appear on sessionClaims (see project docs / README).
 *
 * Supported shapes (first match wins):
 * - sessionClaims.role, sessionClaims.accessible_modules
 * - sessionClaims.metadata.role, sessionClaims.metadata.accessible_modules
 * - publicMetadata.role, publicMetadata.accessible_modules
 */
export function readRbacFromClerk(sessionClaims, publicMetadata) {
  const pm =
    publicMetadata && typeof publicMetadata === 'object' && !Array.isArray(publicMetadata)
      ? publicMetadata
      : {}
  const sc =
    sessionClaims && typeof sessionClaims === 'object' && !Array.isArray(sessionClaims)
      ? sessionClaims
      : {}

  const meta = sc.metadata && typeof sc.metadata === 'object' ? sc.metadata : {}

  const roleRaw = sc.role ?? meta.role ?? pm.role
  const modulesRaw = sc.accessible_modules ?? meta.accessible_modules ?? pm.accessible_modules

  if (roleRaw == null && modulesRaw == null) return null

  const role = roleRaw != null ? String(roleRaw).toLowerCase() : 'volunteer'

  let accessibleModules = []
  if (Array.isArray(modulesRaw)) {
    accessibleModules = modulesRaw.map(String)
  } else if (typeof modulesRaw === 'string') {
    try {
      const parsed = JSON.parse(modulesRaw)
      accessibleModules = Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      accessibleModules = []
    }
  }

  return { role, accessibleModules }
}
