import { createClient } from '@supabase/supabase-js'

export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function getUserFromToken(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function isAdmin(adminSupabase, userId) {
  const { data } = await adminSupabase
    .from('profiles_core')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role === 'admin'
}

/** True if user can view/edit volunteer profiles: admin OR accessible_modules includes 'profile_edit' */
export async function canEditVolunteerProfiles(adminSupabase, userId) {
  const { data } = await adminSupabase
    .from('profiles_core')
    .select('role, accessible_modules')
    .eq('user_id', userId)
    .single()
  if (!data) return false
  if (data.role === 'admin') return true
  const modules = data.accessible_modules || []
  return Array.isArray(modules) && modules.includes('profile_edit')
}

/** True if user can manage stock (undo, add stock): admin OR accessible_modules includes 'stock_manage' */
export async function canManageStock(adminSupabase, userId) {
  const { data } = await adminSupabase
    .from('profiles_core')
    .select('role, accessible_modules')
    .eq('user_id', userId)
    .single()
  if (!data) return false
  if (data.role === 'admin') return true
  const modules = data.accessible_modules || []
  return Array.isArray(modules) && modules.includes('stock_manage')
}
