import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/store/AuthProvider'
import { RequireAuth } from '@/routes'

import TapPage           from '@/pages/TapPage'
import LoginPage         from '@/pages/LoginPage'
import ServerDashboard   from '@/pages/ServerDashboard'
import AdminDashboard    from '@/pages/AdminDashboard'
import NotFound          from '@/pages/NotFound'

// Restaurant layout + pages (nested routes)
import RestaurantLayout  from '@/components/restaurant/RestaurantLayout'
import Overview          from '@/pages/restaurant/Overview'
import Items             from '@/pages/restaurant/Items'
import Analytics         from '@/pages/restaurant/Analytics'
import Sales             from '@/pages/restaurant/Sales'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public ─────────────────────────────────────── */}
          <Route path="/tap/:braceletId" element={<TapPage />} />
          <Route path="/login"           element={<LoginPage />} />

          {/* ── Server ─────────────────────────────────────── */}
          <Route element={<RequireAuth allowedRoles={['server', 'manager', 'admin']} />}>
            <Route path="/server" element={<ServerDashboard />} />
          </Route>

          {/* ── Restaurant manager ─────────────────────────── */}
          {/*
            RestaurantLayout renders <AppShell> + <Outlet>.
            Each child route replaces the Outlet with its own page component.
            NavLink + end={true} on Overview ensures correct active state.
          */}
          <Route element={<RequireAuth allowedRoles={['manager', 'admin']} />}>
            <Route path="/restaurant" element={<RestaurantLayout />}>
              <Route index               element={<Overview />}  />
              <Route path="items"        element={<Items />}     />
              <Route path="analytics"    element={<Analytics />} />
              <Route path="sales"        element={<Sales />}     />
            </Route>
          </Route>

          {/* ── ServeSync admin ────────────────────────────── */}
          <Route element={<RequireAuth allowedRoles={['admin']} />}>
            <Route path="/admin"           element={<AdminDashboard />} />
            <Route path="/admin/bracelets" element={<AdminDashboard />} />
            <Route path="/admin/servers"   element={<AdminDashboard />} />
          </Route>

          {/* ── Fallbacks ──────────────────────────────────── */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/unauthorized" element={
            <div className="min-h-dvh bg-[--color-base] flex items-center justify-center">
              <p className="text-sm text-[--color-text-secondary]">
                You don't have permission to view this page.
              </p>
            </div>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
