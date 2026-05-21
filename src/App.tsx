import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/store/AuthProvider'
import { RequireAuth } from '@/routes'

import RestaurantTapPage from '@/pages/RestaurantTapPage'
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
import Requests          from '@/pages/restaurant/Requests'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public — customer-facing ────────────────────────
              /tap/:restaurantSlug  — primary QR/table page (no login)
              /nfc/:braceletId      — NFC bracelet flow (no login)
          ──────────────────────────────────────────────────── */}
          <Route path="/tap/:restaurantSlug" element={<RestaurantTapPage />} />
          <Route path="/nfc/:braceletId"     element={<TapPage />} />

          {/* ── Auth ───────────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Server ─────────────────────────────────────────── */}
          <Route element={<RequireAuth allowedRoles={['server', 'manager', 'admin']} />}>
            <Route path="/server" element={<ServerDashboard />} />
          </Route>

          {/* ── Restaurant manager ─────────────────────────────── */}
          <Route element={<RequireAuth allowedRoles={['manager', 'admin']} />}>
            <Route path="/restaurant" element={<RestaurantLayout />}>
              <Route index            element={<Overview />}  />
              <Route path="items"     element={<Items />}     />
              <Route path="analytics" element={<Analytics />} />
              <Route path="sales"     element={<Sales />}     />
              <Route path="requests"  element={<Requests />}  />
            </Route>
          </Route>

          {/* ── ServeSync admin ────────────────────────────────── */}
          <Route element={<RequireAuth allowedRoles={['admin']} />}>
            <Route path="/admin"           element={<AdminDashboard />} />
            <Route path="/admin/bracelets" element={<AdminDashboard />} />
            <Route path="/admin/servers"   element={<AdminDashboard />} />
          </Route>

          {/* ── Fallbacks ──────────────────────────────────────── */}
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
