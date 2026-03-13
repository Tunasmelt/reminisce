'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setInitialized } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null, session)
      setInitialized(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null, session)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setInitialized])

  return <>{children}</>
}
