'use client'

import { useEffect, useState } from 'react'

export default function ThemeWrapper({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  return (
    <div style={{ 
      visibility: mounted ? 'visible' : 'hidden',
      minHeight: '100vh',
      background: '#000',
    }}>
      {children}
    </div>
  )
}
