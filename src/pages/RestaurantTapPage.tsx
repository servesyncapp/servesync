import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getSessionId } from '@/lib/utils'

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
}

type PageState = 'loading' | 'ready' | 'not_found' | 'error'

// ── Category config ────────────────────────────────────────────────────────────
// Per-category warm accent colours — drives the badge on each item card.

const CATEGORY: Record<Category, {
  label: string
  icon: string
  bg: string
  color: string
  border: string
}> = {
  appetizer:     { label: 'Appetizer',         icon: '🍽️', bg: '#2a1208', color: '#e8621a', border: '#e8621a28' },
  drink:         { label: 'Drink Special',     icon: '🍹', bg: '#0a2018', color: '#38c07a', border: '#38c07a28' },
  top_seller:    { label: 'Top Seller',        icon: '⭐',  bg: '#281e04', color: '#d4a017', border: '#d4a01728' },
  daily_special: { label: "Tonight's Special", icon: '✨', bg: '#241a04', color: '#c89020', border: '#c8902028' },
  upsell:        { label: 'Chef Recommends',   icon: '🔥', bg: '#280804', color: '#c43418', border: '#c4341828' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ServerBadge({ server }: { server: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2a2518] border border-[#352e1c] text-[#c4a87a] text-xs font-medium">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
        <circle cx="6" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M1.5 11c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      Server: {server}
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
  value,
  onChange,
  onConfirm,
  hasError,
}: {
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  hasError: boolean
}) {
  return (
    <div className="w-full">
      <div
        className={[
          'flex items-center gap-2 rounded-xl border transition-colors',
          hasError
            ? 'border-red-500/40 bg-red-950/30'
            : 'border-[#e8621a]/30 bg-[#211d12]',
        ].join(' ')}
      >
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
  const meta = CATEGORY[item.category] ?? {
    label: item.category, icon: '•',
    bg: '#2a1208', color: '#e8621a', border: '#e8621a28',
  }

  return (
    <div
      className={[
        'rounded-2xl border overflow-hidden transition-all duration-200',
        requested
          ? 'bg-[#211d12] border-[#e8621a]/25'
          : 'bg-[#18150d] border-[#352e1c]',
      ].join(' ')}
    >
      {/* Item image */}
      {item.image_url && (
        <div className="h-48 overflow-hidden bg-[#2a2518]">
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-6">
        {/* Category badge + price */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
            style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
          >
            {meta.icon} {meta.label}
          </span>
          {item.price != null && (
            <span className="text-xl font-bold text-[#d4a017]">
              ${item.price.toFixed(2)}
            </span>
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

        {/* CTA */}
        <div className="mt-5">
          {requested ? (
            <div
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold border"
              style={{ background: '#e8621a12', color: '#e8621a', borderColor: '#e8621a30' }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2.5 7.5l3.5 3.5 6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Request sent!
            </div>
          ) : (
            <button
              onClick={() => onRequest(item)}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#e8621a] hover:bg-[#c4501a] text-white text-sm font-bold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Request this item'}
            </button>
          )}
        </div>
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
          background: '#18150d',
          border: '1px solid rgba(232, 98, 26, 0.3)',
          boxShadow: '0 0 32px rgba(232, 98, 26, 0.12)',
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

  // ── URL params ────────────────────────────────────────────────────────────
  // ?table=12     — pre-set table (e.g. QR code on a table)
  // ?server=isaac — server who tapped (NFC bracelet)
  const table  = searchParams.get('table')
  const server = searchParams.get('server')

  const serverDisplay = server
    ? server.charAt(0).toUpperCase() + server.slice(1)
    : null

  // ── Page state ────────────────────────────────────────────────────────────
  const [pageState,    setPageState]   = useState<PageState>('loading')
  const [restaurant,   setRestaurant]  = useState<Restaurant | null>(null)
  const [items,        setItems]       = useState<FeaturedItem[]>([])
  const [requested,    setRequested]   = useState<Set<string>>(new Set())
  const [loadingItem,  setLoadingItem] = useState<string | null>(null)
  const [toast,        setToast]       = useState<string | null>(null)
  const [errorMsg,     setErrorMsg]    = useState<string | null>(null)

  // Table input — used when ?table= is absent
  const [tableInput,   setTableInput]  = useState('')
  const [enteredTable, setEnteredTable] = useState<string | null>(null)
  const [tableError,   setTableError]  = useState(false)

  // URL param wins; customer-typed value is the fallback
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

  // ── Loading ───────────────────────────────────────────────────────────────

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

  // ── Not found ─────────────────────────────────────────────────────────────

  if (pageState === 'not_found') {
    return (
      <div className="min-h-dvh bg-[#0f0d08] flex flex-col items-center justify-center px-6 text-center gap-4">
        <img
          src="/logos/servesync-emblem.png"
          alt="ServeSync"
          className="w-14 h-14 object-contain opacity-20 mb-2"
        />
        <h1 className="text-xl font-bold text-[#f5edd8]">Restaurant not found</h1>
        <p className="text-sm text-[#c4a87a] max-w-xs">
          This link doesn't match an active restaurant. Ask your server for the correct QR code.
        </p>
        <p className="text-xs text-[#7a6645] mt-4">
          Powered by{' '}
          <span className="text-[#a8e63d] font-medium">ServeSync</span>
        </p>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (pageState === 'error') {
    return (
      <div className="min-h-dvh bg-[#0f0d08] flex flex-col items-center justify-center px-6 text-center gap-4">
        <h1 className="text-lg font-bold text-[#f5edd8]">Something went wrong</h1>
        <p className="text-sm text-[#c4a87a]">{errorMsg}</p>
        <button
          onClick={load}
          className="text-sm text-[#e8621a] hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

  if (!restaurant) return null

  return (
    <div className="min-h-dvh bg-[#0f0d08]">

      {/* ── Hero header ────────────────────────────────────────────────────── */}
      <div className="bg-[#18150d] border-b border-[#352e1c]">
        <div className="max-w-lg mx-auto px-5 pt-8 pb-6">

          {/* Logo + name + address */}
          <div className="flex items-start gap-4 mb-5">
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="w-16 h-16 rounded-2xl object-contain border border-[#352e1c] bg-[#211d12] shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#2a1208] border border-[#e8621a]/20 flex items-center justify-center text-2xl font-black text-[#e8621a] shrink-0 tracking-tight select-none">
                {restaurant.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <h1 className="text-2xl font-black text-[#f5edd8] leading-tight tracking-tight">
                {restaurant.name}
              </h1>
              <p className="text-sm text-[#c4a87a] mt-0.5">
                Tonight's Featured Menu
              </p>
              {restaurant.address && (
                <p className="flex items-center gap-1 text-xs text-[#7a6645] mt-1.5">
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="none" className="shrink-0">
                    <path d="M5 1C2.79 1 1 2.79 1 5c0 3 4 7 4 7s4-4 4-7c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                    <circle cx="5" cy="5" r="1.2" fill="currentColor"/>
                  </svg>
                  {restaurant.address}
                </p>
              )}
            </div>
          </div>

          {/* Server + table context badges */}
          {(serverDisplay || effectiveTable) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {serverDisplay  && <ServerBadge server={serverDisplay} />}
              {effectiveTable && <TableBadge  table={effectiveTable} />}
            </div>
          )}

          {/* Table input — shown until a table is confirmed */}
          {!effectiveTable && (
            <TableInput
              value={tableInput}
              onChange={setTableInput}
              onConfirm={handleTableConfirm}
              hasError={tableError}
            />
          )}

        </div>
      </div>

      {/* ── Item list ──────────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5 py-6">

        {/* Section label */}
        {items.length > 0 && (
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#352e1c]" />
            <p className="text-[11px] text-[#7a6645] uppercase tracking-widest font-semibold">
              Featured Tonight
            </p>
            <div className="flex-1 h-px bg-[#352e1c]" />
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-[#352e1c] bg-[#18150d] p-10 text-center">
            <p className="text-2xl mb-3">🍽️</p>
            <p className="font-semibold text-[#f5edd8] mb-1">No featured items right now</p>
            <p className="text-sm text-[#c4a87a]">Ask your server about tonight's specials.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                requested={requested.has(item.id)}
                loading={loadingItem === item.id}
                onRequest={handleRequest}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer — ServeSync branding, kept subtle ───────────────────────── */}
      <div className="max-w-lg mx-auto px-5 pt-4 pb-12 flex items-center justify-center gap-2">
        <img
          src="/logos/servesync-emblem.png"
          alt="ServeSync"
          className="w-4 h-4 object-contain opacity-25"
        />
        <p className="text-xs text-[#7a6645]">
          Powered by{' '}
          <span className="text-[#a8e63d]/60 font-medium">ServeSync</span>
        </p>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  )
}
