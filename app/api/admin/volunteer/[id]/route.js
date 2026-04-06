import { NextResponse } from 'next/server'
import { getRequestAuth } from '@/lib/clerk-request'
import { canAccessDirectory } from '@/lib/api-auth'
import * as repo from '@/lib/ya-repo'

function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

export async function GET(request, { params }) {
  const authCtx = await getRequestAuth()
  if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  if (!(await canAccessDirectory(authCtx.userId))) {
    return cors(NextResponse.json(
      { error: 'Unauthorized: Missing directory:view permission' },
      { status: 403 }
    ))
  }

  const resolved = await params
  const paramId = resolved?.id
  if (!paramId) return cors(NextResponse.json({ error: 'ID required' }, { status: 400 }))

  try {
    const bundle = await repo.getVolunteerDetailByParam(paramId)
    if (!bundle) {
      return cors(NextResponse.json({ error: 'Profile not found' }, { status: 404 }))
    }
    return cors(NextResponse.json({
      core: bundle.core,
      data: bundle.data,
      sensitive: bundle.sensitive,
      inventory: bundle.inventory,
    }))
  } catch (err) {
    console.error('Volunteer detail error:', err)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
