'use client'

import { useEffect } from 'react'

export function ThemeInitializer() {
  useEffect(() => {
    const saved = localStorage.getItem('reminisce-theme') || 'solar-flare'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  return null
}
