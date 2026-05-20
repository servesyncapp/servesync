import { createContext, useContext } from 'react'
import type { User, Session } from '@supabase/supabase-js'

export type Role = 'admin' | 'manager' | 'server'

export interface AuthState {
  user: User | null
  session: Session | null
  role: Role | null
  restaurantId: string | null
  loading: boolean
}

export const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  role: null,
  restaurantId: null,
  loading: true,
})

export const useAuth = () => useContext(AuthContext)
