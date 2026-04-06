import { NextResponse } from 'next/server'
import { getRequestAuth } from '@/lib/clerk-request'
import { canAccessDirectory } from '@/lib/api-auth'
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
  if (!(await canAccessDirectory(authCtx.userId))) {
    return cors(NextResponse.json(
      { error: 'Unauthorized: Missing directory:view permission' },
      { status: 403 }
    ))
  }

  const { searchParams } = new URL(request.url)
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))

  try {
    const { data, total } = await repo.listVolunteersPaginated(search, page, pageSize)
    return cors(NextResponse.json({ data: data ?? [], total: total ?? 0 }))
  } catch (err) {
    console.error('Volunteers list error:', err)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
