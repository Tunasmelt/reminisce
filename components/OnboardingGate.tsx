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
  
  // Before mount: render children immediately
  // but invisible. This avoids blank flash
  // while still preventing hydration mismatch.
  if (!mounted) {
    return (
      <div style={{ 
        visibility: 'hidden',
        minHeight: '100vh',
        background: '#000'
      }}>
        {children}
      </div>
    )
  }

  if (!hasChosen) {
    return <ThemeOnboarding />
  }

  return <>{children}</>
}
