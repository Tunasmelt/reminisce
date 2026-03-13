'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import ThemeOnboarding from './ThemeOnboarding'

export default function OnboardingGate({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const { hasChosen } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) {
    return <div style={{ background: '#000', minHeight: '100vh' }} />
  }

  if (!hasChosen) {
    return <ThemeOnboarding />
  }

  return <>{children}</>
}
