'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  Link2,
  CheckCircle,
  AlertCircle,
  Info,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'

export default function LinkProfilePage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [yaId, setYaId] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [linked, setLinked] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession()
      if (!s) {
        router.push('/')
        return
      }
      setSession(s)

      // Check if email matches an existing unlinked profile
      try {
        const res = await fetch('/api/onboarding', {
          headers: { Authorization: `Bearer ${s.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.already_linked) {
            router.push('/dashboard')
            return
          }
          if (data.found && data.ya_id) {
            setYaId(data.ya_id)
            setAutoFilled(true)
          }
        }
      } catch {
        // Non-critical — user can still type manually
      }

      setLoading(false)
    }
    init()
  }, [router])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!session || !yaId.trim()) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ya_id: yaId.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to link profile')
        setSubmitting(false)
        return
      }

      setLinked(true)
      toast.success('Profile linked successfully!')
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }, [session, yaId, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Checking your profile...</p>
        </div>
      </div>
    )
  }

  if (linked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-lg font-semibold">Profile Linked!</h2>
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Card className="w-full max-w-sm shadow-xl border-0">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-3 shadow-lg">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl font-bold">Link Your Profile</CardTitle>
          <CardDescription className="text-sm">
            Connect your account to your YA volunteer profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          {autoFilled && (
            <Alert className="mb-4 border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                We found a profile matching your email. Please confirm your YA ID below.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="ya-id" className="text-sm font-medium">
                YA ID
              </label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="ya-id"
                  type="text"
                  placeholder="Enter your YA ID (e.g. YA-001)"
                  value={yaId}
                  onChange={(e) => {
                    setYaId(e.target.value)
                    setError('')
                  }}
                  className="pl-10 h-11"
                  required
                  disabled={submitting}
                  autoFocus={!autoFilled}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your YA ID was provided during volunteer registration
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-medium"
              disabled={submitting || !yaId.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Link Profile
                </>
              )}
            </Button>

            <p className="text-[11px] text-center text-muted-foreground">
              Don&apos;t have a YA ID?{' '}
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="text-primary font-medium hover:underline"
              >
                Skip for now
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
