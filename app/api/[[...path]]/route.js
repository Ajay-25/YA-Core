import { NextResponse } from 'next/server'
import { getRequestAuth } from '@/lib/clerk-request'
import {
  isAdmin,
  canEditVolunteerProfiles,
  canManageStock,
  canAccessStock,
  canAccessDirectory,
} from '@/lib/api-auth'
import { PROFILE_SENSITIVE_COLUMNS } from '@/lib/profile-columns'
import * as repo from '@/lib/ya-repo'

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
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    if ((route === '/' || route === '/health') && method === 'GET') {
      return cors(NextResponse.json({ status: 'ok', app: 'YA Core VRP' }))
    }

    if (route === '/profile/ensure' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const existing = await repo.ensureProfileRows(
        authCtx.userId,
        authCtx.email,
        authCtx.fullName
      )
      return cors(NextResponse.json({ status: 'ok', profile: existing }))
    }

    if (route === '/profile/me' && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const { core, data } = await repo.selectProfileMe(authCtx.userId)
      if (!core) {
        return cors(NextResponse.json({ error: 'Profile not found' }, { status: 404 }))
      }
      return cors(NextResponse.json({ core, data }))
    }

    if (route === '/profile/update' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      const body = await request.json()
      const { core: coreUpdate, data: dataUpdate } = body
      if (coreUpdate) await repo.patchProfilesCore(authCtx.userId, coreUpdate)
      if (dataUpdate) await repo.patchProfilesData(authCtx.userId, dataUpdate)
      return cors(NextResponse.json({ status: 'ok' }))
    }

    if (route === '/admin/set-role' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const { target_user_id, role } = await request.json()
      if (!target_user_id || !['admin', 'volunteer'].includes(role)) {
        return cors(NextResponse.json({ error: 'Invalid parameters' }, { status: 400 }))
      }
      try {
        await repo.setUserRole(target_user_id, role)
      } catch (e) {
        return cors(NextResponse.json({ error: e.message || 'Update failed' }, { status: 500 }))
      }
      return cors(NextResponse.json({ status: 'ok' }))
    }

    if (route === '/admin/volunteers' && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await canAccessDirectory(authCtx.userId))) {
        return cors(NextResponse.json(
          { error: 'Unauthorized: Missing directory:view permission' },
          { status: 403 }
        ))
      }
      const url = new URL(request.url)
      const search = url.searchParams.get('search') || ''
      const page = parseInt(url.searchParams.get('page') || '0', 10)
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10)
      const { data, total } = await repo.listVolunteersPaginated(search, page, pageSize)
      return cors(NextResponse.json({ data: data || [], total: total || 0 }))
    }

    if (route.startsWith('/admin/volunteer/') && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await canAccessDirectory(authCtx.userId))) {
        return cors(NextResponse.json(
          { error: 'Unauthorized: Missing directory:view permission' },
          { status: 403 }
        ))
      }
      const param = path[path.length - 1]
      const bundle = await repo.getVolunteerDetailByParam(param)
      if (!bundle) {
        return cors(NextResponse.json({ error: 'Profile not found' }, { status: 404 }))
      }
      return cors(NextResponse.json({
        core: bundle.core,
        data: bundle.data,
        sensitive: bundle.sensitive,
        inventory: bundle.inventory,
      }))
    }

    if (route === '/admin/sensitive/update' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const body = await request.json()
      const { target_user_id, ...updateData } = body
      const filtered = Object.fromEntries(
        Object.entries(updateData).filter(([k]) => PROFILE_SENSITIVE_COLUMNS.has(k))
      )
      await repo.patchProfilesSensitive(target_user_id, filtered)
      return cors(NextResponse.json({ status: 'ok' }))
    }

    if (route === '/admin/volunteer-update' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await canEditVolunteerProfiles(authCtx.userId))) {
        return cors(NextResponse.json(
          { error: 'Unauthorized: Missing directory:edit permission' },
          { status: 403 }
        ))
      }
      const { target_user_id, core: coreUpdate, data: dataUpdate } = await request.json()
      if (!target_user_id) {
        return cors(NextResponse.json({ error: 'target_user_id required' }, { status: 400 }))
      }
      if (coreUpdate) await repo.patchProfilesCore(target_user_id, coreUpdate)
      if (dataUpdate) await repo.patchProfilesData(target_user_id, dataUpdate)
      return cors(NextResponse.json({ status: 'ok' }))
    }

    if (route === '/admin/stock' && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const data = await repo.listStockItems()
      return cors(NextResponse.json({ data: data || [] }))
    }

    if (route === '/admin/stock' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const body = await request.json()
      if (!body.name) return cors(NextResponse.json({ error: 'Name required' }, { status: 400 }))
      try {
        const data = await repo.insertStockItem(body)
        return cors(NextResponse.json({ data }))
      } catch (e) {
        return cors(NextResponse.json({ error: e.message || 'Insert failed' }, { status: 500 }))
      }
    }

    if (route === '/admin/stock/update' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const body = await request.json()
      const { id, ...updateData } = body
      if (!id) return cors(NextResponse.json({ error: 'ID required' }, { status: 400 }))
      const allowed = new Set([
        'name', 'category', 'description', 'total_quantity', 'issued_quantity', 'unit', 'min_stock_level',
      ])
      const clean = Object.fromEntries(
        Object.entries(updateData).filter(([k]) => allowed.has(k))
      )
      try {
        await repo.updateStockItem(id, clean)
      } catch (e) {
        return cors(NextResponse.json({ error: e.message || 'Update failed' }, { status: 500 }))
      }
      return cors(NextResponse.json({ status: 'ok' }))
    }

    if (route === '/admin/stock/delete' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const { id } = await request.json()
      if (!id) return cors(NextResponse.json({ error: 'ID required' }, { status: 400 }))
      try {
        await repo.deleteStockItem(id)
      } catch (e) {
        return cors(NextResponse.json({ error: e.message || 'Delete failed' }, { status: 500 }))
      }
      return cors(NextResponse.json({ status: 'ok' }))
    }

    if (route === '/admin/stock/issue' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const body = await request.json()
      const result = await repo.stockIssueLegacy(authCtx.userId, body)
      if (result.error) {
        return cors(NextResponse.json({ error: result.error }, { status: result.status || 500 }))
      }
      return cors(NextResponse.json({ status: 'ok', data: result.data }))
    }

    if (route === '/admin/stock/history' && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const url = new URL(request.url)
      const page = parseInt(url.searchParams.get('page') || '0', 10)
      const pageSize = parseInt(url.searchParams.get('pageSize') || '30', 10)
      const search = url.searchParams.get('search') || ''
      const { data, total } = await repo.stockHistoryPage(search, page, pageSize)
      return cors(NextResponse.json({ data: data || [], total: total || 0 }))
    }

    if (route === '/admin/stock/search-volunteers' && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const url = new URL(request.url)
      const search = url.searchParams.get('q') || ''
      if (!search || search.length < 2) {
        return cors(NextResponse.json({ data: [] }))
      }
      const data = await repo.searchVolunteersForStock(search)
      return cors(NextResponse.json({ data: data || [] }))
    }

    if (route === '/admin/inventory/items' && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await canAccessStock(authCtx.userId))) {
        return cors(NextResponse.json(
          { error: 'Unauthorized: Missing stock permissions' },
          { status: 403 }
        ))
      }
      const data = await repo.listInventoryItems()
      return cors(NextResponse.json({ data: data || [] }))
    }

    if (route === '/admin/inventory/volunteers/search' && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') || '').trim()
      if (!q || q.length < 1) {
        return cors(NextResponse.json({ data: [] }))
      }
      const merged = await repo.inventorySearchVolunteersMerged(q)
      return cors(NextResponse.json({ data: merged }))
    }

    if (path[0] === 'admin' && path[1] === 'inventory' && path[2] === 'volunteers' && path[4] === 'logs' && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const volunteerParam = path[3]
      const volunteerProfileId = await repo.resolveVolunteerProfileId(volunteerParam)
      if (!volunteerProfileId) {
        return cors(NextResponse.json({ data: [], hasIssued: false }))
      }
      const data = await repo.inventoryVolunteerIssuedLogs(volunteerProfileId)
      return cors(NextResponse.json({ data: data || [], hasIssued: (data || []).length > 0 }))
    }

    if (path[0] === 'admin' && path[1] === 'inventory' && path[2] === 'volunteers' && path[4] === 'history' && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const volunteerParam = path[3]
      const volunteerProfileId = await repo.resolveVolunteerProfileId(volunteerParam)
      if (!volunteerProfileId) {
        return cors(NextResponse.json({ data: [] }))
      }
      const data = await repo.inventoryVolunteerHistoryDetail(volunteerProfileId)
      return cors(NextResponse.json({ data }))
    }

    if (route === '/admin/inventory/issue' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const body = await request.json()
      const { volunteer_id, payment_method } = body
      const batchItems = Array.isArray(body.items) ? body.items : null

      if (!volunteer_id || !['cash', 'upi', 'waived', 'pending'].includes(payment_method)) {
        return cors(NextResponse.json(
          { error: 'Missing volunteer_id or invalid payment_method' },
          { status: 400 }
        ))
      }

      const volunteerProfileId = await repo.resolveVolunteerProfileId(volunteer_id)
      if (!volunteerProfileId) {
        return cors(NextResponse.json({ error: 'Volunteer not found in profiles' }, { status: 404 }))
      }
      const issuedByProfileId = await repo.getProfileCoreIdByUserId(authCtx.userId)
      if (!issuedByProfileId) {
        return cors(NextResponse.json(
          { error: 'Issuer profile not found in profiles_core' },
          { status: 403 }
        ))
      }

      try {
        if (batchItems && batchItems.length > 0) {
          const lines = batchItems.map((row) => ({
            itemId: row.item_id,
            qty: Number(row.quantity_issued),
          }))
          const result = await repo.issueInventoryLines({
            volunteerProfileId,
            issuedByProfileId,
            payment_method,
            lines,
          })
          if (result.error) {
            return cors(NextResponse.json({ error: result.error }, { status: result.status || 400 }))
          }
          return cors(
            NextResponse.json({ status: 'ok', data: result.logs, count: result.logs.length })
          )
        }

        const { item_id, quantity_issued } = body
        if (!item_id || quantity_issued == null || quantity_issued <= 0) {
          return cors(NextResponse.json(
            { error: 'Missing or invalid item_id or quantity_issued (or send items: [])' },
            { status: 400 }
          ))
        }
        const item = await repo.getInventoryItem(item_id)
        if (!item) return cors(NextResponse.json({ error: 'Item not found' }, { status: 404 }))
        const currentQty = Number(item.current_quantity) || 0
        const qty = Number(quantity_issued)
        if (currentQty < qty) {
          return cors(NextResponse.json(
            { error: `Insufficient stock. Available: ${currentQty}` },
            { status: 400 }
          ))
        }
        const unitPrice = Number(item.unit_price) || 0
        const amount_due = Math.round(qty * unitPrice * 100) / 100
        const log = await repo.insertInventoryIssue({
          volunteerProfileId,
          itemId: item_id,
          issuedByProfileId,
          qty,
          amount_due,
          payment_method,
        })
        await repo.decrementInventoryItemQty(item_id, currentQty - qty)
        return cors(NextResponse.json({ status: 'ok', data: log }))
      } catch (e) {
        return cors(NextResponse.json({ error: e.message || 'Issue failed' }, { status: 500 }))
      }
    }

    if (route === '/admin/inventory/logs' && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await canAccessStock(authCtx.userId))) {
        return cors(NextResponse.json(
          { error: 'Unauthorized: Missing stock permissions' },
          { status: 403 }
        ))
      }
      const url = new URL(request.url)
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)
      const data = await repo.listRecentInventoryLogs(limit)
      return cors(NextResponse.json({ data }))
    }

    if (route === '/admin/inventory/undo' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await canManageStock(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const { log_id } = await request.json()
      if (!log_id) return cors(NextResponse.json({ error: 'log_id required' }, { status: 400 }))
      const result = await repo.undoInventoryLog(log_id)
      if (result.error) {
        return cors(NextResponse.json({ error: result.error }, { status: result.status || 500 }))
      }
      return cors(NextResponse.json({ status: 'ok' }))
    }

    if (route === '/admin/inventory/adjust' && method === 'POST') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await canManageStock(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const body = await request.json()
      const { item_id, quantity_added, notes } = body
      const qty = Number(quantity_added)
      if (!item_id || qty === 0 || Number.isNaN(qty)) {
        return cors(NextResponse.json(
          { error: 'Missing or invalid item_id or quantity_added (non-zero)' },
          { status: 400 }
        ))
      }
      const adjustedByProfileId = await repo.getProfileCoreIdByUserId(authCtx.userId)
      if (!adjustedByProfileId) {
        return cors(NextResponse.json(
          { error: 'Your profile not found in profiles_core' },
          { status: 403 }
        ))
      }
      const result = await repo.adjustInventoryStock(item_id, qty, notes, adjustedByProfileId)
      if (result.error) {
        return cors(NextResponse.json({ error: result.error }, { status: result.status || 500 }))
      }
      return cors(NextResponse.json({ status: 'ok', new_total: result.new_total }))
    }

    if (route === '/admin/inventory/audit' && method === 'GET') {
      const authCtx = await getRequestAuth()
      if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      if (!(await isAdmin(authCtx.userId))) {
        return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
      }
      const url = new URL(request.url)
      const itemId = url.searchParams.get('item_id')
      if (!itemId) return cors(NextResponse.json({ error: 'item_id required' }, { status: 400 }))
      const data = await repo.listStockAuditForItem(itemId)
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
