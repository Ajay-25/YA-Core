'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // Handle PKCE code exchange
        const code = searchParams.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            console.error('Code exchange error:', exchangeError)
            setError(exchangeError.message)
            return
          }
        }

        // Check if session is established (handles both implicit and PKCE)
        const checkSession = async (attempts = 0) => {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            // Ensure profile exists via API
            try {
              const token = session.access_token
              await fetch('/api/profile/ensure', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              })
            } catch (e) {
              console.warn('Profile ensure failed:', e)
            }
            router.push('/dashboard')
            return
          }
          if (attempts < 5) {
            setTimeout(() => checkSession(attempts + 1), 1000)
          } else {
            setError('Authentication timed out. Please try again.')
          }
        }

        await checkSession()
      } catch (err) {
        console.error('Auth callback error:', err)
        setError('Authentication failed. Please try again.')
      }
    }

    handleAuth()
  }, [router, searchParams])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-destructive text-xl">!</span>
          </div>
          <h2 className="text-lg font-semibold">Authentication Error</h2>
          <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="text-primary text-sm font-medium hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground text-sm">Completing sign in...</p>
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  )
}

export default App;
