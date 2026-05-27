import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { StatCard } from '@/components/ui/StatCard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntentStats {
  pending:   number
  ordered:   number
  dismissed: number
  expired:   number
  total:     number
}

interface TopItem {
  item_name:     string
  ordered_count: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number, d: number): string {
  if (d === 0) return '—'
  return `${Math.round((n / d) * 100)}%`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { restaurantId } = useAuth()
  const [stats,    setStats]    = useState<IntentStats | null>(null)
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (restaurantId) void fetchStats()
  }, [restaurantId])

  async function fetchStats() {
    setLoading(true)
    setError(null)
    try {
      // Pull all intents with the joined item name in one query.
      // client-side aggregation keeps this a single round-trip with no RPC needed.
      const { data, error: err } = await supabase
        .from('order_intents')
        .select('status, featured_items(name)')
        .eq('restaurant_id', restaurantId!)

      if (err) throw err

      const rows = data ?? []

      const pending   = rows.filter(r => r.status === 'pending').length
      const ordered   = rows.filter(r => r.status === 'ordered').length
      const dismissed = rows.filter(r => r.status === 'dismissed').length
      const expired   = rows.filter(r => r.status === 'expired').length

      setStats({ pending, ordered, dismissed, expired, total: rows.length })

      // Top 5 items by ordered count
      const countMap = new Map<string, number>()
      for (const r of rows) {
        if (r.status !== 'ordered') continue
        const name = (r.featured_items as unknown as { name: string } | null)?.name ?? 'Unknown item'
        countMap.set(name, (countMap.get(name) ?? 0) + 1)
      }
      setTopItems(
        [...countMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([item_name, ordered_count]) => ({ item_name, ordered_count }))
      )
    } catch (err) {
      console.error('[Analytics] fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }

  // Conversion rate = ordered / (ordered + dismissed)  [expired excluded]
  const resolved     = (stats?.ordered ?? 0) + (stats?.dismissed ?? 0)
  const convRate     = pct(stats?.ordered ?? 0, resolved)
  const v = (key: keyof IntentStats) => loading ? '—' : String(stats?.[key] ?? 0)

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text-primary]">Analytics</h1>
          <p className="text-sm text-[--color-text-secondary] mt-0.5">
            Order intent conversion — all time
          </p>
        </div>
        <button
          onClick={() => void fetchStats()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[--color-border] text-xs font-medium text-[--color-text-secondary] hover:text-[--color-text-primary] hover:border-[--color-brand]/40 transition-colors disabled:opacity-50 mt-1"
        >
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={loading ? 'animate-spin' : ''}
          >
            <path d="M10.5 6A4.5 4.5 0 116 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M10.5 1.5v3.5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {/* ── Intent volume ────────────────────────────────────────────────── */}
      <p className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider mb-2 mt-5">
        Intent volume
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total"     value={v('total')}     />
        <StatCard label="Pending"   value={v('pending')}   accent />
        <StatCard label="Ordered"   value={v('ordered')}   />
        <StatCard label="Dismissed" value={v('dismissed')} />
      </div>

      {/* ── Conversion rate ──────────────────────────────────────────────── */}
      <p className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider mb-2">
        Conversion
      </p>
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-[--color-text-muted] mb-0.5">Order conversion rate</p>
            <p className="text-3xl font-bold text-[--color-text-primary]">
              {loading ? '—' : convRate}
            </p>
            <p className="text-xs text-[--color-text-secondary] mt-1">
              ordered ÷ (ordered + dismissed)
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[--color-text-muted] mb-0.5">Resolved intents</p>
            <p className="text-2xl font-bold text-[--color-text-primary]">
              {loading ? '—' : resolved}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {!loading && resolved > 0 && (
          <div className="h-2 rounded-full bg-[--color-surface-3] overflow-hidden">
            <div
              className="h-full rounded-full bg-[--color-brand] transition-all duration-500"
              style={{ width: `${Math.round(((stats?.ordered ?? 0) / resolved) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Top items ────────────────────────────────────────────────────── */}
      <p className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider mb-2">
        Top items by orders
      </p>

      {loading && (
        <div className="card divide-y divide-[--color-border] animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5">
              <div className="h-3 w-40 bg-[--color-surface-3] rounded" />
              <div className="h-3 w-8 bg-[--color-surface-3] rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && topItems.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm text-[--color-text-muted]">
            No ordered intents yet — data will appear here as servers mark items ordered.
          </p>
        </div>
      )}

      {!loading && topItems.length > 0 && (
        <div className="card divide-y divide-[--color-border] mb-6">
          {topItems.map((item, i) => {
            const maxCount = topItems[0].ordered_count
            return (
              <div key={item.item_name} className="px-5 py-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-[--color-text-muted] w-4 shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm font-medium text-[--color-text-primary] truncate">
                      {item.item_name}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[--color-brand] shrink-0 ml-3">
                    {item.ordered_count}
                  </span>
                </div>
                {/* Relative bar */}
                <div className="h-1 rounded-full bg-[--color-surface-3] overflow-hidden ml-6">
                  <div
                    className="h-full rounded-full bg-[--color-brand]/50 transition-all duration-500"
                    style={{ width: `${Math.round((item.ordered_count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Coming next panel ────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="relative h-28 bg-[--color-surface-2] flex items-center justify-center border-b border-[--color-border]">
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
              Tap rates, clicks by item, and server performance
            </p>
          </div>
        </div>
        <div className="px-5 py-3 grid grid-cols-2 gap-2">
          {[
            'Taps over time',
            'Clicks by item',
            'Top performing server',
            'Campaign comparison',
          ].map(label => (
            <div key={label} className="flex items-center gap-2 text-xs text-[--color-text-muted]">
              <span className="w-1.5 h-1.5 rounded-full bg-[--color-brand] opacity-40 shrink-0" />
              {label}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
