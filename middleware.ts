import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/auth/callback(.*)',
  '/api/webhooks(.*)',
])

const isAdminRoute = createRouteMatcher(['/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  if (isPublicRoute(req) || !isAdminRoute(req)) {
    return
  }

  const sessionClaims = (await auth()).sessionClaims
  const meta =
    sessionClaims &&
    typeof sessionClaims === 'object' &&
    'metadata' in sessionClaims &&
    sessionClaims.metadata &&
    typeof sessionClaims.metadata === 'object'
      ? sessionClaims.metadata
      : undefined
  const roleFromMeta = meta && 'role' in meta ? Reflect.get(meta, 'role') : undefined
  const roleFromFlat =
    sessionClaims &&
    typeof sessionClaims === 'object' &&
    'role' in sessionClaims
      ? Reflect.get(sessionClaims, 'role')
      : undefined
  const role = roleFromMeta || roleFromFlat
  const isAdmin = String(role ?? '').toLowerCase() === 'admin'

  if (isAdmin) {
    return
  }

  return NextResponse.redirect(new URL('/dashboard', req.url))
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
