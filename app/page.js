'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return
    if (userId) router.replace('/dashboard')
    else router.replace('/sign-in')
  }, [isLoaded, userId, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
