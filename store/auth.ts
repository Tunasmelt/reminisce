import { create } from 'zustand'
import { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  initialized: boolean
  setUser: (user: User | null, session: Session | null) => void
  setInitialized: (val: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  initialized: false,
  setUser: (user, session) => set({ user, session }),
  setInitialized: (initialized) => set({ initialized })
}))
