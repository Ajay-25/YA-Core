'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth, useUser, useClerk } from '@clerk/nextjs'
import { readRbacFromClerk } from '@/lib/clerk-rbac'

const DashboardContext = createContext(null)

export function DashboardProvider({ children }) {
  const { isLoaded, userId, sessionClaims } = useAuth()
  const { user: clerkUser } = useUser()
  const { signOut } = useClerk()
  const [role, setRole] = useState(null)
  const [accessibleModules, setAccessibleModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()

  const session = userId ? { access_token: '', user: clerkUser ?? { id: userId } } : null

  useEffect(() => {
    const init = async () => {
      if (!isLoaded) return
      if (!userId) {
        router.push('/sign-in')
        return
      }

      const fromClerk = readRbacFromClerk(sessionClaims, clerkUser?.publicMetadata)
      if (fromClerk) {
        setRole(fromClerk.role)
        setAccessibleModules(fromClerk.accessibleModules)
      }

      try {
        const ensureRes = await fetch('/api/profile/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
        })
        if (ensureRes.ok) {
          const ensureData = await ensureRes.json()
          if (ensureData.profile) {
            setRole(ensureData.profile.role || 'volunteer')
            setAccessibleModules(ensureData.profile.accessible_modules || [])
            setLoading(false)
            return
          }
        }

        const meRes = await fetch('/api/profile/me', { credentials: 'same-origin' })
        if (meRes.ok) {
          const meData = await meRes.json()
          if (meData.core) {
            setRole(meData.core.role || 'volunteer')
            setAccessibleModules(meData.core.accessible_modules || [])
            setLoading(false)
            return
          }
        }
      } catch (e) {
        console.error('Profile fetch error:', e)
      }

      setNeedsSetup(true)
      setLoading(false)
    }

    init()
  }, [router, isLoaded, userId, sessionClaims, clerkUser?.publicMetadata])

  const { data: profileResponse, isLoading: profileLoading } = useQuery({
    queryKey: ['my-profile', userId],
    queryFn: async () => {
      const res = await fetch('/api/profile/me', { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Failed to fetch profile')
      return res.json()
    },
    enabled: Boolean(userId) && !needsSetup && !loading,
  })

  const handleLogout = useCallback(async () => {
    await signOut()
    router.push('/sign-in')
  }, [router, signOut])

  const handleRetrySetup = useCallback(async () => {
    setNeedsSetup(false)
    setLoading(true)
    if (userId) {
      try {
        const ensureRes = await fetch('/api/profile/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
        })
        if (ensureRes.ok) {
          const ensureData = await ensureRes.json()
          if (ensureData.profile) {
            setRole(ensureData.profile.role || 'volunteer')
            setAccessibleModules(ensureData.profile.accessible_modules || [])
            setNeedsSetup(false)
            setLoading(false)
            return
          }
        }
      } catch (e) {
        console.error(e)
      }
      setNeedsSetup(true)
    }
    setLoading(false)
  }, [userId])

  const refreshProfile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['my-profile'] })
  }, [queryClient])

  return (
    <DashboardContext.Provider
      value={{
        session,
        user: clerkUser,
        userId,
        role,
        accessibleModules,
        profileCore: profileResponse?.core ?? null,
        profileData: profileResponse?.data ?? null,
        isLoading: loading,
        profileLoading,
        needsSetup,
        handleLogout,
        handleRetrySetup,
        refreshProfile,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider')
  }
  return context
}
