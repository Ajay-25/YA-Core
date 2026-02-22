/**
 * Granular RBAC permission system for YA-Core.
 *
 * Permission strings use "resource:action" format.
 * Role presets map to a fixed set of permissions.
 * Admin role implicitly has ALL permissions.
 */

export const PERMISSIONS = {
  STOCK_MANAGE: 'stock:manage',
  STOCK_ISSUE: 'stock:issue',
  DIRECTORY_VIEW: 'directory:view',
  DIRECTORY_EDIT: 'directory:edit',
  ATTENDANCE_MARK: 'attendance:mark',
  ATTENDANCE_LOG_VIEW: 'attendance_log:view',
  ATTENDANCE_LOG_MANAGE: 'attendance_log:manage',
  SYSTEM_MANAGE_ACCESS: 'system:manage_access',
}

export const ROLE_PRESETS = {
  admin: Object.values(PERMISSIONS),
  operations_manager: [
    PERMISSIONS.STOCK_MANAGE,
    PERMISSIONS.STOCK_ISSUE,
    PERMISSIONS.DIRECTORY_EDIT,
    PERMISSIONS.DIRECTORY_VIEW,
    PERMISSIONS.ATTENDANCE_LOG_MANAGE,
    PERMISSIONS.ATTENDANCE_LOG_VIEW,
    PERMISSIONS.ATTENDANCE_MARK,
  ],
  desk_moderator: [
    PERMISSIONS.STOCK_ISSUE,
    PERMISSIONS.DIRECTORY_VIEW,
    PERMISSIONS.ATTENDANCE_MARK,
  ],
  attendance_scanner: [PERMISSIONS.ATTENDANCE_MARK],
  custom: [],
  volunteer: [],
}

/**
 * Route → required permission(s) mapping.
 * A user needs at least ONE of the listed permissions to access the route.
 */
export const ROUTE_PERMISSIONS = {
  '/dashboard/admin': [PERMISSIONS.SYSTEM_MANAGE_ACCESS],
  '/dashboard/volunteers': [PERMISSIONS.DIRECTORY_VIEW],
  '/dashboard/stock': [PERMISSIONS.STOCK_ISSUE, PERMISSIONS.STOCK_MANAGE],
  '/dashboard/attendance': [PERMISSIONS.ATTENDANCE_MARK],
}

/**
 * Check if a user has a specific permission.
 * Admin role implicitly passes every check.
 *
 * @param {{ role?: string, accessibleModules?: string[] }} user
 * @param {string} permission - e.g. 'stock:manage'
 * @returns {boolean}
 */
export function hasPermission(user, permission) {
  if (!user) return false
  if (user.role === 'admin') return true
  const modules = user.accessibleModules ?? user.accessible_modules ?? []
  return Array.isArray(modules) && modules.includes(permission)
}

/**
 * Check if a user has ANY of the given permissions.
 * @param {{ role?: string, accessibleModules?: string[] }} user
 * @param {string[]} permissions
 * @returns {boolean}
 */
export function hasAnyPermission(user, permissions) {
  if (!user) return false
  if (user.role === 'admin') return true
  return permissions.some((p) => hasPermission(user, p))
}

/**
 * Check if the current user can access a given dashboard path.
 * Returns true if no restriction is defined for the path (e.g. /dashboard/profile).
 *
 * @param {{ role?: string, accessibleModules?: string[] }} user
 * @param {string} pathname
 * @returns {boolean}
 */
export function canAccessRoute(user, pathname) {
  if (!user) return false
  if (user.role === 'admin') return true

  for (const [routePrefix, requiredPerms] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname === routePrefix || pathname.startsWith(routePrefix + '/')) {
      return hasAnyPermission(user, requiredPerms)
    }
  }
  return true
}
