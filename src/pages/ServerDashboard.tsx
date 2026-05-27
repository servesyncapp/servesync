import { useEffect, useState, useCallback, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { AppShell, type NavItem } from '@/components/layout/AppShell'

// ── Types ─────────────────────────────────────────────────────────────────────

type IntentStatus = 'pending' | 'ordered' | 'dismissed' | 'expired'

interface OrderIntent {
  id:            string
  restaurant_id: string
  server_id:     string | null
  server_label:  string | null
  item_id:       string
  tap_event_id:  string | null
  table_label:   string | null
  status:        IntentStatus
  created_at:    string
  updated_at:    string
  resolved_at:   string | null
  resolved_by:   string | null
  featured_items: { name: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60)   return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

const STATUS_META: Record<IntentStatus, { label: string; badge: string }> = {
  pending: {
    label: 'Pending',
    badge: 'bg-[--color-brand]/15 text-[--color-brand] border border-[--color-brand]/30',
  },
  ordered: {
    label: 'Ordered',
    badge: 'bg-[--color-surface-3] text-[--color-text-secondary] border border-[--color-border]',
  },
  dismissed: {
    label: 'Dismissed',
    badge: 'bg-[--color-surface-3] text-[--color-text-muted] border border-[--color-border]',
  },
  expired: {
    label: 'Expired',
    badge: 'bg-[--color-surface-3] text-[--color-text-muted] border border-[--color-border]',
  },
}

// ── Nav ───────────────────────────────────────────────────────────────────────

const nav: NavItem[] = [
  {
    label: 'Requests',
    to: '/server',
    end: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1.5a4 4 0 014 4v2.5l1 1.5H3L4 8V5.5a4 4 0 014-4z"
          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
        />
        <path
          d="M6.5 12.5a1.5 1.5 0 003 0"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        />
      </svg>
    ),
  },
]

// ── SELECT fragment (keeps fetchIntents + realtime re-fetch in sync) ──────────

const INTENT_SELECT =
  'id, restaurant_id, server_id, server_label, item_id, tap_event_id, table_label, status, created_at, updated_at, resolved_at, resolved_by, featured_items(name)'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ServerDashboard() {
  const { user, restaurantId: authRestaurantId } = useAuth()

  // restaurantId may be null for server-only accounts (not in restaurant_users).
  // We resolve it via servers.user_id as a fallback.
  const [restaurantId, setRestaurantId] = useState<string | null>(authRestaurantId)

  const [intents,  setIntents]  = useState<OrderIntent[]>([])
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)

  // ── Restaurant ID resolution ───────────────────────────────────────────────
  // AuthProvider reads restaurant_id from restaurant_users. Server-only users
  // (in the servers table but not restaurant_users) get null there, so fall back.

  useEffect(() => {
    if (authRestaurantId) {
      setRestaurantId(authRestaurantId)
      return
    }
    if (!user?.id) return

    supabase
      .from('servers')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.restaurant_id) setRestaurantId(data.restaurant_id)
      })
  }, [user?.id, authRestaurantId])

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchIntents = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('order_intents')
        .select(INTENT_SELECT)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      if (err) throw err
      setIntents((data ?? []) as unknown as OrderIntent[])
    } catch (err) {
      console.error('[ServerDashboard] fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load requests.')
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  // Initial load + 10 s polling fallback (active even when realtime is live —
  // ensures stale data never sits longer than 10 s if the channel drops)
  useEffect(() => {
    if (!restaurantId) return
    fetchIntents()
    const poll = setInterval(fetchIntents, 10_000)
    return () => clearInterval(poll)
  }, [fetchIntents, restaurantId])

  // ── Realtime subscription ─────────────────────────────────────────────────
  // Listens for INSERT and UPDATE on order_intents filtered by restaurant_id.
  //
  // Prerequisites (run once in Supabase Dashboard):
  //   Database → Replication → Tables → toggle order_intents ON
  //   (The migration SQL also runs ALTER PUBLICATION supabase_realtime ADD TABLE
  //    and sets REPLICA IDENTITY FULL.)
  //
  // The 10 s poll above acts as a silent fallback if this channel fails.

  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`order_intents_${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'order_intents',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          // Re-fetch the new row with the join so we get featured_items.name
          const newId = (payload.new as { id: string }).id
          supabase
            .from('order_intents')
            .select(INTENT_SELECT)
            .eq('id', newId)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setIntents(prev => [data as unknown as OrderIntent, ...prev])
              }
            })
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'order_intents',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<OrderIntent> & { id: string }
          setIntents(prev =>
            prev.map(i => (i.id === updated.id ? { ...i, ...updated } : i))
          )
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [restaurantId])

  // ── Resolve ───────────────────────────────────────────────────────────────

  async function resolve(id: string, status: 'ordered' | 'dismissed') {
    setUpdating(id)
    try {
      const now = new Date().toISOString()

      const { error: err } = await supabase
        .from('order_intents')
        .update({
          status,
          resolved_at: now,
          resolved_by: user?.id ?? null,
          // updated_at is handled automatically by the DB trigger;
          // we set it here too so the optimistic update matches.
          updated_at: now,
        })
        .eq('id', id)

      if (err) throw err

      // Optimistic update — no re-fetch needed
      setIntents(prev =>
        prev.map(i =>
          i.id === id
            ? { ...i, status, resolved_at: now, resolved_by: user?.id ?? null }
            : i
        )
      )
    } catch (err) {
      console.error('[ServerDashboard] resolve error:', err)
    } finally {
      setUpdating(null)
    }
  }

  // ── Derived counts ────────────────────────────────────────────────────────

  const pendingCount = intents.filter(i => i.status === 'pending').length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell nav={nav} title="Server view">
      <div>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-2xl font-bold text-[--color-text-primary]">My Requests</h1>
            <p className="text-sm text-[--color-text-secondary] mt-0.5">
              Live item interest from your bracelet — newest first
            </p>
          </div>
          <button
            onClick={fetchIntents}
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

        {/* ── Pending pulse badge ──────────────────────────────────────────── */}
        {pendingCount > 0 && (
          <div className="mt-4 mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[--color-brand]/10 border border-[--color-brand]/25 text-[--color-brand] text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-[--color-brand] animate-pulse shrink-0" />
            {pendingCount} new item {pendingCount === 1 ? 'interest' : 'interests'}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* ── No restaurant linked ─────────────────────────────────────────── */}
        {!loading && !restaurantId && !error && (
          <div className="mt-4 p-4 rounded-xl bg-[--color-surface-2] border border-[--color-border] text-sm text-[--color-text-secondary]">
            Your account is not linked to a restaurant. Ask your manager to assign you.
          </div>
        )}

        {/* ── Skeleton ────────────────────────────────────────────────────── */}
        {loading && restaurantId && (
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

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!loading && !error && restaurantId && intents.length === 0 && (
          <div className="mt-6 card p-10 text-center">
            <img
              src="/logos/servesync-emblem.png"
              alt=""
              className="w-12 h-12 object-contain opacity-20 mx-auto mb-3"
            />
            <p className="font-semibold text-[--color-text-primary] mb-1">
              No pending item requests
            </p>
            <p className="text-sm text-[--color-text-secondary]">
              When a customer shows interest in an item from your bracelet, it will appear here.
            </p>
          </div>
        )}

        {/* ── Intent cards ─────────────────────────────────────────────────── */}
        {!loading && intents.length > 0 && (
          <div className="mt-4 space-y-3">
            {intents.map(intent => {
              const meta       = STATUS_META[intent.status] ?? STATUS_META.pending
              const isPending  = intent.status === 'pending'
              const isUpdating = updating === intent.id

              return (
                <div
                  key={intent.id}
                  className={[
                    'card p-5 transition-all duration-200',
                    isPending ? 'border-[--color-brand]/20' : 'opacity-60',
                  ].join(' ')}
                >
                  {/* Item name + status badge */}
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {isPending && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[--color-brand] animate-pulse shrink-0" />
                      )}
                      <p className="font-semibold text-[--color-text-primary] leading-snug">
                        {intent.featured_items?.name ?? 'Unknown item'}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${meta.badge}`}>
                      {meta.label}
                    </span>
                  </div>

                  {/* Meta row — source label, table, server, time */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-4 text-xs text-[--color-text-muted]">
                    <span className="flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M1.5 11c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      New item interest
                    </span>

                    {intent.table_label ? (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="flex items-center gap-1">
                          <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                            <rect x="1" y="4" width="11" height="2" rx="1" fill="currentColor"/>
                            <rect x="3" y="6" width="1.5" height="5" rx="0.75" fill="currentColor"/>
                            <rect x="8.5" y="6" width="1.5" height="5" rx="0.75" fill="currentColor"/>
                          </svg>
                          Table {intent.table_label}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="opacity-60">No table</span>
                      </>
                    )}

                    {intent.server_label && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="capitalize">{intent.server_label}</span>
                      </>
                    )}

                    <span className="opacity-40">·</span>
                    <span>{timeAgo(intent.created_at)}</span>
                  </div>

                  {/* Action buttons — pending only.
                      Structured so buttons can be replaced with a swipe UI later. */}
                  {isPending && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolve(intent.id, 'ordered')}
                        disabled={isUpdating}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[--color-brand] text-[--color-base] text-xs font-bold transition-all hover:bg-[--color-brand-dim] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {isUpdating ? 'Saving…' : 'Mark ordered'}
                      </button>
                      <button
                        onClick={() => resolve(intent.id, 'dismissed')}
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
    </AppShell>
  )
}
