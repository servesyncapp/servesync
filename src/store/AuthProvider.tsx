import { type ReactNode, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthState, type Role } from './auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, session: null, role: null, restaurantId: null, loading: true,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => hydrate(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      hydrate(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function hydrate(session: Session | null) {
    if (!session) {
      setState({ user: null, session: null, role: null, restaurantId: null, loading: false })
      return
    }

    // Role from app_metadata — only set when using Supabase service-role or a DB trigger.
    // Not guaranteed to be present, so we always fall through to restaurant_users as well.
    const meta = session.user.app_metadata as Record<string, unknown>
    let role = (meta?.role as Role) ?? null

    let restaurantId: string | null = null

    // Always query restaurant_users regardless of role in app_metadata.
    // This is the reliable source of truth for manager/server accounts —
    // app_metadata.role may not be set without a custom trigger.
    const { data: membership, error: membershipError } = await supabase
      .from('restaurant_users')
      .select('restaurant_id, role')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('[AuthProvider] restaurant_users lookup failed:', membershipError)
    }

    if (membership) {
      restaurantId = membership.restaurant_id ?? null
      // Prefer app_metadata role (set by admin) but fall back to restaurant_users.role
      if (!role) {
        role = (membership.role as Role) ?? null
      }
    }

    console.log('[AuthProvider] hydrated —', {
      userId: session.user.id,
      email:  session.user.email,
      role,
      restaurantId,
      appMetaRole: meta?.role ?? '(not set)',
    })

    setState({ user: session.user, session, role, restaurantId, loading: false })
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
