import { eq } from 'drizzle-orm'
import { db } from '@/db/index'
import { profilesCore } from '@/db/schema'
import { parseModules } from '@/lib/parse-modules'

export { parseModules }

async function profileAccessRow(userId) {
  const rows = await db
    .select({
      role: profilesCore.role,
      accessibleModules: profilesCore.accessibleModules,
      accountStatus: profilesCore.accountStatus,
    })
    .from(profilesCore)
    .where(eq(profilesCore.userId, userId))
    .limit(1)
  return rows[0] ?? null
}

function isRoleAdmin(role) {
  const r = (role || '').toLowerCase()
  return r === 'admin'
}

export async function isAdmin(userId) {
  const row = await profileAccessRow(userId)
  if (!row || row.accountStatus === 'inactive') return false
  return isRoleAdmin(row.role)
}

export async function canAccessDirectory(userId) {
  const row = await profileAccessRow(userId)
  if (!row || row.accountStatus === 'inactive') return false
  if (isRoleAdmin(row.role)) return true
  const modules = parseModules(row)
  return modules.some((m) => m === 'directory:view' || m === 'directory_view')
}

export async function canEditVolunteerProfiles(userId) {
  const row = await profileAccessRow(userId)
  if (!row || row.accountStatus === 'inactive') return false
  if (isRoleAdmin(row.role)) return true
  const modules = parseModules(row)
  return (
    Array.isArray(modules) &&
    (modules.includes('profile_edit') ||
      modules.includes('directory:edit') ||
      modules.includes('directory_edit'))
  )
}

export async function canManageStock(userId) {
  const row = await profileAccessRow(userId)
  if (!row || row.accountStatus === 'inactive') return false
  if (isRoleAdmin(row.role)) return true
  const modules = parseModules(row)
  return (
    Array.isArray(modules) &&
    (modules.includes('stock_manage') || modules.includes('stock:manage'))
  )
}

export async function canAccessStock(userId) {
  const row = await profileAccessRow(userId)
  if (!row || row.accountStatus === 'inactive') return false
  if (isRoleAdmin(row.role)) return true
  const modules = parseModules(row)
  if (!Array.isArray(modules)) return false
  return modules.some((m) =>
    ['stock:issue', 'stock:manage', 'stock_issue', 'stock_manage'].includes(m)
  )
}
