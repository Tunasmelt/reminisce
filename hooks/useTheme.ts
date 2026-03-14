'use client'

import { useEffect, useMemo } from 'react'
import { useThemeStore } from '@/store/theme'

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
  const { theme, hasChosen, setTheme, setHasChosen } = useThemeStore()

  const applyTheme = (id: string, isFirstChoice = false) => {
    setTheme(id)
    if (isFirstChoice) {
      setHasChosen(true)
    }
  }

  // Cross-tab synchronization
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'reminisce-theme' && e.newValue) {
        setTheme(e.newValue)
      }
      if (e.key === 'reminisce-theme-chosen' && e.newValue) {
        setHasChosen(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [setTheme, setHasChosen])

  const accent = useMemo(() => THEME_COLORS[theme] || '#f59e0b', [theme])

  return { theme, accent, hasChosen, applyTheme, themes }
}
