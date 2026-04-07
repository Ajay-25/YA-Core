import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { getRequestAuth } from '@/lib/clerk-request'
import { isAdmin } from '@/lib/api-auth'
import * as repo from '@/lib/ya-repo'

function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

export async function GET(request) {
  const authCtx = await getRequestAuth()
  if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  if (!(await isAdmin(authCtx.userId))) {
    return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'staff'

  try {
    if (type === 'search') {
      const q = (searchParams.get('q') || '').trim()
      if (!q || q.length < 2) {
        return cors(NextResponse.json({ data: [] }))
      }
      const data = await repo.accessSearchUsers(q)
      return cors(NextResponse.json({ data: data ?? [] }))
    }

    const data = await repo.accessListStaff()
    return cors(NextResponse.json({ data: data ?? [] }))
  } catch (err) {
    console.error('Access list error:', err)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function POST(request) {
  const authCtx = await getRequestAuth()
  if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  if (!(await isAdmin(authCtx.userId))) {
    return cors(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  try {
    const { target_user_id, role, accessible_modules } = await request.json()
    if (!target_user_id) {
      return cors(NextResponse.json({ error: 'target_user_id is required' }, { status: 400 }))
    }

    const validRoles = [
      'admin',
      'operations_manager',
      'desk_moderator',
      'attendance_scanner',
      'custom',
      'volunteer',
    ]
    if (role && !validRoles.includes(role)) {
      return cors(NextResponse.json({ error: 'Invalid role' }, { status: 400 }))
    }

    if (!role && !Array.isArray(accessible_modules)) {
      return cors(NextResponse.json({ error: 'Nothing to update' }, { status: 400 }))
    }

    await repo.accessUpdateUser(target_user_id, role || null, accessible_modules)

    try {
      const client = await clerkClient()
      const existing = await client.users.getUser(target_user_id)
      const prev =
        existing.publicMetadata && typeof existing.publicMetadata === 'object'
          ? { ...existing.publicMetadata }
          : {}
      if (role) prev.role = role
      if (Array.isArray(accessible_modules)) prev.accessible_modules = accessible_modules
      await client.users.updateUser(target_user_id, { publicMetadata: prev })
    } catch (e) {
      console.warn('Clerk publicMetadata mirror failed (user may need a new session):', e)
    }

    return cors(NextResponse.json({ success: true }))
  } catch (err) {
    console.error('Access update error:', err)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
