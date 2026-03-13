'use client'

import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (initialized && !user) {
      router.push('/login')
    }
  }, [user, initialized, router])

  if (!initialized || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0e]">
        <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  return <>{children}</>
}
