import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

async function getUserFromToken(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const token = authHeader.split(' ')[1]
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

async function isAdmin(adminSupabase, userId) {
  const { data } = await adminSupabase
    .from('profiles_core')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role === 'admin'
}

function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }))
}

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    // Health check
    if ((route === '/' || route === '/health') && method === 'GET') {
      return cors(NextResponse.json({ status: 'ok', app: 'YA Core VRP' }))
    }

    // Profile ensure - creates profile if it doesn't exist
    if (route === '/profile/ensure' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const adminSupabase = createAdminSupabase()

      const { data: existing } = await adminSupabase
        .from('profiles_core')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!existing) {
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Volunteer'

        await adminSupabase.from('profiles_core').insert({
          user_id: user.id,
          full_name: fullName,
          role: 'volunteer',
          qr_code_url: user.id
        })

        await adminSupabase.from('profiles_data').insert({
          user_id: user.id
        })

        await adminSupabase.from('profiles_sensitive').insert({
          user_id: user.id
        })
      }

      return cors(NextResponse.json({ status: 'ok' }))
    }

    // Admin: Set user role
    if (route === '/admin/set-role' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const adminSupabase = createAdminSupabase()
      const admin = await isAdmin(adminSupabase, user.id)
      if (!admin) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const body = await request.json()
      const { target_user_id, role } = body

      if (!target_user_id || !['admin', 'volunteer'].includes(role)) {
        return cors(NextResponse.json({ error: 'Invalid parameters' }, { status: 400 }))
      }

      const { error } = await adminSupabase
        .from('profiles_core')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('user_id', target_user_id)

      if (error) {
        return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return cors(NextResponse.json({ status: 'ok' }))
    }

    // Admin: Issue kit via service role (bypasses RLS)
    if (route === '/admin/inventory/issue' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const adminSupabase = createAdminSupabase()
      const admin = await isAdmin(adminSupabase, user.id)
      if (!admin) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const body = await request.json()
      const { target_user_id, item_type, year } = body

      if (!target_user_id || !item_type || !year) {
        return cors(NextResponse.json({ error: 'Missing required fields' }, { status: 400 }))
      }

      // Check if already issued
      const { data: existing } = await adminSupabase
        .from('inventory_logs')
        .select('id')
        .eq('user_id', target_user_id)
        .eq('item_type', item_type)
        .eq('year', year)

      if (existing && existing.length > 0) {
        return cors(NextResponse.json({ error: 'Already issued', alreadyIssued: true }, { status: 409 }))
      }

      const { data, error } = await adminSupabase
        .from('inventory_logs')
        .insert({
          user_id: target_user_id,
          item_type: item_type,
          year: year,
          issued_by: user.id,
          issued_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return cors(NextResponse.json({ status: 'ok', data }))
    }

    // Admin: Check inventory status
    if (route === '/admin/inventory/check' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const adminSupabase = createAdminSupabase()
      const admin = await isAdmin(adminSupabase, user.id)
      if (!admin) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const body = await request.json()
      const { target_user_id, item_type, year } = body

      const { data: logs } = await adminSupabase
        .from('inventory_logs')
        .select('*')
        .eq('user_id', target_user_id)
        .eq('item_type', item_type || 'Kit')
        .eq('year', year || 2026)

      // Get volunteer info
      const { data: volunteer } = await adminSupabase
        .from('profiles_core')
        .select('full_name, role, qr_code_url')
        .eq('user_id', target_user_id)
        .single()

      const { data: volunteerData } = await adminSupabase
        .from('profiles_data')
        .select('phone, city, organization')
        .eq('user_id', target_user_id)
        .single()

      return cors(NextResponse.json({
        issued: logs && logs.length > 0,
        logs: logs || [],
        volunteer: volunteer || null,
        volunteerData: volunteerData || null
      }))
    }

    // Admin: Get all volunteers with search
    if (route === '/admin/volunteers' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const adminSupabase = createAdminSupabase()
      const admin = await isAdmin(adminSupabase, user.id)
      if (!admin) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const url = new URL(request.url)
      const search = url.searchParams.get('search') || ''
      const page = parseInt(url.searchParams.get('page') || '0')
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20')

      let query = adminSupabase
        .from('profiles_core')
        .select('*, profiles_data(phone, city, organization, status)', { count: 'exact' })
        .order('full_name')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (search) {
        query = query.ilike('full_name', `%${search}%`)
      }

      const { data, count, error } = await query

      if (error) {
        return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return cors(NextResponse.json({ data: data || [], total: count || 0 }))
    }

    // Admin: Get single volunteer full profile
    if (route.startsWith('/admin/volunteer/') && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const adminSupabase = createAdminSupabase()
      const admin = await isAdmin(adminSupabase, user.id)
      if (!admin) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const targetUserId = path[path.length - 1]

      const [coreRes, dataRes, sensitiveRes, inventoryRes] = await Promise.all([
        adminSupabase.from('profiles_core').select('*').eq('user_id', targetUserId).single(),
        adminSupabase.from('profiles_data').select('*').eq('user_id', targetUserId).single(),
        adminSupabase.from('profiles_sensitive').select('*').eq('user_id', targetUserId).single(),
        adminSupabase.from('inventory_logs').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false })
      ])

      return cors(NextResponse.json({
        core: coreRes.data,
        data: dataRes.data,
        sensitive: sensitiveRes.data,
        inventory: inventoryRes.data || []
      }))
    }

    // Admin: Update volunteer sensitive data
    if (route === '/admin/sensitive/update' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const adminSupabase = createAdminSupabase()
      const admin = await isAdmin(adminSupabase, user.id)
      if (!admin) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const body = await request.json()
      const { target_user_id, ...updateData } = body

      const { error } = await adminSupabase
        .from('profiles_sensitive')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('user_id', target_user_id)

      if (error) {
        return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return cors(NextResponse.json({ status: 'ok' }))
    }

    return cors(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))

  } catch (error) {
    console.error('API Error:', error)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
