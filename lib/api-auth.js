import { createClient } from '@supabase/supabase-js'

export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** Extract Bearer token from request (for API routes). */
export function getAccessTokenFromRequest(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim() || null
}

export async function getUserFromToken(request) {
  const token = getAccessTokenFromRequest(request)
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

/**
 * Create a Supabase client that sends the user's JWT on every request.
 * Use for permission checks so the request runs in the user's context (e.g. RLS).
 */
export function createServerSupabaseClient(accessToken) {
  if (!accessToken) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}

export async function isAdmin(adminSupabase, userId) {
  const { data } = await adminSupabase
    .from('profiles_core')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role === 'admin'
}

/**
 * True if user can access volunteer directory (list, view): admin OR accessible_modules
 * includes 'directory:view' (or legacy 'directory_view').
 */
export async function canAccessDirectory(adminSupabase, userId) {
  const { data } = await adminSupabase
    .from('profiles_core')
    .select('role, accessible_modules')
    .eq('user_id', userId)
    .single()
  if (!data) return false
  if (data.role === 'admin') return true
  const modules = data.accessible_modules || []
  if (!Array.isArray(modules)) return false
  return modules.some((m) => m === 'directory:view' || m === 'directory_view')
}

/** True if user can view/edit volunteer profiles: admin OR accessible_modules includes 'directory:edit' or 'profile_edit' */
export async function canEditVolunteerProfiles(adminSupabase, userId) {
  const { data } = await adminSupabase
    .from('profiles_core')
    .select('role, accessible_modules')
    .eq('user_id', userId)
    .single()
  if (!data) return false
  if (data.role === 'admin') return true
  const modules = data.accessible_modules || []
  return Array.isArray(modules) && (
    modules.includes('profile_edit') ||
    modules.includes('directory:edit') ||
    modules.includes('directory_edit')
  )
}

/** True if user can manage stock (undo, add stock): admin OR accessible_modules includes 'stock_manage' or 'stock:manage' */
export async function canManageStock(adminSupabase, userId) {
  const { data } = await adminSupabase
    .from('profiles_core')
    .select('role, accessible_modules')
    .eq('user_id', userId)
    .single()
  if (!data) return false
  if (data.role === 'admin') return true
  const modules = data.accessible_modules || []
  return Array.isArray(modules) && (modules.includes('stock_manage') || modules.includes('stock:manage'))
}

/**
 * True if user can access stock (list items, list logs, issue): admin OR accessible_modules
 * includes 'stock:issue' or 'stock:manage' (or legacy 'stock_issue' / 'stock_manage').
 */
export async function canAccessStock(adminSupabase, userId) {
  const { data } = await adminSupabase
    .from('profiles_core')
    .select('role, accessible_modules')
    .eq('user_id', userId)
    .single()
  if (!data) return false
  if (data.role === 'admin') return true
  const modules = data.accessible_modules || []
  if (!Array.isArray(modules)) return false
  const hasStockPermission = modules.some((m) =>
    ['stock:issue', 'stock:manage', 'stock_issue', 'stock_manage'].includes(m)
  )
  return hasStockPermission
}
