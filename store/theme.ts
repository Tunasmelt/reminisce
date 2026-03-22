import { create } from 'zustand'

interface ThemeStore {
  theme: string
  hasChosen: boolean
  setTheme: (theme: string) => void
  setHasChosen: (val: boolean) => void
}

export const useThemeStore = create<ThemeStore>((set) => {
  // Sync initialization on client side
  let initialTheme = 'solar-flare'
  let initialHasChosen = false
  
  if (typeof window !== 'undefined') {
    initialTheme = document.documentElement.getAttribute('data-theme') || 
                   localStorage.getItem('reminisce-theme') || 
                   'solar-flare'
    
    // If theme was already set (blocking script
    // ran), consider the user as having chosen
    const storedChoice = localStorage.getItem('reminisce-theme-chosen')
    const storedTheme = localStorage.getItem('reminisce-theme')
    initialHasChosen = storedChoice === 'true'
      || (storedTheme !== null && storedTheme !== '')
  }

  return {
    theme: initialTheme,
    hasChosen: initialHasChosen,
    setTheme: (theme: string) => {
      if (typeof window !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('reminisce-theme', theme)
      }
      set({ theme })
    },
    setHasChosen: (val: boolean) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('reminisce-theme-chosen', val ? 'true' : 'false')
      }
      set({ hasChosen: val })
    }
  }
})
