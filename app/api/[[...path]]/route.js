import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { canEditVolunteerProfiles, canManageStock } from '@/lib/api-auth'

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
    // PROFILE: Update my profile (bypasses RLS)
    // =============================================
    if (route === '/profile/update' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const adminSupabase = createAdminSupabase()
      const body = await request.json()
      const { core: coreUpdate, data: dataUpdate } = body

      const promises = []
      if (coreUpdate) {
        promises.push(
          adminSupabase.from('profiles_core')
            .update({ ...coreUpdate, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
        )
      }
      if (dataUpdate) {
        // Remove any non-data fields that might leak in
        const { id, user_id, created_at, updated_at, ...cleanData } = dataUpdate
        promises.push(
          adminSupabase.from('profiles_data')
            .update({ ...cleanData, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
        )
      }

      await Promise.all(promises)
      return cors(NextResponse.json({ status: 'ok' }))
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
      const coreRes = await adminSupabase.from('profiles_core').select('*').eq('user_id', targetUserId).single()
      if (!coreRes.data) {
        return cors(NextResponse.json({ error: 'Profile not found' }, { status: 404 }))
      }
      const profileId = coreRes.data.id
      const [dataRes, sensitiveRes, inventoryRes] = await Promise.all([
        adminSupabase.from('profiles_data').select('*').eq('user_id', targetUserId).single(),
        adminSupabase.from('profiles_sensitive').select('*').eq('user_id', targetUserId).single(),
        adminSupabase.from('inventory_logs').select('*, inventory_items(item_name, variant)').eq('volunteer_id', profileId).order('created_at', { ascending: false })
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
    // ADMIN: Update volunteer profile (core + data)
    // =============================================
    if (route === '/admin/volunteer-update' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await canEditVolunteerProfiles(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const { target_user_id, core: coreUpdate, data: dataUpdate } = await request.json()
      if (!target_user_id) return cors(NextResponse.json({ error: 'target_user_id required' }, { status: 400 }))

      const promises = []
      if (coreUpdate) {
        promises.push(
          adminSupabase.from('profiles_core')
            .update({ ...coreUpdate, updated_at: new Date().toISOString() })
            .eq('user_id', target_user_id)
        )
      }
      if (dataUpdate) {
        const { id, user_id, created_at, updated_at, ...cleanData } = dataUpdate
        promises.push(
          adminSupabase.from('profiles_data')
            .update({ ...cleanData, updated_at: new Date().toISOString() })
            .eq('user_id', target_user_id)
        )
      }

      await Promise.all(promises)
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

    // =============================================
    // INVENTORY (POS): List inventory_items
    // =============================================
    if (route === '/admin/inventory/items' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const { data, error } = await adminSupabase
        .from('inventory_items')
        .select('*')
        .order('item_name')

      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      return cors(NextResponse.json({ data: data || [] }))
    }

    // =============================================
    // INVENTORY (POS): Search volunteers by Phone / YA ID
    // =============================================
    if (route === '/admin/inventory/volunteers/search' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const url = new URL(request.url)
      const q = (url.searchParams.get('q') || '').trim()

      if (!q || q.length < 1) {
        return cors(NextResponse.json({ data: [] }))
      }

      const byYaId = await adminSupabase
        .from('profiles_core')
        .select('user_id, full_name, ya_id')
        .ilike('ya_id', `%${q}%`)
        .limit(10)

      const byPhone = await adminSupabase
        .from('profiles_data')
        .select('user_id')
        .ilike('contact_number', `%${q}%`)
        .limit(10)

      const yaIdUserIds = (byYaId.data || []).map((r) => r.user_id)
      const phoneUserIds = (byPhone.data || []).map((r) => r.user_id)
      const allUserIds = [...new Set([...yaIdUserIds, ...phoneUserIds])].slice(0, 10)

      if (allUserIds.length === 0) {
        return cors(NextResponse.json({ data: [] }))
      }

      const { data: cores } = await adminSupabase
        .from('profiles_core')
        .select('id, user_id, full_name, ya_id')
        .in('user_id', allUserIds)

      const { data: dataRows } = await adminSupabase
        .from('profiles_data')
        .select('user_id, contact_number, email_id, age, gender, sewa_center, sewa_zone')
        .in('user_id', allUserIds)

      const dataByUserId = (dataRows || []).reduce((acc, r) => { acc[r.user_id] = r; return acc }, {})
      const merged = (cores || []).map((c) => {
        const data = dataByUserId[c.user_id]
        return {
          id: c.id,
          user_id: c.user_id,
          full_name: c.full_name,
          ya_id: c.ya_id,
          phone: data?.contact_number || '',
          email: data?.email_id || '',
          age: data?.age != null ? data.age : null,
          gender: data?.gender || '',
          sewa_center: data?.sewa_center || '',
          sewa_zone: data?.sewa_zone || '',
        }
      })
      return cors(NextResponse.json({ data: merged }))
    }

    // =============================================
    // INVENTORY (POS): Check volunteer's issued logs (for warning badge)
    // =============================================
    if (path[0] === 'admin' && path[1] === 'inventory' && path[2] === 'volunteers' && path[4] === 'logs' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const volunteerParam = path[3]
      const { data: profileRow } = await adminSupabase
        .from('profiles_core')
        .select('id')
        .or(`id.eq.${volunteerParam},user_id.eq.${volunteerParam}`)
        .limit(1)
        .maybeSingle()
      const volunteerProfileId = profileRow?.id
      if (!volunteerProfileId) {
        return cors(NextResponse.json({ data: [], hasIssued: false }))
      }
      const { data, error } = await adminSupabase
        .from('inventory_logs')
        .select('id, status')
        .eq('volunteer_id', volunteerProfileId)
        .eq('status', 'issued')

      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      return cors(NextResponse.json({ data: data || [], hasIssued: (data || []).length > 0 }))
    }

    // =============================================
    // INVENTORY (POS): Volunteer issuance history (full list for Sheet)
    // =============================================
    if (path[0] === 'admin' && path[1] === 'inventory' && path[2] === 'volunteers' && path[4] === 'history' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const volunteerParam = path[3]
      const { data: profileRow } = await adminSupabase
        .from('profiles_core')
        .select('id')
        .or(`id.eq.${volunteerParam},user_id.eq.${volunteerParam}`)
        .limit(1)
        .maybeSingle()
      const volunteerProfileId = profileRow?.id
      if (!volunteerProfileId) {
        return cors(NextResponse.json({ data: [] }))
      }
      const { data: logs, error } = await adminSupabase
        .from('inventory_logs')
        .select('id, item_id, quantity_issued, amount_due, status, created_at')
        .eq('volunteer_id', volunteerProfileId)
        .order('created_at', { ascending: false })

      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      const list = logs || []
      const itemIds = [...new Set(list.map((l) => l.item_id).filter(Boolean))]
      const { data: items } = itemIds.length
        ? await adminSupabase.from('inventory_items').select('id, item_name, variant').in('id', itemIds)
        : { data: [] }
      const itemsById = (items || []).reduce((acc, i) => { acc[i.id] = i; return acc }, {})
      const data = list.map((log) => ({
        ...log,
        item_name: itemsById[log.item_id]?.item_name || '—',
        variant: itemsById[log.item_id]?.variant || '',
      }))
      return cors(NextResponse.json({ data }))
    }

    // =============================================
    // INVENTORY (POS): Issue item – insert log + decrement stock
    // =============================================
    if (route === '/admin/inventory/issue' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const body = await request.json()
      const { volunteer_id, item_id, quantity_issued, payment_method } = body

      if (!volunteer_id || !item_id || quantity_issued == null || quantity_issued <= 0) {
        return cors(NextResponse.json({ error: 'Missing or invalid volunteer_id, item_id, or quantity_issued' }, { status: 400 }))
      }

      const validPayment = ['cash', 'upi', 'waived', 'pending'].includes(payment_method)
      if (!validPayment) {
        return cors(NextResponse.json({ error: 'Invalid payment_method' }, { status: 400 }))
      }

      // Resolve volunteer_id to profiles_core.id (payload may be user_id or profiles_core.id)
      const { data: volunteerRow, error: volunteerErr } = await adminSupabase
        .from('profiles_core')
        .select('id')
        .or(`id.eq.${volunteer_id},user_id.eq.${volunteer_id}`)
        .limit(1)
        .maybeSingle()
      if (volunteerErr || !volunteerRow) {
        return cors(NextResponse.json({ error: 'Volunteer not found in profiles' }, { status: 404 }))
      }
      const volunteerProfileId = volunteerRow.id

      // Resolve issuer: issued_by must be profiles_core.id (session has auth user id only)
      const { data: issuerRow, error: issuerErr } = await adminSupabase
        .from('profiles_core')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (issuerErr || !issuerRow) {
        return cors(NextResponse.json({ error: 'Issuer profile not found in profiles_core' }, { status: 403 }))
      }
      const issuedByProfileId = issuerRow.id

      const { data: item, error: itemError } = await adminSupabase
        .from('inventory_items')
        .select('*')
        .eq('id', item_id)
        .single()

      if (itemError || !item) return cors(NextResponse.json({ error: 'Item not found' }, { status: 404 }))

      const currentQty = Number(item.current_quantity) || 0
      const qty = Number(quantity_issued)
      if (currentQty < qty) {
        return cors(NextResponse.json({ error: `Insufficient stock. Available: ${currentQty}` }, { status: 400 }))
      }

      const unitPrice = Number(item.unit_price) || 0
      const amount_due = Math.round(qty * unitPrice * 100) / 100

      const { data: log, error: logError } = await adminSupabase
        .from('inventory_logs')
        .insert({
          volunteer_id: volunteerProfileId,
          item_id,
          issued_by: issuedByProfileId,
          status: 'issued',
          quantity_issued: qty,
          amount_due,
          payment_method,
        })
        .select()
        .single()

      if (logError) return cors(NextResponse.json({ error: logError.message }, { status: 500 }))

      const { error: updateError } = await adminSupabase
        .from('inventory_items')
        .update({ current_quantity: currentQty - qty })
        .eq('id', item_id)

      if (updateError) {
        return cors(NextResponse.json({ error: 'Failed to update stock: ' + updateError.message }, { status: 500 }))
      }

      return cors(NextResponse.json({ status: 'ok', data: log }))
    }

    // =============================================
    // INVENTORY: Recent issuance logs (for Warehouse tab)
    // =============================================
    if (route === '/admin/inventory/logs' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const url = new URL(request.url)
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)

      const { data: logs, error } = await adminSupabase
        .from('inventory_logs')
        .select('id, volunteer_id, item_id, quantity_issued, amount_due, payment_method, status, created_at')
        .eq('status', 'issued')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))

      const list = logs || []
      const itemIds = [...new Set(list.map((l) => l.item_id).filter(Boolean))]
      const volunteerIds = [...new Set(list.map((l) => l.volunteer_id).filter(Boolean))]

      const [itemsRes, volunteersRes] = await Promise.all([
        itemIds.length ? adminSupabase.from('inventory_items').select('id, item_name, variant, unit_type').in('id', itemIds) : { data: [] },
        volunteerIds.length ? adminSupabase.from('profiles_core').select('id, user_id, full_name, ya_id').in('id', volunteerIds) : { data: [] },
      ])

      const itemsById = (itemsRes.data || []).reduce((acc, i) => { acc[i.id] = i; return acc }, {})
      const volunteersById = (volunteersRes.data || []).reduce((acc, v) => { acc[v.id] = v; return acc }, {})

      const data = list.map((log) => ({
        ...log,
        inventory_items: itemsById[log.item_id] || null,
        profiles_core: volunteersById[log.volunteer_id] || null,
      }))

      return cors(NextResponse.json({ data }))
    }

    // =============================================
    // INVENTORY: Undo issuance – set status undone + restore quantity
    // =============================================
    if (route === '/admin/inventory/undo' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await canManageStock(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const body = await request.json()
      const { log_id } = body
      if (!log_id) return cors(NextResponse.json({ error: 'log_id required' }, { status: 400 }))

      const { data: log, error: logFetchError } = await adminSupabase
        .from('inventory_logs')
        .select('id, item_id, quantity_issued, status')
        .eq('id', log_id)
        .single()

      if (logFetchError || !log) return cors(NextResponse.json({ error: 'Log not found' }, { status: 404 }))
      if (log.status !== 'issued') return cors(NextResponse.json({ error: 'Log already undone' }, { status: 400 }))

      const { error: updateLogError } = await adminSupabase
        .from('inventory_logs')
        .update({ status: 'undone' })
        .eq('id', log_id)

      if (updateLogError) return cors(NextResponse.json({ error: updateLogError.message }, { status: 500 }))

      const { data: item } = await adminSupabase
        .from('inventory_items')
        .select('current_quantity')
        .eq('id', log.item_id)
        .single()

      const currentQty = Number(item?.current_quantity) || 0
      const { error: incError } = await adminSupabase
        .from('inventory_items')
        .update({ current_quantity: currentQty + Number(log.quantity_issued) })
        .eq('id', log.item_id)

      if (incError) return cors(NextResponse.json({ error: 'Failed to restore stock: ' + incError.message }, { status: 500 }))

      return cors(NextResponse.json({ status: 'ok' }))
    }

    // =============================================
    // INVENTORY: Add stock (warehouse) + audit log
    // =============================================
    if (route === '/admin/inventory/adjust' && method === 'POST') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await canManageStock(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const body = await request.json()
      const { item_id, quantity_added, notes } = body
      const qty = Number(quantity_added)
      if (!item_id || qty === 0 || Number.isNaN(qty)) {
        return cors(NextResponse.json({ error: 'Missing or invalid item_id or quantity_added (non-zero)' }, { status: 400 }))
      }

      const { data: issuerRow, error: issuerErr } = await adminSupabase
        .from('profiles_core')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (issuerErr || !issuerRow) {
        return cors(NextResponse.json({ error: 'Your profile not found in profiles_core' }, { status: 403 }))
      }
      const adjustedByProfileId = issuerRow.id

      const { data: item, error: itemError } = await adminSupabase
        .from('inventory_items')
        .select('id, current_quantity, total_received')
        .eq('id', item_id)
        .single()
      if (itemError || !item) return cors(NextResponse.json({ error: 'Item not found' }, { status: 404 }))

      const currentQty = Number(item.current_quantity) || 0
      const currentReceived = Number(item.total_received) || 0
      const newTotal = currentQty + qty
      if (newTotal < 0) {
        return cors(NextResponse.json({ error: 'Insufficient stock: reduction would make quantity negative' }, { status: 400 }))
      }
      const newReceived = qty > 0 ? currentReceived + qty : currentReceived

      const { error: updateError } = await adminSupabase
        .from('inventory_items')
        .update({
          current_quantity: newTotal,
          total_received: newReceived,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item_id)
      if (updateError) return cors(NextResponse.json({ error: 'Failed to update stock: ' + updateError.message }, { status: 500 }))

      const { error: auditError } = await adminSupabase
        .from('stock_audit_logs')
        .insert({
          item_id,
          adjusted_by: adjustedByProfileId,
          quantity_added: qty,
          new_total: newTotal,
          notes: notes != null ? String(notes).trim() : '',
        })
      if (auditError) return cors(NextResponse.json({ error: 'Failed to write audit log: ' + auditError.message }, { status: 500 }))

      return cors(NextResponse.json({ status: 'ok', new_total: newTotal }))
    }

    // =============================================
    // INVENTORY: Stock audit history for an item
    // =============================================
    if (route === '/admin/inventory/audit' && method === 'GET') {
      const user = await getUserFromToken(request)
      if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const adminSupabase = createAdminSupabase()
      if (!(await isAdmin(adminSupabase, user.id))) return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

      const url = new URL(request.url)
      const itemId = url.searchParams.get('item_id')
      if (!itemId) return cors(NextResponse.json({ error: 'item_id required' }, { status: 400 }))

      const { data: logs, error } = await adminSupabase
        .from('stock_audit_logs')
        .select('id, item_id, adjusted_by, quantity_added, new_total, notes, created_at')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })

      if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }))
      const list = logs || []
      const adjustedByIds = [...new Set(list.map((l) => l.adjusted_by).filter(Boolean))]
      const { data: profiles } = adjustedByIds.length
        ? await adminSupabase.from('profiles_core').select('id, full_name').in('id', adjustedByIds)
        : { data: [] }
      const profilesById = (profiles || []).reduce((acc, p) => { acc[p.id] = p; return acc }, {})
      const data = list.map((log) => ({
        ...log,
        profiles_core: profilesById[log.adjusted_by] ? { full_name: profilesById[log.adjusted_by].full_name } : null,
      }))
      return cors(NextResponse.json({ data }))
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
