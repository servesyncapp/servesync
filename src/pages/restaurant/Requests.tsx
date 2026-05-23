import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

type RequestStatus = 'pending' | 'ordered' | 'dismissed'

interface ItemRequest {
  id: string
  featured_item_id: string | null
  table_label: string | null
  server_label: string | null
  status: RequestStatus
  ordered_at: string | null
  created_at: string
  featured_items: { name: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60)   return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

const STATUS: Record<RequestStatus, { label: string; badge: string }> = {
  pending:   {
    label: 'Pending',
    badge: 'bg-[--color-brand]/15 text-[--color-brand] border border-[--color-brand]/30',
  },
  ordered:   {
    label: 'Ordered',
    badge: 'bg-[--color-surface-3] text-[--color-text-secondary] border border-[--color-border]',
  },
  dismissed: {
    label: 'Dismissed',
    badge: 'bg-[--color-surface-3] text-[--color-text-muted] border border-[--color-border]',
  },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Requests() {
  const { restaurantId } = useAuth()
  const [requests, setRequests] = useState<ItemRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('item_requests')
        .select('id, featured_item_id, table_label, server_label, status, ordered_at, created_at, featured_items(name)')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      if (err) throw err
      setRequests((data ?? []) as unknown as ItemRequest[])
    } catch (err) {
      console.error('[Requests] fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load requests.')
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  async function updateStatus(id: string, status: RequestStatus) {
    setUpdating(id)
    try {
      const patch: { status: RequestStatus; ordered_at?: string } = { status }
      if (status === 'ordered') patch.ordered_at = new Date().toISOString()

      const { error: err } = await supabase
        .from('item_requests')
        .update(patch)
        .eq('id', id)

      if (err) throw err

      // Optimistic update — no re-fetch needed
      setRequests(prev =>
        prev.map(r => r.id === id ? { ...r, ...patch } : r)
      )
    } catch (err) {
      console.error('[Requests] update error:', err)
    } finally {
      setUpdating(null)
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  // ── Loading ───────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text-primary]">Requests</h1>
          <p className="text-sm text-[--color-text-secondary] mt-0.5">
            Customer item requests — newest first
          </p>
        </div>
        <button
          onClick={fetchRequests}
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

      {/* Pending pulse badge */}
      {pendingCount > 0 && (
        <div className="mt-4 mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[--color-brand]/10 border border-[--color-brand]/25 text-[--color-brand] text-sm font-semibold">
          <span className="w-2 h-2 rounded-full bg-[--color-brand] animate-pulse shrink-0" />
          {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex items-start justify-between mb-3">
                <div className="h-4 w-40 bg-[--color-surface-3] rounded" />
                <div className="h-5 w-16 bg-[--color-surface-3] rounded-full" />
              </div>
              <div className="h-3 w-24 bg-[--color-surface-3] rounded mb-4" />
              <div className="flex gap-2">
                <div className="h-8 w-28 bg-[--color-surface-3] rounded-lg" />
                <div className="h-8 w-20 bg-[--color-surface-3] rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && requests.length === 0 && (
        <div className="mt-6 card p-10 text-center">
          <p className="text-3xl mb-3">🔔</p>
          <p className="font-semibold text-[--color-text-primary] mb-1">No requests yet</p>
          <p className="text-sm text-[--color-text-secondary]">
            When customers tap and request an item, it will appear here.
          </p>
        </div>
      )}

      {/* Request cards */}
      {!loading && requests.length > 0 && (
        <div className="mt-4 space-y-3">
          {requests.map(req => {
            const meta       = STATUS[req.status]
            const isPending  = req.status === 'pending'
            const isUpdating = updating === req.id

            return (
              <div
                key={req.id}
                className={[
                  'card p-5 transition-all duration-200',
                  isPending ? 'border-[--color-brand]/20' : 'opacity-60',
                ].join(' ')}
              >
                {/* Item name + status badge */}
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <p className="font-semibold text-[--color-text-primary] leading-snug">
                    {req.featured_items?.name ?? 'Unknown item'}
                  </p>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${meta.badge}`}>
                    {meta.label}
                  </span>
                </div>

                {/* Meta row: Table · Server · time */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-4 text-xs text-[--color-text-muted]">
                  {req.table_label ? (
                    <span className="flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                        <rect x="1" y="4" width="11" height="2" rx="1" fill="currentColor"/>
                        <rect x="3" y="6" width="1.5" height="5" rx="0.75" fill="currentColor"/>
                        <rect x="8.5" y="6" width="1.5" height="5" rx="0.75" fill="currentColor"/>
                      </svg>
                      Table {req.table_label}
                    </span>
                  ) : (
                    <span className="opacity-60">No table</span>
                  )}
                  {req.server_label && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.2"/>
                          <path d="M1.5 11c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                        Server {req.server_label.charAt(0).toUpperCase() + req.server_label.slice(1)}
                      </span>
                    </>
                  )}
                  <span className="opacity-40">·</span>
                  <span>{timeAgo(req.created_at)}</span>
                </div>

                {/* Action buttons (pending only) */}
                {isPending && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(req.id, 'ordered')}
                      disabled={isUpdating}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[--color-brand] text-[--color-base] text-xs font-bold transition-all hover:bg-[--color-brand-dim] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {isUpdating ? 'Saving…' : 'Mark ordered'}
                    </button>
                    <button
                      onClick={() => updateStatus(req.id, 'dismissed')}
                      disabled={isUpdating}
                      className="px-3.5 py-2 rounded-lg border border-[--color-border] text-xs font-medium text-[--color-text-secondary] hover:text-[--color-text-primary] hover:border-[--color-text-muted]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
