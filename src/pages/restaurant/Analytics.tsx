import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { StatCard } from '@/components/ui/StatCard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawRow {
  id:           string
  status:       string
  server_label: string | null
  table_label:  string | null
  created_at:   string
  featured_items: unknown // Supabase join — cast at point of use
}

interface Stats {
  total:     number
  pending:   number
  ordered:   number
  dismissed: number
}

interface ItemCount {
  name:  string
  count: number
}

interface ActivityItem {
  id:          string
  itemName:    string
  serverLabel: string | null
  tableLabel:  string | null
  status:      string
  createdAt:   string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return `${s}s ago`
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function pct(n: number, d: number): string {
  if (d === 0) return '—'
  return `${Math.round((n / d) * 100)}%`
}

function getItemName(row: RawRow): string {
  return (row.featured_items as unknown as { name: string } | null)?.name ?? 'Unknown item'
}

function toRankedList(map: Map<string, number>, limit = 5): ItemCount[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

// ── Status badge config ───────────────────────────────────────────────────────

const BADGE: Record<string, { label: string; cls: string }> = {
  pending:   {
    label: 'Pending',
    cls:   'bg-[--color-brand]/15 text-[--color-brand] border border-[--color-brand]/30',
  },
  ordered:   {
    label: 'Confirmed',
    cls:   'bg-green-500/10 text-green-400 border border-green-500/25',
  },
  dismissed: {
    label: 'Dismissed',
    cls:   'bg-[--color-surface-3] text-[--color-text-muted] border border-[--color-border]',
  },
  expired:   {
    label: 'Expired',
    cls:   'bg-[--color-surface-3] text-[--color-text-muted] border border-[--color-border]',
  },
}

// ── Shared section label ──────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider mb-3 mt-7">
      {label}
    </p>
  )
}

// ── Item bar list (shared by "requested" and "confirmed" sections) ─────────────

function ItemBarList({
  items,
  accentCls = 'bg-[--color-brand]/60',
  emptyText,
}: {
  items:     ItemCount[]
  accentCls?: string
  emptyText: string
}) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-sm text-[--color-text-muted]">{emptyText}</p>
      </div>
    )
  }
  const max = items[0].count
  return (
    <>
      {items.map((item, i) => (
        <div key={item.name} className="px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-[--color-text-muted] w-4 shrink-0 text-right">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-[--color-text-primary] truncate">
                {item.name}
              </span>
            </div>
            <span className="text-sm font-bold text-[--color-brand] shrink-0 ml-3">
              {item.count}
            </span>
          </div>
          <div className="h-1 rounded-full bg-[--color-surface-3] overflow-hidden ml-6">
            <div
              className={`h-full rounded-full transition-all duration-500 ${accentCls}`}
              style={{ width: `${Math.round((item.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </>
  )
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[--color-border] last:border-0">
          <div className="h-3 w-4 bg-[--color-surface-3] rounded shrink-0" />
          <div className="h-3 flex-1 bg-[--color-surface-3] rounded" />
          <div className="h-3 w-8 bg-[--color-surface-3] rounded" />
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { restaurantId } = useAuth()

  const [stats,        setStats]        = useState<Stats | null>(null)
  const [topRequested, setTopRequested] = useState<ItemCount[]>([])
  const [topOrdered,   setTopOrdered]   = useState<ItemCount[]>([])
  const [activity,     setActivity]     = useState<ActivityItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    if (restaurantId) void loadData()
  }, [restaurantId])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // Single query — client-side aggregation avoids multiple round-trips.
      const { data, error: err } = await supabase
        .from('order_intents')
        .select('id, status, server_label, table_label, created_at, featured_items(name)')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false })

      if (err) throw err

      const rows = (data ?? []) as unknown as RawRow[]

      // ── Stats ───────────────────────────────────────────────────────────
      const pending   = rows.filter(r => r.status === 'pending').length
      const ordered   = rows.filter(r => r.status === 'ordered').length
      const dismissed = rows.filter(r => r.status === 'dismissed').length
      setStats({ total: rows.length, pending, ordered, dismissed })

      // ── Top items ────────────────────────────────────────────────────────
      // reqMap  = every request regardless of outcome (shows raw guest interest)
      // ordMap  = only 'ordered' rows          (shows confirmed ServeSync value)
      const reqMap = new Map<string, number>()
      const ordMap = new Map<string, number>()
      for (const row of rows) {
        const name = getItemName(row)
        reqMap.set(name, (reqMap.get(name) ?? 0) + 1)
        if (row.status === 'ordered') {
          ordMap.set(name, (ordMap.get(name) ?? 0) + 1)
        }
      }
      setTopRequested(toRankedList(reqMap))
      setTopOrdered(toRankedList(ordMap))

      // ── Activity feed (most recent 20) ───────────────────────────────────
      setActivity(
        rows.slice(0, 20).map(row => ({
          id:          row.id,
          itemName:    getItemName(row),
          serverLabel: row.server_label,
          tableLabel:  row.table_label,
          status:      row.status,
          createdAt:   row.created_at,
        }))
      )
    } catch (err) {
      console.error('[Analytics] load error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const resolved  = (stats?.ordered ?? 0) + (stats?.dismissed ?? 0)
  const convRate  = pct(stats?.ordered ?? 0, resolved)
  const convPct   = resolved > 0 ? Math.round(((stats?.ordered ?? 0) / resolved) * 100) : 0
  const hasData   = (stats?.total ?? 0) > 0
  const v = (key: keyof Stats) => loading ? '—' : String(stats?.[key] ?? 0)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text-primary]">Analytics</h1>
          <p className="text-sm text-[--color-text-secondary] mt-0.5">
            How ServeSync is driving orders at your restaurant
          </p>
        </div>
        <button
          onClick={() => void loadData()}
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

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── No data yet ──────────────────────────────────────────────────── */}
      {!loading && !error && !hasData && (
        <div className="mt-6 card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[--color-brand-muted] flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2a9 9 0 100 18A9 9 0 0011 2z" stroke="var(--color-brand)" strokeWidth="1.5"/>
              <path d="M11 7v5l3 2" stroke="var(--color-brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="font-semibold text-[--color-text-primary] mb-1">No guest requests tracked yet</p>
          <p className="text-sm text-[--color-text-secondary] max-w-xs mx-auto">
            Share your menu tap page with guests to start capturing interest and tracking ServeSync-assisted orders.
          </p>
        </div>
      )}

      {/* ── Guest activity stats ─────────────────────────────────────────── */}
      <SectionLabel label="Guest Activity" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Guest Requests"
          value={v('total')}
          subtext="All time"
        />
        <StatCard
          label="Awaiting Response"
          value={v('pending')}
          subtext="Still pending"
          accent
        />
        <StatCard
          label="Confirmed Orders"
          value={v('ordered')}
          subtext="Server confirmed"
        />
        <StatCard
          label="Dismissed"
          value={v('dismissed')}
          subtext="Not taken"
        />
      </div>

      {/* ── Conversion spotlight ─────────────────────────────────────────── */}
      <SectionLabel label="ServeSync-Assisted Orders" />
      <div className="card p-6 relative overflow-hidden">
        {/* Subtle brand tint */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(168,230,61,0.05) 0%, transparent 55%)' }}
        />
        <div className="relative">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-12 w-28 bg-[--color-surface-3] rounded" />
              <div className="h-3 w-56 bg-[--color-surface-3] rounded" />
              <div className="h-2.5 rounded-full bg-[--color-surface-3]" />
            </div>
          ) : resolved === 0 ? (
            <div className="text-center py-4">
              <p className="text-4xl font-black text-[--color-text-muted] mb-1">—</p>
              <p className="text-sm text-[--color-text-secondary]">
                No completed requests yet — confirm or dismiss a guest request to see your conversion rate.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-5 mb-4">
                <div>
                  <p className="text-5xl font-black text-[--color-brand] leading-none">
                    {convRate}
                  </p>
                  <p className="text-sm font-semibold text-[--color-text-primary] mt-1">
                    of completed guest requests became confirmed orders
                  </p>
                  <p className="text-xs text-[--color-text-muted] mt-0.5">
                    {stats?.ordered} confirmed orders · {stats?.dismissed} dismissed · {resolved} completed requests
                  </p>
                </div>
                {/* Mini donut visual */}
                <div className="shrink-0 ml-auto hidden sm:block">
                  <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                    <circle cx="32" cy="32" r="24" fill="none" stroke="var(--color-surface-3)" strokeWidth="8"/>
                    <circle
                      cx="32" cy="32" r="24"
                      fill="none"
                      stroke="var(--color-brand)"
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - convPct / 100)}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 700ms ease' }}
                    />
                  </svg>
                </div>
              </div>
              {/* Conversion bar */}
              <div className="h-2.5 rounded-full bg-[--color-surface-3] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[--color-brand] transition-all duration-700"
                  style={{ width: `${convPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-[--color-text-muted]">0%</span>
                <span className="text-xs text-[--color-brand] font-semibold">{convRate}</span>
                <span className="text-xs text-[--color-text-muted]">100%</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Top items — two columns ──────────────────────────────────────── */}
      <SectionLabel label="Top Items" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Most Requested (all guest interest) */}
        <div className="card overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-[--color-border]">
            <p className="text-sm font-semibold text-[--color-text-primary]">Most Requested</p>
            <p className="text-xs text-[--color-text-muted] mt-0.5">All guest interest, any outcome</p>
          </div>
          {loading
            ? <SkeletonRows count={4} />
            : <ItemBarList
                items={topRequested}
                accentCls="bg-[--color-brand]/50"
                emptyText="No requests yet"
              />
          }
        </div>

        {/* Top Confirmed Orders */}
        <div className="card overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-[--color-border]">
            <p className="text-sm font-semibold text-[--color-text-primary]">Top Confirmed Orders</p>
            <p className="text-xs text-[--color-text-muted] mt-0.5">Items servers marked ordered</p>
          </div>
          {loading
            ? <SkeletonRows count={4} />
            : <ItemBarList
                items={topOrdered}
                accentCls="bg-green-500/50"
                emptyText="No confirmed orders yet"
              />
          }
        </div>

      </div>

      {/* ── Recent activity feed ─────────────────────────────────────────── */}
      <SectionLabel label="Recent Activity" />
      <div className="card overflow-hidden">

        {loading && (
          <div className="animate-pulse divide-y divide-[--color-border]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-4">
                <div className="w-2 h-2 rounded-full bg-[--color-surface-3] mt-1.5 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-36 bg-[--color-surface-3] rounded" />
                  <div className="h-3 w-48 bg-[--color-surface-3] rounded" />
                </div>
                <div className="h-5 w-16 bg-[--color-surface-3] rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!loading && activity.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-[--color-text-muted]">
              No activity yet — requests will appear here as guests interact with your tap page.
            </p>
          </div>
        )}

        {!loading && activity.length > 0 && (
          <div className="divide-y divide-[--color-border]">
            {activity.map(item => {
              const badge = BADGE[item.status] ?? BADGE.dismissed
              const isPending = item.status === 'pending'
              return (
                <div key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                  {/* Status dot */}
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      isPending ? 'bg-[--color-brand] animate-pulse' : 'bg-[--color-surface-3]'
                    }`}
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[--color-text-primary] leading-snug truncate">
                      {item.itemName}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 mt-0.5 text-xs text-[--color-text-muted]">
                      {item.serverLabel && (
                        <span className="capitalize">{item.serverLabel}</span>
                      )}
                      {item.serverLabel && item.tableLabel && (
                        <span className="opacity-40">·</span>
                      )}
                      {item.tableLabel && (
                        <span>Table {item.tableLabel}</span>
                      )}
                      {(item.serverLabel || item.tableLabel) && (
                        <span className="opacity-40">·</span>
                      )}
                      <span>{timeAgo(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Badge */}
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer note when list is truncated */}
        {!loading && activity.length === 20 && (
          <div className="px-5 py-3 border-t border-[--color-border] text-center">
            <p className="text-xs text-[--color-text-muted]">Showing most recent 20 requests</p>
          </div>
        )}

      </div>

      {/* ── Coming next ──────────────────────────────────────────────────── */}
      <SectionLabel label="Coming Next" />
      <div className="card overflow-hidden mb-2">
        <div className="relative h-24 bg-[--color-surface-2] flex items-center justify-center border-b border-[--color-border]">
          <img
            src="/logos/servesync-brand-hero.png"
            alt=""
            className="absolute inset-0 w-full h-full object-contain p-6 opacity-[0.06] pointer-events-none select-none"
          />
          <div className="relative z-10 text-center px-4">
            <p className="text-xs font-semibold text-[--color-brand] uppercase tracking-widest mb-0.5">
              Expanding soon
            </p>
            <p className="text-sm font-medium text-[--color-text-secondary]">
              Tap rates, server performance &amp; campaign comparisons
            </p>
          </div>
        </div>
        <div className="px-5 py-3 grid grid-cols-2 gap-2">
          {['Taps over time', 'Clicks by item', 'Top server', 'Campaign A/B'].map(label => (
            <div key={label} className="flex items-center gap-2 text-xs text-[--color-text-muted]">
              <span className="w-1.5 h-1.5 rounded-full bg-[--color-brand] opacity-35 shrink-0" />
              {label}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
