'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const DashboardContext = createContext(null)

export function DashboardProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [accessibleModules, setAccessibleModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession()
      if (!s) {
        router.push('/')
        return
      }
      setUser(s.user)
      setSession(s)

      try {
        const ensureRes = await fetch('/api/profile/ensure', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${s.access_token}`,
            'Content-Type': 'application/json',
          },
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

        const meRes = await fetch('/api/profile/me', {
          headers: { 'Authorization': `Bearer ${s.access_token}` },
        })
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === 'SIGNED_OUT' || !newSession) router.push('/')
        if (newSession) {
          setSession(newSession)
          setUser(newSession.user)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [router])

  const { data: profileResponse, isLoading: profileLoading } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/profile/me', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch profile')
      return res.json()
    },
    enabled: !!user?.id && !!session && !needsSetup && !loading,
  })

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/')
  }, [router])

  const handleRetrySetup = useCallback(async () => {
    setNeedsSetup(false)
    setLoading(true)
    const { data: { session: s } } = await supabase.auth.getSession()
    if (s) {
      try {
        const ensureRes = await fetch('/api/profile/ensure', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${s.access_token}`,
            'Content-Type': 'application/json',
          },
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
  }, [])

  const refreshProfile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['my-profile'] })
  }, [queryClient])

  return (
    <DashboardContext.Provider
      value={{
        session,
        user,
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
