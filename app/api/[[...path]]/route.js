import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getUserFromToken(request) {
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

    // =============================================
    // PROFILE: Ensure profile exists + return it
    // =============================================
    if (route === '/profile/ensure' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const adminSupabase = createAdminSupabase()
      let { data: existing } = await adminSupabase
        .from('profiles_core')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!existing) {
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Volunteer'
        const { data: newProfile } = await adminSupabase.from('profiles_core').insert({
          user_id: user.id, full_name: fullName, first_name: fullName,
          role: 'volunteer', qr_code_url: user.id
        }).select().single()
        await adminSupabase.from('profiles_data').insert({ user_id: user.id, email_id: user.email || '' })
        await adminSupabase.from('profiles_sensitive').insert({ user_id: user.id })
        existing = newProfile
      }
      return cors(NextResponse.json({ status: 'ok', profile: existing }))
    }

    // =============================================
    // PROFILE: Get my profile (bypasses RLS)
    // =============================================
    if (route === '/profile/me' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const adminSupabase = createAdminSupabase()
      const [coreRes, dataRes] = await Promise.all([
        adminSupabase.from('profiles_core').select('*').eq('user_id', user.id).single(),
        adminSupabase.from('profiles_data').select('*').eq('user_id', user.id).single()
      ])

      if (!coreRes.data) {
        return cors(NextResponse.json({ error: 'Profile not found' }, { status: 404 }))
      }

      return cors(NextResponse.json({ core: coreRes.data, data: dataRes.data }))
    }

    // =============================================
    // ADMIN: Set user role
    // =============================================
    if (route === '/admin/set-role' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const { target_user_id, role } = await request.json()
      if (!target_user_id || !['admin', 'volunteer'].includes(role)) {
        return cors(NextResponse.json({ error: 'Invalid parameters' }, { status: 400 }))
      }

      const { error } = await adminSupabase
        .from('profiles_core')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('user_id', target_user_id)

      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      return cors(NextResponse.json({ status: 'ok' }))
    }

    // =============================================
    // ADMIN: Get all volunteers (paginated + search)
    // =============================================
    if (route === '/admin/volunteers' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const url = new URL(request.url)
      const search = url.searchParams.get('search') || ''
      const page = parseInt(url.searchParams.get('page') || '0')
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20')

      let query = adminSupabase
        .from('profiles_core')
        .select('*, profiles_data(contact_number, city_town_village, sewa_center, active_status, ya_id_remarks)', { count: 'exact' })
        .order('full_name')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,ya_id.ilike.%${search}%`)
      }

      const { data, count, error } = await query
      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      return cors(NextResponse.json({ data: data || [], total: count || 0 }))
    }

    // =============================================
    // ADMIN: Get single volunteer full profile
    // =============================================
    if (route.startsWith('/admin/volunteer/') && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const targetUserId = path[path.length - 1]
      const [coreRes, dataRes, sensitiveRes, inventoryRes] = await Promise.all([
        adminSupabase.from('profiles_core').select('*').eq('user_id', targetUserId).single(),
        adminSupabase.from('profiles_data').select('*').eq('user_id', targetUserId).single(),
        adminSupabase.from('profiles_sensitive').select('*').eq('user_id', targetUserId).single(),
        adminSupabase.from('inventory_logs').select('*, stock_items(name, category)').eq('user_id', targetUserId).order('created_at', { ascending: false })
      ])

      return cors(NextResponse.json({
        core: coreRes.data,
        data: dataRes.data,
        sensitive: sensitiveRes.data,
        inventory: inventoryRes.data || []
      }))
    }

    // =============================================
    // ADMIN: Update sensitive data
    // =============================================
    if (route === '/admin/sensitive/update' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const body = await request.json()
      const { target_user_id, ...updateData } = body
      const { error } = await adminSupabase
        .from('profiles_sensitive')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('user_id', target_user_id)

      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      return cors(NextResponse.json({ status: 'ok' }))
    }

    // =============================================
    // STOCK: List all stock items
    // =============================================
    if (route === '/admin/stock' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const { data, error } = await adminSupabase
        .from('stock_items')
        .select('*')
        .order('category')
        .order('name')

      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      return cors(NextResponse.json({ data: data || [] }))
    }

    // =============================================
    // STOCK: Add stock item
    // =============================================
    if (route === '/admin/stock' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const body = await request.json()
      const { name, category, description, total_quantity, unit, min_stock_level } = body

      if (!name) return cors(NextResponse.json({ error: 'Name required' }, { status: 400 }))

      const { data, error } = await adminSupabase.from('stock_items').insert({
        name,
        category: category || 'General',
        description: description || '',
        total_quantity: total_quantity || 0,
        issued_quantity: 0,
        unit: unit || 'pcs',
        min_stock_level: min_stock_level || 0
      }).select().single()

      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      return cors(NextResponse.json({ data }))
    }

    // =============================================
    // STOCK: Update stock item
    // =============================================
    if (route === '/admin/stock/update' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const body = await request.json()
      const { id, ...updateData } = body
      if (!id) return cors(NextResponse.json({ error: 'ID required' }, { status: 400 }))

      const { error } = await adminSupabase
        .from('stock_items')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      return cors(NextResponse.json({ status: 'ok' }))
    }

    // =============================================
    // STOCK: Delete stock item
    // =============================================
    if (route === '/admin/stock/delete' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const { id } = await request.json()
      if (!id) return cors(NextResponse.json({ error: 'ID required' }, { status: 400 }))

      const { error } = await adminSupabase.from('stock_items').delete().eq('id', id)
      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      return cors(NextResponse.json({ status: 'ok' }))
    }

    // =============================================
    // STOCK: Issue stock to volunteer
    // =============================================
    if (route === '/admin/stock/issue' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const { target_user_id, stock_item_id, quantity, notes, year } = await request.json()
      if (!target_user_id || !stock_item_id || !quantity) {
        return cors(NextResponse.json({ error: 'Missing required fields' }, { status: 400 }))
      }

      // Check stock availability
      const { data: item } = await adminSupabase
        .from('stock_items')
        .select('*')
        .eq('id', stock_item_id)
        .single()

      if (!item) return cors(NextResponse.json({ error: 'Item not found' }, { status: 404 }))

      const available = item.total_quantity - item.issued_quantity
      if (available < quantity) {
        return cors(NextResponse.json({ error: `Insufficient stock. Available: ${available}` }, { status: 400 }))
      }

      // Create issuance log
      const { data: log, error: logError } = await adminSupabase
        .from('inventory_logs')
        .insert({
          user_id: target_user_id,
          stock_item_id,
          item_name: item.name,
          quantity,
          year: year || new Date().getFullYear(),
          issued_by: user.id,
          issued_at: new Date().toISOString(),
          notes: notes || ''
        })
        .select()
        .single()

      if (logError) return cors(NextResponse.json({ error: logError.message }, { status: 500 }))

      // Update issued quantity
      const { error: updateError } = await adminSupabase
        .from('stock_items')
        .update({
          issued_quantity: item.issued_quantity + quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', stock_item_id)

      if (updateError) console.error('Failed to update issued qty:', updateError)

      return cors(NextResponse.json({ status: 'ok', data: log }))
    }

    // =============================================
    // STOCK: Issuance history
    // =============================================
    if (route === '/admin/stock/history' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const url = new URL(request.url)
      const page = parseInt(url.searchParams.get('page') || '0')
      const pageSize = parseInt(url.searchParams.get('pageSize') || '30')
      const search = url.searchParams.get('search') || ''

      // Get logs with volunteer info joined
      let query = adminSupabase
        .from('inventory_logs')
        .select('*, stock_items(name, category), profiles_core!inventory_logs_user_id_fkey(full_name, ya_id)', { count: 'exact' })
        .order('issued_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (search) {
        query = query.ilike('item_name', `%${search}%`)
      }

      const { data, count, error } = await query
      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      return cors(NextResponse.json({ data: data || [], total: count || 0 }))
    }

    // =============================================
    // STOCK: Search volunteers for issuance
    // =============================================
    if (route === '/admin/stock/search-volunteers' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const url = new URL(request.url)
      const search = url.searchParams.get('q') || ''

      if (!search || search.length < 2) {
        return cors(NextResponse.json({ data: [] }))
      }

      const { data, error } = await adminSupabase
        .from('profiles_core')
        .select('user_id, full_name, ya_id, role')
        .or(`full_name.ilike.%${search}%,ya_id.ilike.%${search}%`)
        .limit(10)

      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      return cors(NextResponse.json({ data: data || [] }))
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
