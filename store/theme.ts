import { create } from 'zustand'

interface ThemeStore {
  theme: string
  setTheme: (theme: string) => void
}

export const useThemeStore = create<ThemeStore>((set) => {
  // Sync initialization on client side
  let initialTheme = 'solar-flare'
  if (typeof window !== 'undefined') {
    initialTheme = document.documentElement.getAttribute('data-theme') || 
                   localStorage.getItem('reminisce-theme') || 
                   'solar-flare'
  }

  return {
    theme: initialTheme,
    setTheme: (theme: string) => {
      if (typeof window !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('reminisce-theme', theme)
      }
      set({ theme })
    },
  }
})
