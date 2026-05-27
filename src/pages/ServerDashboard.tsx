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
  // silent=true  → background poll; never touches the loading skeleton so
  //               cards already on screen don't flash away.
  // silent=false → initial load; shows the skeleton until data arrives.

  const fetchIntents = useCallback(async (silent = false) => {
    if (!restaurantId) return
    if (!silent) setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('order_intents')
        .select(INTENT_SELECT)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      if (err) throw err

      const freshRows = (data ?? []) as unknown as OrderIntent[]

      if (!silent) {
        // Initial load — replace state directly; skeleton was shown.
        setIntents(freshRows)
      } else {
        // Background poll — merge by id so realtime-added rows that the
        // poll's SELECT missed (due to timing) are never silently dropped.
        //
        // Strategy:
        //   • Start with fresh DB rows (canonical order + latest status).
        //   • Append any prev rows whose id is absent from the DB result
        //     (realtime added them but the poll query ran before they committed).
        //   • Re-sort everything by created_at DESC.
        setIntents(prev => {
          const freshMap = new Map(freshRows.map(r => [r.id, r]))
          const prevMap  = new Map(prev.map(i => [i.id, i]))

          // Update existing or accept new rows from DB (DB has join data).
          const merged = freshRows.map(row => {
            const existing = prevMap.get(row.id)
            return {
              ...row,
              // Prefer DB-joined featured_items; fall back to what realtime
              // already stored in state (for the split-second before poll syncs).
              featured_items: row.featured_items ?? existing?.featured_items ?? null,
            } as OrderIntent
          })

          // Preserve rows realtime already added that DB poll missed.
          for (const prevRow of prev) {
            if (!freshMap.has(prevRow.id)) {
              merged.push(prevRow)
            }
          }

          // Restore created_at DESC sort.
          merged.sort((a, b) => b.created_at.localeCompare(a.created_at))
          return merged
        })
      }
    } catch (err) {
      console.error('[ServerDashboard] fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load requests.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [restaurantId])

  // Initial load (shows skeleton) + 10 s silent poll as fallback.
  // The poll never touches setLoading so it won't flash the skeleton.
  useEffect(() => {
    if (!restaurantId) return
    fetchIntents(false)
    const poll = setInterval(() => fetchIntents(true), 10_000)
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
          // Use payload.new directly — no secondary SELECT round-trip.
          //
          // The async re-fetch pattern caused two failure modes:
          //   1. The SELECT raced against a polling setIntents(replace) call;
          //      the dedup guard saw the id already present and dropped the row.
          //   2. Under load the SELECT returned null before the row was visible
          //      to reads, silently skipping the card.
          //
          // payload.new carries all raw columns. featured_items is a join, not
          // a column, so it's absent — we inherit it from any existing card
          // with the same item_id, which covers repeated requests for the same item.
          const raw   = payload.new as Record<string, unknown>
          const newId = raw.id as string

          if (import.meta.env.DEV) {
            console.log('[ServerDashboard] realtime INSERT received id:', newId)
          }

          setIntents(prev => {
            // Dedup strictly by id — two requests for the same item/table/server
            // are distinct rows and must both appear as separate cards.
            if (prev.some(i => i.id === newId)) {
              if (import.meta.env.DEV) {
                console.log('[ServerDashboard] realtime INSERT ignored duplicate id:', newId)
              }
              return prev
            }

            const existingForItem = prev.find(
              i => i.item_id === (raw.item_id as string)
            )

            const intent: OrderIntent = {
              id:            newId,
              restaurant_id: raw.restaurant_id as string,
              server_id:     (raw.server_id     as string | null) ?? null,
              server_label:  (raw.server_label  as string | null) ?? null,
              item_id:       raw.item_id         as string,
              tap_event_id:  (raw.tap_event_id  as string | null) ?? null,
              table_label:   (raw.table_label   as string | null) ?? null,
              status:        (raw.status         as IntentStatus) ?? 'pending',
              created_at:    raw.created_at      as string,
              updated_at:    raw.updated_at      as string,
              resolved_at:   (raw.resolved_at   as string | null) ?? null,
              resolved_by:   (raw.resolved_by   as string | null) ?? null,
              // Inherit from an existing same-item card; the 10 s poll will
              // replace this with a proper join value on the next cycle.
              featured_items: existingForItem?.featured_items ?? null,
            }

            if (import.meta.env.DEV) {
              console.log('[ServerDashboard] realtime INSERT added id:', newId)
            }
            return [intent, ...prev]
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
          // payload.new = raw columns only (no join). Spreading over the
          // existing intent preserves featured_items already in state.
          const updated = payload.new as Partial<OrderIntent> & { id: string }

          if (import.meta.env.DEV) {
            console.log('[ServerDashboard] realtime UPDATE received id:', updated.id, '→', updated.status)
          }

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
  // Truly optimistic: local state is updated BEFORE the DB write so the badge
  // flips instantly on click. If the DB call fails, we roll back to the
  // snapshot captured at the start of the function.
  //
  // The realtime UPDATE handler will also fire for other open tabs, keeping
  // them in sync without any extra work here.

  async function resolve(id: string, status: 'ordered' | 'dismissed') {
    setUpdating(id)
    const now = new Date().toISOString()

    // 1. Snapshot current state for rollback on error.
    // 2. Apply the status change immediately — badge flips right now.
    setIntents(prev =>
      prev.map(i =>
        i.id === id
          ? { ...i, status, resolved_at: now, resolved_by: user?.id ?? null }
          : i
      )
    )

    try {
      const { error: err } = await supabase
        .from('order_intents')
        .update({
          status,
          resolved_at: now,
          resolved_by: user?.id ?? null,
          // updated_at is set here so it matches the trigger value on other tabs
          updated_at: now,
        })
        .eq('id', id)

      if (err) throw err
      // Success — optimistic state already matches DB. Nothing more to do.
    } catch (err) {
      console.error('[ServerDashboard] resolve error:', err)
      // Roll back: re-fetch from DB so the card reflects actual server state.
      void fetchIntents(true)
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
            onClick={() => fetchIntents(false)}
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
