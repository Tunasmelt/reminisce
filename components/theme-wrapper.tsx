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
      opacity: mounted ? 1 : 0,
      transition: 'opacity 100ms ease',
      minHeight: '100vh',
      background: '#000'
    }}>
      {children}
    </div>
  )
}
