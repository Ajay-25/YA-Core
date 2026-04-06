import { NextResponse } from 'next/server'
import { getRequestAuth } from '@/lib/clerk-request'
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

  try {
    const email = authCtx.email
    if (!email) return cors(NextResponse.json({ found: false }))

    const data = await repo.onboardingLookupByEmail(email)
    if (!data) {
      return cors(NextResponse.json({ found: false }))
    }

    const linked = Boolean(data.user_id)
    if (!linked) {
      return cors(NextResponse.json({ found: true, ya_id: data.ya_id }))
    }
    return cors(NextResponse.json({ found: true, ya_id: data.ya_id, already_linked: true }))
  } catch (err) {
    console.error('Onboarding lookup error:', err)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function POST(request) {
  const authCtx = await getRequestAuth()
  if (!authCtx) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  try {
    const body = await request.json()
    const { ya_id, profession, highest_qualification } = body
    if (!ya_id || typeof ya_id !== 'string' || !ya_id.trim()) {
      return cors(NextResponse.json({ error: 'YA ID is required' }, { status: 400 }))
    }

    const trimmedId = ya_id.trim()
    const profile = await repo.findProfileByYaId(trimmedId)
    if (!profile) {
      return cors(NextResponse.json({ error: 'No profile found with this YA ID' }, { status: 404 }))
    }

    if (profile.user_id && profile.user_id !== authCtx.userId) {
      return cors(NextResponse.json(
        { error: 'This profile is already linked to another account' },
        { status: 409 }
      ))
    }

    if (profile.user_id === authCtx.userId) {
      await repo.ensureProfilesDataRowForUser(authCtx.userId)
      await repo.patchProfilesData(authCtx.userId, {
        profession: typeof profession === 'string' ? profession.trim() : undefined,
        highest_qualification:
          typeof highest_qualification === 'string' ? highest_qualification.trim() : undefined,
      })
      return cors(NextResponse.json({ success: true, message: 'Already linked' }))
    }

    await repo.onboardingLinkProfile(profile.id, authCtx.userId, authCtx.email)
    await repo.ensureProfilesDataRowForUser(authCtx.userId)
    await repo.patchProfilesData(authCtx.userId, {
      profession: typeof profession === 'string' ? profession.trim() : undefined,
      highest_qualification:
        typeof highest_qualification === 'string' ? highest_qualification.trim() : undefined,
    })
    return cors(NextResponse.json({ success: true }))
  } catch (err) {
    console.error('Onboarding link error:', err)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
