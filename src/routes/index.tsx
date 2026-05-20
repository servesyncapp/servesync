import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth'

interface RequireAuthProps {
  allowedRoles?: string[]
}

export function RequireAuth({ allowedRoles }: RequireAuthProps) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenSpinner />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}

export function FullScreenSpinner() {
  return (
    <div className="min-h-dvh bg-[--color-base] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-[--color-border] border-t-[--color-brand] animate-spin" />
        <p className="text-xs text-[--color-text-muted]">Loading…</p>
      </div>
    </div>
  )
}
