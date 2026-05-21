import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getSessionId } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Restaurant {
  id: string
  name: string
  logo_url: string | null
}

type Category = 'appetizer' | 'drink' | 'top_seller' | 'daily_special' | 'upsell'

interface FeaturedItem {
  id: string
  name: string
  category: Category
  description: string | null
  price: number | null
  image_url: string | null
}

type PageState = 'loading' | 'ready' | 'not_found' | 'error'

// ── Category labels ────────────────────────────────────────────────────────────

const CATEGORY: Record<Category, { label: string; icon: string }> = {
  appetizer:     { label: 'Starter',       icon: '🥗' },
  drink:         { label: 'Drink Special', icon: '🍹' },
  top_seller:    { label: 'Top Seller',    icon: '⭐' },
  daily_special: { label: "Today's Special", icon: '✨' },
  upsell:        { label: 'Chef Recommends', icon: '🔥' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TableBadge({ table }: { table: string | null }) {
  if (table) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[--color-brand]/15 border border-[--color-brand]/30 text-[--color-brand] text-sm font-semibold">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
          <rect x="1" y="4" width="11" height="2" rx="1" fill="currentColor"/>
          <rect x="3" y="6" width="1.5" height="5" rx="0.75" fill="currentColor"/>
          <rect x="8.5" y="6" width="1.5" height="5" rx="0.75" fill="currentColor"/>
        </svg>
        Table {table}
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[--color-surface-3] border border-[--color-border] text-[--color-text-muted] text-xs">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M6 4v2.5M6 8h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      Table not selected
    </div>
  )
}

function ItemCard({
  item,
  requested,
  loading,
  onRequest,
}: {
  item: FeaturedItem
  requested: boolean
  loading: boolean
  onRequest: (item: FeaturedItem) => void
}) {
  const meta = CATEGORY[item.category] ?? { label: item.category, icon: '•' }

  return (
    <div
      className={[
        'rounded-2xl border overflow-hidden transition-all duration-200',
        requested
          ? 'bg-[--color-surface-2] border-[--color-brand]/30'
          : 'bg-[--color-surface-1] border-[--color-border]',
      ].join(' ')}
    >
      {/* Item image */}
      {item.image_url && (
        <div className="h-44 overflow-hidden bg-[--color-surface-3]">
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-5">
        {/* Category + price row */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[--color-brand-muted] text-[--color-brand] border border-[--color-brand]/20">
            {meta.icon} {meta.label}
          </span>
          {item.price != null && (
            <span className="text-base font-bold text-[--color-brand]">
              ${item.price.toFixed(2)}
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="text-lg font-bold text-[--color-text-primary] leading-snug mb-1.5">
          {item.name}
        </h3>

        {/* Description */}
        {item.description && (
          <p className="text-sm text-[--color-text-secondary] leading-relaxed mb-5">
            {item.description}
          </p>
        )}

        {/* CTA */}
        {requested ? (
          <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[--color-brand]/10 border border-[--color-brand]/25 text-[--color-brand] text-sm font-semibold">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M2.5 7.5l3.5 3.5 6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Request sent!
          </div>
        ) : (
          <button
            onClick={() => onRequest(item)}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[--color-brand] text-[--color-base] text-sm font-bold transition-all duration-150 hover:bg-[--color-brand-dim] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending…' : 'Request this item'}
          </button>
        )}
      </div>
    </div>
  )
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 inset-x-4 z-50 flex justify-center pointer-events-none">
      <div
        className="flex items-center gap-2.5 px-5 py-3.5 rounded-2xl max-w-sm w-full shadow-2xl"
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid rgba(168, 230, 61, 0.25)',
          boxShadow: '0 0 32px rgba(168, 230, 61, 0.12)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
          <path d="M3 8l3.5 3.5L13 4" stroke="#a8e63d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-sm font-medium text-[--color-text-primary]">{message}</span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RestaurantTapPage() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>()
  const [searchParams] = useSearchParams()
  const table = searchParams.get('table')

  const [pageState, setPageState]   = useState<PageState>('loading')
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [items, setItems]           = useState<FeaturedItem[]>([])
  const [requested, setRequested]   = useState<Set<string>>(new Set())
  const [loadingItem, setLoadingItem] = useState<string | null>(null)
  const [toast, setToast]           = useState<string | null>(null)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)

  useEffect(() => {
    if (restaurantSlug) load()
  }, [restaurantSlug])

  async function load() {
    setPageState('loading')
    setErrorMsg(null)

    try {
      // 1. Look up restaurant by slug
      const { data: rest, error: restErr } = await supabase
        .from('restaurants')
        .select('id, name, logo_url')
        .eq('slug', restaurantSlug!)
        .eq('active', true)
        .maybeSingle()

      if (restErr) throw restErr
      if (!rest) { setPageState('not_found'); return }

      // 2. Load active featured items
      const { data: itemData, error: itemErr } = await supabase
        .from('featured_items')
        .select('id, name, category, description, price, image_url')
        .eq('restaurant_id', rest.id)
        .eq('active', true)
        .order('sort_order', { ascending: true })

      if (itemErr) throw itemErr

      setRestaurant(rest as Restaurant)
      setItems((itemData ?? []) as FeaturedItem[])
      setPageState('ready')
    } catch (err) {
      console.error('[TapPage] load error:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.')
      setPageState('error')
    }
  }

  async function handleRequest(item: FeaturedItem) {
    if (!restaurant || loadingItem) return
    setLoadingItem(item.id)

    try {
      // Primary record — drives the manager's Requests dashboard
      await supabase.from('item_requests').insert({
        restaurant_id:    restaurant.id,
        featured_item_id: item.id,
        table_label:      table ?? null,
        status:           'pending',
      })
    } catch (err) {
      console.error('[TapPage] item_requests insert error:', err)
      // Non-fatal — still show success UI
    }

    try {
      // Analytics click event (separate from the request record)
      await supabase.from('click_events').insert({
        restaurant_id:    restaurant.id,
        featured_item_id: item.id,
        action:           'want_this',
        session_id:       getSessionId(),
      })
    } catch (err) {
      console.error('[TapPage] click event error:', err)
    }

    setRequested(prev => new Set([...prev, item.id]))
    setLoadingItem(null)

    const tableText = table ? `Table ${table}` : 'your table'
    showToast(`"${item.name}" requested for ${tableText}`)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-dvh bg-[--color-base] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[--color-border] border-t-[--color-brand] animate-spin" />
          <p className="text-xs text-[--color-text-muted]">Loading menu…</p>
        </div>
      </div>
    )
  }

  // ── Not found ─────────────────────────────────────────────────────────────

  if (pageState === 'not_found') {
    return (
      <div className="min-h-dvh bg-[--color-base] flex flex-col items-center justify-center px-6 text-center gap-4">
        <img
          src="/logos/servesync-emblem.png"
          alt="ServeSync"
          className="w-14 h-14 object-contain opacity-25 mb-2"
        />
        <h1 className="text-xl font-bold text-[--color-text-primary]">Restaurant not found</h1>
        <p className="text-sm text-[--color-text-secondary] max-w-xs">
          This link doesn't match an active restaurant. Ask your server for the correct QR code.
        </p>
        <p className="text-xs text-[--color-text-muted] mt-4">
          Powered by{' '}
          <span className="text-[--color-brand] font-medium">ServeSync</span>
        </p>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (pageState === 'error') {
    return (
      <div className="min-h-dvh bg-[--color-base] flex flex-col items-center justify-center px-6 text-center gap-4">
        <h1 className="text-lg font-bold text-[--color-text-primary]">Something went wrong</h1>
        <p className="text-sm text-[--color-text-secondary]">{errorMsg}</p>
        <button
          onClick={load}
          className="text-sm text-[--color-brand] hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

  if (!restaurant) return null

  return (
    <div className="min-h-dvh bg-[--color-base]">

      {/* ── Restaurant header ──────────────────────────────────────────────── */}
      <div className="bg-[--color-surface-1] border-b border-[--color-border]">
        <div className="max-w-lg mx-auto px-5 pt-8 pb-6">

          {/* Logo + name */}
          <div className="flex items-center gap-4 mb-5">
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="w-14 h-14 rounded-2xl object-contain border border-[--color-border] bg-[--color-surface-2] shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-[--color-brand-muted] border border-[--color-brand]/20 flex items-center justify-center text-2xl font-black text-[--color-brand] shrink-0 tracking-tight">
                {restaurant.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black text-[--color-text-primary] leading-tight tracking-tight">
                {restaurant.name}
              </h1>
              <p className="text-sm text-[--color-text-secondary] mt-0.5">
                Tonight's featured menu
              </p>
            </div>
          </div>

          {/* Table indicator */}
          <TableBadge table={table} />
        </div>
      </div>

      {/* ── Featured items ─────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5 py-6 space-y-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-[--color-border] bg-[--color-surface-1] p-10 text-center">
            <p className="text-2xl mb-3">🍽️</p>
            <p className="font-semibold text-[--color-text-primary] mb-1">
              No featured items right now
            </p>
            <p className="text-sm text-[--color-text-secondary]">
              Ask your server about tonight's specials.
            </p>
          </div>
        ) : (
          items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              requested={requested.has(item.id)}
              loading={loadingItem === item.id}
              onRequest={handleRequest}
            />
          ))
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5 pt-2 pb-10 flex items-center justify-center gap-2">
        <img
          src="/logos/servesync-emblem.png"
          alt="ServeSync"
          className="w-4 h-4 object-contain opacity-30"
        />
        <p className="text-xs text-[--color-text-muted]">
          Powered by{' '}
          <span className="text-[--color-brand]/70 font-medium">ServeSync</span>
        </p>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  )
}
