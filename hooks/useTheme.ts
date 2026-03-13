'use client'

import { useState, useEffect } from 'react'

export const THEME_COLORS: Record<string, string> = {
  'solar-flare':    '#f59e0b',
  'elite-purple':   '#8b5cf6',
  'midnight-cyan':  '#06b6d4',
  'emerald-circuit':'#10b981',
  'monochrome':     '#e4e4e7',
}

export const themes = [
  { id: 'solar-flare',     name: 'Solar Flare',     
    color: '#f59e0b', icon: 'flame',
    description: 'Amber energy for creative sessions.' },
  { id: 'elite-purple',    name: 'Elite Purple',    
    color: '#8b5cf6', icon: 'sparkles',
    description: 'High-fidelity architectural aesthetic.' },
  { id: 'midnight-cyan',   name: 'Midnight Cyan',   
    color: '#06b6d4', icon: 'moon',
    description: 'Deep digital ocean for late-night work.' },
  { id: 'emerald-circuit', name: 'Emerald Circuit', 
    color: '#10b981', icon: 'leaf',
    description: 'Forest hues for deep concentration.' },
  { id: 'monochrome',      name: 'Monochrome',      
    color: '#e4e4e7', icon: 'terminal',
    description: 'Pure grayscale for engineering focus.' },
]

export function useTheme() {
  const [theme, setThemeState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'solar-flare'
    return document.documentElement
      .getAttribute('data-theme') || 'solar-flare'
  })

  const [hasChosen, setHasChosen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('reminisce-theme-chosen') === 'true'
  })

  const applyTheme = (id: string, isFirstChoice = false) => {
    setThemeState(id)
    localStorage.setItem('reminisce-theme', id)
    document.documentElement.setAttribute('data-theme', id)
    if (isFirstChoice) {
      localStorage.setItem('reminisce-theme-chosen', 'true')
      setHasChosen(true)
    }
  }

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'reminisce-theme' && e.newValue) {
        setThemeState(e.newValue)
        document.documentElement
          .setAttribute('data-theme', e.newValue)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const accent = THEME_COLORS[theme] || '#f59e0b'

  return { theme, accent, hasChosen, applyTheme, themes }
}
