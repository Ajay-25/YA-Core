import { NextResponse } from 'next/server'
import { createAdminSupabase, getUserFromToken, isAdmin } from '@/lib/api-auth'

function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

export async function GET(request) {
  const user = await getUserFromToken(request)
  if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const adminSupabase = createAdminSupabase()
  const admin = await isAdmin(adminSupabase, user.id)
  if (!admin) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'staff'

  try {
    if (type === 'search') {
      const q = (searchParams.get('q') || '').trim()
      if (!q || q.length < 2) {
        return cors(NextResponse.json({ data: [] }))
      }

      const { data, error } = await adminSupabase
        .from('profiles_core')
        .select('id, user_id, full_name, ya_id, photo_url, role, accessible_modules')
        .or(`full_name.ilike.%${q}%,ya_id.ilike.%${q}%`)
        .order('full_name')
        .limit(20)

      if (error) {
        return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return cors(NextResponse.json({ data: data ?? [] }))
    }

    // Default: active staff only (non-volunteer)
    const { data, error } = await adminSupabase
      .from('profiles_core')
      .select('id, user_id, full_name, ya_id, photo_url, role, accessible_modules')
      .neq('role', 'volunteer')
      .order('full_name')

    if (error) {
      return cors(NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return cors(NextResponse.json({ data: data ?? [] }))
  } catch (err) {
    console.error('Access list error:', err)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function POST(request) {
  const user = await getUserFromToken(request)
  if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const adminSupabase = createAdminSupabase()
  const admin = await isAdmin(adminSupabase, user.id)
  if (!admin) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

  try {
    const { target_user_id, role, accessible_modules } = await request.json()

    if (!target_user_id) {
      return cors(NextResponse.json({ error: 'target_user_id is required' }, { status: 400 }))
    }

    const validRoles = ['admin', 'operations_manager', 'desk_moderator', 'attendance_scanner', 'custom', 'volunteer']
    if (role && !validRoles.includes(role)) {
      return cors(NextResponse.json({ error: 'Invalid role' }, { status: 400 }))
    }

    const updatePayload = {}
    if (role) updatePayload.role = role
    if (Array.isArray(accessible_modules)) updatePayload.accessible_modules = accessible_modules

    if (Object.keys(updatePayload).length === 0) {
      return cors(NextResponse.json({ error: 'Nothing to update' }, { status: 400 }))
    }

    const { error } = await adminSupabase
      .from('profiles_core')
      .update(updatePayload)
      .eq('user_id', target_user_id)

    if (error) {
      return cors(NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return cors(NextResponse.json({ success: true }))
  } catch (err) {
    console.error('Access update error:', err)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
