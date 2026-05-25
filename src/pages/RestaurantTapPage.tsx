import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getSessionId } from '@/lib/utils'

// Checked once at module load — animations won't flash-in before the check runs
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Types ─────────────────────────────────────────────────────────────────────

interface Restaurant {
  id: string
  name: string
  logo_url: string | null
  address: string | null
}

type Category = 'appetizer' | 'drink' | 'top_seller' | 'daily_special' | 'upsell'

interface FeaturedItem {
  id: string
  name: string
  category: Category
  description: string | null
  price: number | null
  image_url: string | null
  // Promo / deal fields
  promo_label:    string | null
  original_price: number | null
  special_price:  number | null
  savings_text:   string | null
  // Social proof / scarcity fields
  rating:         number | null
  nightly_orders: number | null
  is_limited:     boolean | null
}

type PageState = 'loading' | 'ready' | 'not_found' | 'error'

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORY: Record<Category, {
  label: string; icon: string
  bg: string; color: string; border: string
}> = {
  appetizer:     { label: 'Appetizer',         icon: '🍽️', bg: '#2a1208', color: '#e8621a', border: '#e8621a28' },
  drink:         { label: 'Drink Special',     icon: '🍹', bg: '#0a2018', color: '#38c07a', border: '#38c07a28' },
  top_seller:    { label: 'Top Seller',        icon: '⭐',  bg: '#281e04', color: '#d4a017', border: '#d4a01728' },
  daily_special: { label: "Tonight's Special", icon: '✨', bg: '#241a04', color: '#c89020', border: '#c8902028' },
  upsell:        { label: 'Chef Recommends',   icon: '🔥', bg: '#280804', color: '#c43418', border: '#c4341828' },
}

const PLACEHOLDERS: Record<Category, { from: string; icon: string }> = {
  appetizer:     { from: '#2a1208', icon: '🍽️' },
  drink:         { from: '#0a2018', icon: '🍹' },
  top_seller:    { from: '#281e04', icon: '⭐'  },
  daily_special: { from: '#241a04', icon: '✨' },
  upsell:        { from: '#280804', icon: '🔥' },
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ServerBadge({ server }: { server: string }) {
  return (
    <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-[#352e1c] bg-[#18150d]">
      <div className="w-9 h-9 rounded-full bg-[#2a1208] border border-[#e8621a]/30 flex items-center justify-center text-sm font-black text-[#e8621a] shrink-0 select-none uppercase">
        {server.charAt(0)}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-[#7a6645] uppercase tracking-wider leading-none mb-0.5">
          Your server tonight
        </p>
        <p className="text-sm font-bold text-[#f5edd8] capitalize">
          {server} is serving you tonight
        </p>
      </div>
    </div>
  )
}

function TableBadge({ table }: { table: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2a1208] border border-[#e8621a]/30 text-[#e8621a] text-sm font-semibold">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
        <rect x="1" y="4" width="11" height="2" rx="1" fill="currentColor"/>
        <rect x="3" y="6" width="1.5" height="5" rx="0.75" fill="currentColor"/>
        <rect x="8.5" y="6" width="1.5" height="5" rx="0.75" fill="currentColor"/>
      </svg>
      Table {table}
    </div>
  )
}

function TableInput({
  value, onChange, onConfirm, hasError,
}: {
  value: string; onChange: (v: string) => void
  onConfirm: () => void; hasError: boolean
}) {
  return (
    <div className="w-full">
      <div className={[
        'flex items-center gap-2 rounded-xl border transition-colors',
        hasError ? 'border-red-500/40 bg-red-950/30' : 'border-[#e8621a]/30 bg-[#211d12]',
      ].join(' ')}>
        <span className="pl-3.5 text-[#e8621a]/50 shrink-0">
          <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
            <rect x="1" y="4" width="11" height="2" rx="1" fill="currentColor"/>
            <rect x="3" y="6" width="1.5" height="5" rx="0.75" fill="currentColor"/>
            <rect x="8.5" y="6" width="1.5" height="5" rx="0.75" fill="currentColor"/>
          </svg>
        </span>
        <input
          id="ss-table-input"
          type="text"
          inputMode="numeric"
          placeholder="What table are you at?"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onConfirm() }}
          className="flex-1 bg-transparent py-3 text-sm text-[#f5edd8] placeholder:text-[#7a6645] outline-none"
        />
        {value.trim() && (
          <button
            onClick={onConfirm}
            aria-label="Confirm table"
            className="mr-2 flex items-center justify-center w-7 h-7 rounded-lg bg-[#e8621a] text-white shrink-0 transition-transform active:scale-95"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
      {hasError && (
        <p className="text-xs text-red-400 mt-1.5 pl-1">
          Enter your table number to request items.
        </p>
      )}
    </div>
  )
}

function ImagePlaceholder({ category }: { category: Category }) {
  const ph = PLACEHOLDERS[category] ?? { from: '#2a1208', icon: '🍽️' }
  return (
    <div
      className="h-52 flex items-center justify-center"
      style={{ background: `linear-gradient(160deg, ${ph.from} 0%, #18150d 100%)` }}
    >
      <span className="text-7xl opacity-[0.10] select-none" aria-hidden="true">
        {ph.icon}
      </span>
    </div>
  )
}

function GoldDivider() {
  return (
    <div className="flex items-center gap-3 mb-7">
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #d4a017)' }} />
      <span className="text-[11px] font-bold text-[#d4a017] uppercase tracking-[0.18em] whitespace-nowrap">
        🔥 Featured Tonight
      </span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, #d4a017)' }} />
    </div>
  )
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item, requested, loading, onRequest, index = 0,
}: {
  item: FeaturedItem
  requested: boolean
  loading: boolean
  onRequest: (item: FeaturedItem) => void
  index?: number
}) {
  const meta    = CATEGORY[item.category] ?? { label: item.category, icon: '•', bg: '#2a1208', color: '#e8621a', border: '#e8621a28' }
  const isPromo = Boolean(item.promo_label)

  const displayPrice = item.special_price ?? item.price
  const crossedPrice = item.special_price != null ? (item.original_price ?? item.price) : null

  return (
    <div
      className={[
        'rounded-2xl border overflow-hidden',
        // hover lift (desktop) + tap scale (mobile) — both handled by CSS transition below
        'hover:-translate-y-0.5 active:scale-[0.98]',
        isPromo
          ? requested ? 'bg-[#211d12] border-[#d4a017]/50' : 'bg-[#1c1810] border-[#d4a017]/40'
          : requested ? 'bg-[#211d12] border-[#e8621a]/25' : 'bg-[#18150d] border-[#352e1c]',
      ].join(' ')}
      style={{
        transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
        animation: prefersReducedMotion
          ? 'none'
          : `ss-card-in 380ms ease-out ${index * 65 + 80}ms both`,
      }}
    >

      {/* ── Promo banner ──────────────────────────────────────────────────────── */}
      {isPromo && (
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-[#d4a017]/20"
          style={{ background: 'linear-gradient(135deg, #281e04 0%, #2a1208 100%)' }}
        >
          <div className="flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="#d4a017" aria-hidden="true">
              <path d="M6 0L7.3 4.7L12 6L7.3 7.3L6 12L4.7 7.3L0 6L4.7 4.7L6 0Z"/>
            </svg>
            <span className="text-xs font-bold text-[#d4a017] uppercase tracking-widest">
              {item.promo_label}
            </span>
          </div>
          {item.savings_text && (
            <span className="text-xs font-semibold text-[#e8621a]">
              {item.savings_text}
            </span>
          )}
        </div>
      )}

      {/* ── Image section with PNG overlays ───────────────────────────────────── */}
      <div className="relative">
        {item.image_url ? (
          <div className="h-52 overflow-hidden bg-[#2a2518]">
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <ImagePlaceholder category={item.category} />
        )}

        {/* Ribbon — top-left corner (clipped cleanly by card's overflow-hidden) */}
        {isPromo && item.savings_text && (
          <img
            src="/logos/servesync-ribbon.png"
            alt=""
            className="absolute top-0 left-0 w-[100px] z-20 pointer-events-none select-none"
            style={{
              animation: prefersReducedMotion
                ? 'none'
                : 'ss-ribbon-shimmer 10s ease-in-out infinite',
            }}
          />
        )}

        {/* Deal badge — top-right of image */}
        {isPromo && (
          <img
            src="/logos/servesync-deal-badge.png"
            alt="ServeSync Deal"
            className="absolute top-3 right-3 w-[88px] h-[88px] z-20 pointer-events-none select-none"
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
              animation: prefersReducedMotion
                ? 'none'
                : 'ss-badge-pulse 5.5s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* ── Card body ───────────────────────────────────────────────────────── */}
      <div className="p-6">

        {/* Category badge + price */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0"
            style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
          >
            {meta.icon} {meta.label}
          </span>

          {displayPrice != null && (
            <div className="flex flex-col items-end leading-none shrink-0 gap-0.5">
              {crossedPrice != null && (
                <span className="text-xs text-[#7a6645] line-through">
                  ${crossedPrice.toFixed(2)}
                </span>
              )}
              <span className="text-xl font-bold text-[#d4a017]">
                ${displayPrice.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Item name */}
        <h3 className="text-xl font-bold text-[#f5edd8] leading-snug mb-2">
          {item.name}
        </h3>

        {/* Description */}
        {item.description && (
          <p className="text-sm text-[#c4a87a] leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Stats chips — promo items only */}
        {isPromo && (item.rating != null || item.nightly_orders != null || item.is_limited) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-[#c4a87a]">
            {item.rating != null && (
              <span>⭐ <span className="font-semibold">{item.rating}</span></span>
            )}
            {item.nightly_orders != null && (
              <span>🔥 {item.nightly_orders} ordered tonight</span>
            )}
            {item.is_limited && (
              <span className="text-[#e8621a] font-semibold">⏰ Limited tonight</span>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-5">
          {requested ? (
            <div
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold border"
              style={isPromo
                ? { background: '#d4a01712', color: '#d4a017', borderColor: '#d4a01730' }
                : { background: '#e8621a12', color: '#e8621a', borderColor: '#e8621a30' }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2.5 7.5l3.5 3.5 6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {isPromo ? 'Special claimed!' : 'Request sent!'}
            </div>
          ) : (
            <button
              onClick={() => onRequest(item)}
              disabled={loading}
              className={[
                'w-full py-3.5 rounded-xl text-sm font-bold active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed',
                isPromo
                  ? 'bg-[#d4a017] hover:brightness-[1.06] text-[#0f0d08]'
                  : 'bg-[#e8621a] hover:brightness-[1.05] text-white',
              ].join(' ')}
              style={{
                transition: 'filter 180ms ease, box-shadow 180ms ease, transform 150ms ease',
                boxShadow: isPromo
                  ? '0 2px 10px rgba(212,160,23,0.18)'
                  : '0 2px 10px rgba(232,98,26,0.18)',
              }}
            >
              {loading ? 'Sending…' : isPromo ? 'Claim this special' : 'Request this item'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 inset-x-4 z-50 flex justify-center pointer-events-none">
      <div
        className="flex items-center gap-2.5 px-5 py-3.5 rounded-2xl max-w-sm w-full shadow-2xl"
        style={{
          background: '#18150d',
          border: '1px solid rgba(232, 98, 26, 0.3)',
          boxShadow: '0 0 32px rgba(232, 98, 26, 0.1)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
          <path d="M3 8l3.5 3.5L13 4" stroke="#e8621a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-sm font-medium text-[#f5edd8]">{message}</span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RestaurantTapPage() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>()
  const [searchParams] = useSearchParams()

  // ?table=12     — pre-set table (QR on table)
  // ?server=isaac — server who tapped (NFC bracelet)
  const table  = searchParams.get('table')
  const server = searchParams.get('server')

  const serverDisplay = server
    ? server.charAt(0).toUpperCase() + server.slice(1)
    : null

  const [pageState,   setPageState]   = useState<PageState>('loading')
  const [restaurant,  setRestaurant]  = useState<Restaurant | null>(null)
  const [items,       setItems]       = useState<FeaturedItem[]>([])
  const [requested,   setRequested]   = useState<Set<string>>(new Set())
  const [loadingItem, setLoadingItem] = useState<string | null>(null)
  const [toast,       setToast]       = useState<string | null>(null)
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)

  const [tableInput,   setTableInput]   = useState('')
  const [enteredTable, setEnteredTable] = useState<string | null>(null)
  const [tableError,   setTableError]   = useState(false)

  const effectiveTable = table ?? enteredTable

  useEffect(() => {
    if (restaurantSlug) load()
  }, [restaurantSlug])

  async function load() {
    setPageState('loading')
    setErrorMsg(null)

    try {
      const { data: rest, error: restErr } = await supabase
        .from('restaurants')
        .select('id, name, logo_url, address')
        .eq('slug', restaurantSlug!)
        .eq('active', true)
        .maybeSingle()

      if (restErr) throw restErr
      if (!rest) { setPageState('not_found'); return }

      const { data: itemData, error: itemErr } = await supabase
        .from('featured_items')
        .select(`
          id, name, category, description,
          price, image_url,
          promo_label, original_price, special_price, savings_text,
          rating, nightly_orders, is_limited
        `)
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

  function handleTableConfirm() {
    const trimmed = tableInput.trim()
    if (trimmed) {
      setEnteredTable(trimmed)
      setTableError(false)
    }
  }

  async function handleRequest(item: FeaturedItem) {
    if (!restaurant || loadingItem) return

    if (!effectiveTable) {
      setTableError(true)
      document.getElementById('ss-table-input')?.focus()
      return
    }

    setLoadingItem(item.id)

    try {
      await supabase.from('item_requests').insert({
        restaurant_id:    restaurant.id,
        featured_item_id: item.id,
        table_label:      effectiveTable,
        server_label:     server ?? null,
        status:           'pending',
      })
    } catch (err) {
      console.error('[TapPage] item_requests insert error:', err)
    }

    try {
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
    showToast(`"${item.name}" requested for Table ${effectiveTable}`)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  // ── Non-ready states ───────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-dvh bg-[#0f0d08] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#352e1c] border-t-[#e8621a] animate-spin" />
          <p className="text-xs text-[#7a6645]">Loading menu…</p>
        </div>
      </div>
    )
  }

  if (pageState === 'not_found') {
    return (
      <div className="min-h-dvh bg-[#0f0d08] flex flex-col items-center justify-center px-6 text-center gap-4">
        <img src="/logos/servesync-emblem.png" alt="ServeSync" className="w-14 h-14 object-contain opacity-20 mb-2"/>
        <h1 className="text-xl font-bold text-[#f5edd8]">Restaurant not found</h1>
        <p className="text-sm text-[#c4a87a] max-w-xs">
          This link doesn't match an active restaurant. Ask your server for the correct QR code.
        </p>
        <p className="text-xs text-[#7a6645] mt-4">
          Powered by <span className="text-[#a8e63d] font-medium">ServeSync</span>
        </p>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-dvh bg-[#0f0d08] flex flex-col items-center justify-center px-6 text-center gap-4">
        <h1 className="text-lg font-bold text-[#f5edd8]">Something went wrong</h1>
        <p className="text-sm text-[#c4a87a]">{errorMsg}</p>
        <button onClick={load} className="text-sm text-[#e8621a] hover:underline">Try again</button>
      </div>
    )
  }

  if (!restaurant) return null

  // ── Ready ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-[#0f0d08] ss-motion-root">

      {/* ── Full-width gradient hero ───────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Warm dark gradient */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, #2a1208 0%, #1c1208 40%, #18100a 70%, #0f0d08 100%)' }}
        />
        {/* Subtle dot texture */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(circle, #f5edd8 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        {/* Dark scrim — keeps text legible if a restaurant hero photo is ever added */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.55))' }}
        />
        {/* Bottom fade into page bg */}
        <div
          className="absolute bottom-0 inset-x-0 h-16"
          style={{ background: 'linear-gradient(to bottom, transparent, #0f0d08)' }}
        />

        {/* Centered hero content — safe-area aware top padding for iPhone */}
        <div
          className="relative z-10 max-w-lg mx-auto px-6 pb-16 flex flex-col items-center text-center"
          style={{
            paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
            animation: prefersReducedMotion ? 'none' : 'ss-fade-up 460ms ease-out both',
          }}
        >
          {/* Restaurant logo or initial */}
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-20 h-20 rounded-2xl object-contain border border-[#352e1c] bg-[#211d12] mb-7"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl bg-[#2a1208] border border-[#e8621a]/30 flex items-center justify-center text-3xl font-black text-[#e8621a] mb-7 tracking-tight select-none"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
            >
              {restaurant.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Restaurant name */}
          <h1
            className="text-[2rem] text-[#fff7e6] mb-3 px-2"
            style={{
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              textShadow: '0 1px 12px rgba(0,0,0,0.7)',
            }}
          >
            {restaurant.name}
          </h1>

          {/* Gold subtitle */}
          <p className="text-[11px] font-bold text-[#d4a017] uppercase tracking-[0.2em] mb-4">
            Tonight's Featured Menu
          </p>

          {/* Address */}
          {restaurant.address && (
            <p className="flex items-center gap-1.5 text-xs text-[#9a8060]">
              <svg width="10" height="12" viewBox="0 0 10 12" fill="none" className="shrink-0 opacity-70">
                <path d="M5 1C2.79 1 1 2.79 1 5c0 3 4 7 4 7s4-4 4-7c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <circle cx="5" cy="5" r="1.2" fill="currentColor"/>
              </svg>
              {restaurant.address}
            </p>
          )}
        </div>
      </div>

      {/* ── Context strip (server badge + table) ──────────────────────────── */}
      <div className="max-w-lg mx-auto px-5 pb-2 space-y-3">
        {serverDisplay && <ServerBadge server={serverDisplay} />}
        {effectiveTable
          ? <TableBadge table={effectiveTable} />
          : (
            <TableInput
              value={tableInput}
              onChange={setTableInput}
              onConfirm={handleTableConfirm}
              hasError={tableError}
            />
          )
        }
      </div>

      {/* ── Gold divider ──────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5 pt-5">
        <GoldDivider />
      </div>

      {/* ── Featured items ─────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5 pb-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-[#352e1c] bg-[#18150d] p-10 text-center">
            <p className="text-2xl mb-3">🍽️</p>
            <p className="font-semibold text-[#f5edd8] mb-1">No featured items right now</p>
            <p className="text-sm text-[#c4a87a]">Ask your server about tonight's specials.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {items.map((item, i) => (
              <ItemCard
                key={item.id}
                item={item}
                requested={requested.has(item.id)}
                loading={loadingItem === item.id}
                onRequest={handleRequest}
                index={i}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div
        className="max-w-lg mx-auto px-5 pt-4 flex items-center justify-center gap-2"
        style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <img src="/logos/servesync-emblem.png" alt="ServeSync" className="w-4 h-4 object-contain opacity-20"/>
        <p className="text-xs text-[#7a6645]">
          Powered by <span className="text-[#a8e63d]/55 font-medium">ServeSync</span>
        </p>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  )
}
