import { auth, currentUser } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db/index'
import { profilesCore } from '@/db/schema'
import { parseModules } from '@/lib/parse-modules'

/**
 * Clerk session + profiles_core row (role, modules) from Neon via Drizzle.
 * @returns {Promise<{
 *   userId: string,
 *   email: string,
 *   fullName: string,
 *   role: string | null,
 *   accessibleModules: string[],
 *   accountStatus: string | null,
 *   profileCore: object | null
 * } | null>}
 */
export async function getRequestAuth() {
  const { userId } = await auth()
  if (!userId) return null

  const u = await currentUser()
  const email = u?.primaryEmailAddress?.emailAddress ?? ''
  const fullName =
    u?.fullName?.trim() ||
    `${u?.firstName || ''} ${u?.lastName || ''}`.trim() ||
    email.split('@')[0] ||
    'Volunteer'

  let profileCore = null
  let role = null
  let accessibleModules = []
  let accountStatus = null

  try {
    const rows = await db.select().from(profilesCore).where(eq(profilesCore.userId, userId)).limit(1)
    profileCore = rows[0] ?? null
    if (profileCore) {
      role = profileCore.role ?? null
      accountStatus = profileCore.accountStatus ?? null
      accessibleModules = parseModules(profileCore)
    }
  } catch (e) {
    console.warn('[getRequestAuth] profiles_core lookup failed:', e)
  }

  return {
    userId,
    email,
    fullName,
    role,
    accessibleModules,
    accountStatus,
    profileCore,
  }
}
