'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, Lock, Loader2, Shield, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

const AUTH_MODE_SIGN_IN = 'signin'
const AUTH_MODE_SIGN_UP = 'signup'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [authMode, setAuthMode] = useState(AUTH_MODE_SIGN_IN)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
        return
      }
      setCheckingAuth(false)
    }
    checkAuth()
  }, [router])

  const resetForm = useCallback(() => {
    setError('')
    setPassword('')
  }, [])

  const toggleAuthMode = useCallback(() => {
    setAuthMode((prev) =>
      prev === AUTH_MODE_SIGN_IN ? AUTH_MODE_SIGN_UP : AUTH_MODE_SIGN_IN
    )
    resetForm()
  }, [resetForm])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    if (authMode === AUTH_MODE_SIGN_IN) {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        setIsSubmitting(false)
        return
      }

      toast.success('Signed in successfully')
      router.push('/dashboard')
    } else {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        setIsSubmitting(false)
        return
      }

      toast.success('Account created! You can now sign in.')
      setAuthMode(AUTH_MODE_SIGN_IN)
      setPassword('')
      setIsSubmitting(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const isSignIn = authMode === AUTH_MODE_SIGN_IN

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Card className="w-full max-w-sm shadow-xl border-0">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-3 shadow-lg">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">YA Core</CardTitle>
          <CardDescription className="text-sm">
            Volunteer Resource Planning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  required
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder={isSignIn ? 'Enter your password' : 'Create a password (min. 6 chars)'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11"
                  required
                  minLength={6}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignIn ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                <>
                  {isSignIn ? (
                    'Sign In'
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Create Account
                    </>
                  )}
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              {isSignIn ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={toggleAuthMode}
                className="text-primary font-medium hover:underline"
                disabled={isSubmitting}
              >
                {isSignIn ? 'Create Account' : 'Sign In'}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
