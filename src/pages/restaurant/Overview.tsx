import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { StatCard } from '@/components/ui/StatCard'

interface Stats {
  taps: number
  clicks: number
  requests: number
}

export default function Overview() {
  const { restaurantId } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurantId) return
    fetchStats()
  }, [restaurantId])

  async function fetchStats() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const [tapsRes, clicksRes, requestsRes] = await Promise.all([
      supabase
        .from('tap_events')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId!)
        .gte('tapped_at', today),
      supabase
        .from('click_events')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId!)
        .gte('clicked_at', today),
      supabase
        .from('customer_requests')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId!)
        .gte('created_at', today),
    ])

    setStats({
      taps:     tapsRes.count     ?? 0,
      clicks:   clicksRes.count   ?? 0,
      requests: requestsRes.count ?? 0,
    })
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[--color-text-primary] mb-1">Overview</h1>
      <p className="text-sm text-[--color-text-secondary] mb-6">Today's engagement at a glance</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard
          label="Taps today"
          value={loading ? '—' : stats?.taps ?? 0}
          accent
        />
        <StatCard
          label="Clicks today"
          value={loading ? '—' : stats?.clicks ?? 0}
          accent
        />
        <StatCard
          label="Requests today"
          value={loading ? '—' : stats?.requests ?? 0}
          accent
        />
      </div>

      {/* Coming-soon panel with brand-hero watermark */}
      <div className="card overflow-hidden">
        <div className="relative h-32 bg-[--color-surface-2] flex items-center justify-center border-b border-[--color-border]">
          <img
            src="/logos/servesync-brand-hero.png"
            alt=""
            className="absolute inset-0 w-full h-full object-contain p-6 opacity-[0.07] pointer-events-none select-none"
          />
          <div className="relative z-10 text-center px-4">
            <p className="text-xs font-semibold text-[--color-brand] uppercase tracking-widest mb-1">
              Coming next
            </p>
            <p className="text-sm font-medium text-[--color-text-secondary]">
              Full analytics &amp; campaign comparisons
            </p>
          </div>
        </div>
        <div className="px-5 py-3">
          <p className="text-xs text-[--color-text-muted]">
            Tap-to-click rates, top performing items, engagement by server, and side-by-side campaign results.
          </p>
        </div>
      </div>
    </div>
  )
}
