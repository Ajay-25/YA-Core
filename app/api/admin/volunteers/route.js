import { NextResponse } from 'next/server'
import { createAdminSupabase, getUserFromToken, canEditVolunteerProfiles } from '@/lib/api-auth'

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
  const canAccess = await canEditVolunteerProfiles(adminSupabase, user.id)
  if (!canAccess) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

  const { searchParams } = new URL(request.url)
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))

  const from = page * pageSize
  const to = from + pageSize - 1

  try {
    let query = adminSupabase
      .from('profiles_core')
      .select('*, profiles_data(*), profiles_sensitive(*)', { count: 'exact' })
      .order('full_name')
      .range(from, to)

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,ya_id.ilike.%${search}%`)
    }

    const { data, count, error } = await query

    if (error) {
      return cors(NextResponse.json({ error: error.message }, { status: 500 }))
    }

    return cors(NextResponse.json({ data: data ?? [], total: count ?? 0 }))
  } catch (err) {
    console.error('Volunteers list error:', err)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
