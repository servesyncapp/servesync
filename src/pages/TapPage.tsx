import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getSessionId } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

// ── Types ────────────────────────────────────────────────────────────────────

interface Restaurant { id: string; name: string; logo_url: string | null }
interface Server     { id: string; name: string }

interface FeaturedItem {
  id: string
  name: string
  description: string | null
  price: number | null
  image_url: string | null
  category: 'appetizer' | 'drink' | 'top_seller' | 'daily_special' | 'upsell'
}

interface TapContext {
  braceletDbId: string
  serverId: string
  restaurant: Restaurant
  server: Server
  items: FeaturedItem[]
  tapEventId: string
}

type ClickAction = 'want_this' | 'ask_server' | 'join_rewards'
type PageState   = 'loading' | 'ready' | 'not_found'

// ── Category display map ─────────────────────────────────────────────────────

const CATEGORY: Record<FeaturedItem['category'], { label: string; icon: string }> = {
  appetizer:    { label: 'Featured Starter',   icon: '🥗' },
  drink:        { label: 'Drink Special',      icon: '🍹' },
  top_seller:   { label: "Chef's Top Seller",  icon: '⭐' },
  daily_special:{ label: "Today's Special",    icon: '✨' },
  upsell:       { label: 'You\'ll Love This',  icon: '🔥' },
}

// ── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  sent,
  loading,
  onAction,
}: {
  item: FeaturedItem
  sent: boolean
  loading: boolean
  onAction: (item: FeaturedItem, action: ClickAction) => void
}) {
  const meta = CATEGORY[item.category]

  return (
    <div className="card overflow-hidden relative">
      {sent && (
        <div className="absolute inset-0 z-10 bg-[--color-base]/75 backdrop-blur-sm rounded-[--radius-card] flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-2 card">
            <span className="text-[--color-brand] font-bold">✓</span>
            <span className="text-sm font-medium text-[--color-text-primary]">Request sent</span>
          </div>
        </div>
      )}

      {item.image_url && (
        <div className="h-40 overflow-hidden bg-[--color-surface-3]">
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="brand">{meta.icon} {meta.label}</Badge>
          {item.price != null && (
            <span className="text-sm font-semibold text-[--color-brand]">${item.price.toFixed(2)}</span>
          )}
        </div>

        <h3 className="font-bold text-[--color-text-primary] text-lg mb-1">{item.name}</h3>
        {item.description && (
          <p className="text-sm text-[--color-text-secondary] leading-relaxed mb-4">{item.description}</p>
        )}

        <div className="flex flex-col gap-2">
          <Button fullWidth loading={loading} onClick={() => onAction(item, 'want_this')}>
            I want this
          </Button>
          <Button fullWidth variant="outline" disabled={loading} onClick={() => onAction(item, 'ask_server')}>
            Ask my server
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Rewards modal ────────────────────────────────────────────────────────────

function RewardsModal({
  restaurant,
  braceletDbId,
  onClose,
}: {
  restaurant: Restaurant
  braceletDbId: string
  onClose: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('rewards_customers').insert({
      restaurant_id: restaurant.id,
      email: email.toLowerCase().trim(),
      first_name: firstName.trim() || null,
      source_bracelet_id: braceletDbId,
    })
    setLoading(false)
    setDone(true)
    setTimeout(onClose, 2200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="card w-full max-w-sm p-6">
        {done ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="font-bold text-lg text-[--color-text-primary]">You're in!</h3>
            <p className="text-sm text-[--color-text-secondary] mt-1">Welcome to {restaurant.name} rewards.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-bold text-lg text-[--color-text-primary]">Join Rewards</h3>
                <p className="text-xs text-[--color-text-muted] mt-0.5">{restaurant.name}</p>
              </div>
              <button
                onClick={onClose}
                className="text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors ml-4 mt-0.5"
              >
                ✕
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <input
                className="input"
                type="text"
                placeholder="First name (optional)"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
              <input
                className="input"
                type="email"
                required
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <p className="text-xs text-[--color-text-muted]">
                We'll only send you offers from {restaurant.name}.
              </p>
              <Button type="submit" fullWidth loading={loading}>Join rewards</Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 inset-x-4 z-50 flex justify-center pointer-events-none">
      <div className="card brand-glow border-[--color-brand]/25 px-5 py-3 flex items-center gap-2 max-w-sm w-full">
        <span className="text-[--color-brand]">✓</span>
        <span className="text-sm text-[--color-text-primary]">{message}</span>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function TapPage() {
  const { braceletId } = useParams<{ braceletId: string }>()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [ctx, setCtx] = useState<TapContext | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [sentItems, setSentItems] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [showRewards, setShowRewards] = useState(false)

  useEffect(() => { if (braceletId) load() }, [braceletId])

  async function load() {
    const { data: bracelet } = await supabase
      .from('nfc_bracelets')
      .select(`
        id, bracelet_code, server_id, restaurant_id,
        servers ( id, name ),
        restaurants ( id, name, logo_url )
      `)
      .eq('bracelet_code', braceletId!)
      .eq('active', true)
      .maybeSingle()

    if (!bracelet) { setPageState('not_found'); return }

    const restaurant = Array.isArray(bracelet.restaurants)
      ? bracelet.restaurants[0] : bracelet.restaurants as Restaurant
    const server = Array.isArray(bracelet.servers)
      ? bracelet.servers[0] : bracelet.servers as Server

    if (!restaurant || !server) { setPageState('not_found'); return }

    // Log tap (non-blocking)
    const tapPromise = supabase
      .from('tap_events')
      .insert({
        bracelet_id:   bracelet.id,
        server_id:     bracelet.server_id,
        restaurant_id: bracelet.restaurant_id,
        session_id:    getSessionId(),
        user_agent:    navigator.userAgent,
      })
      .select('id')
      .single()

    const { data: items } = await supabase
      .from('featured_items')
      .select('id, name, description, price, image_url, category')
      .eq('restaurant_id', bracelet.restaurant_id)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .limit(6)

    const { data: tapRow } = await tapPromise

    setCtx({
      braceletDbId: bracelet.id,
      serverId:     bracelet.server_id,
      restaurant,
      server,
      items:        (items ?? []) as FeaturedItem[],
      tapEventId:   tapRow?.id ?? '',
    })
    setPageState('ready')
  }

  const handleAction = useCallback(async (item: FeaturedItem, action: ClickAction) => {
    if (!ctx) return
    setActionLoading(item.id)

    await Promise.all([
      supabase.from('click_events').insert({
        tap_event_id:     ctx.tapEventId || null,
        bracelet_id:      ctx.braceletDbId,
        server_id:        ctx.serverId,
        restaurant_id:    ctx.restaurant.id,
        featured_item_id: item.id,
        action,
        session_id:       getSessionId(),
      }),
      supabase.from('customer_requests').insert({
        restaurant_id:    ctx.restaurant.id,
        server_id:        ctx.serverId,
        bracelet_id:      ctx.braceletDbId,
        featured_item_id: item.id,
        item_name:        item.name,
        action,
        session_id:       getSessionId(),
      }),
    ])

    setActionLoading(null)
    setSentItems(prev => new Set([...prev, item.id]))

    const msg = action === 'want_this'
      ? `Your server will bring ${item.name} right over.`
      : `Your server knows you're curious about ${item.name}.`
    showToast(msg)
  }, [ctx])

  async function handleJoinRewards() {
    if (!ctx) return
    await supabase.from('click_events').insert({
      tap_event_id:  ctx.tapEventId || null,
      bracelet_id:   ctx.braceletDbId,
      server_id:     ctx.serverId,
      restaurant_id: ctx.restaurant.id,
      action:        'join_rewards',
      session_id:    getSessionId(),
    })
    setShowRewards(true)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-dvh bg-[--color-base] flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-[--color-border] border-t-[--color-brand] animate-spin" />
      </div>
    )
  }

  if (pageState === 'not_found' || !ctx) {
    return (
      <div className="min-h-dvh bg-[--color-base] flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="text-4xl">📡</div>
        <h1 className="text-xl font-bold text-[--color-text-primary]">Bracelet not found</h1>
        <p className="text-sm text-[--color-text-secondary] max-w-xs">
          This NFC bracelet isn't registered. Ask your server for help.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[--color-base] pb-10">

      {/* Restaurant header */}
      <div className="bg-[--color-surface-1] border-b border-[--color-border]">
        <div className="max-w-lg mx-auto px-4 py-5 flex items-center gap-4">
          {ctx.restaurant.logo_url ? (
            <img
              src={ctx.restaurant.logo_url}
              alt={ctx.restaurant.name}
              className="w-12 h-12 rounded-xl object-cover border border-[--color-border] shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[--color-brand-muted] border border-[--color-brand]/20 flex items-center justify-center text-xl font-bold text-[--color-brand] shrink-0">
              {ctx.restaurant.name[0]}
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg text-[--color-text-primary] leading-tight">
              {ctx.restaurant.name}
            </h1>
            <p className="text-sm text-[--color-text-secondary]">
              Server: <span className="text-[--color-brand] font-medium">{ctx.server.name}</span>
            </p>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 pb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-[--color-text-muted]">
            Tonight's Highlights
          </p>
        </div>
      </div>

      {/* Featured items */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {ctx.items.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-[--color-text-muted]">
              No featured items right now — ask your server about tonight's specials.
            </p>
          </div>
        ) : (
          ctx.items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              sent={sentItems.has(item.id)}
              loading={actionLoading === item.id}
              onAction={handleAction}
            />
          ))
        )}
      </div>

      {/* Rewards CTA */}
      <div className="max-w-lg mx-auto px-4">
        <button
          onClick={handleJoinRewards}
          className="w-full card p-4 flex items-center justify-between group hover:border-[--color-brand]/30 transition-all duration-200 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[--color-brand-muted] flex items-center justify-center text-lg shrink-0">
              ⭐
            </div>
            <div>
              <p className="text-sm font-semibold text-[--color-text-primary]">
                Join {ctx.restaurant.name} Rewards
              </p>
              <p className="text-xs text-[--color-text-muted]">
                Exclusive offers &amp; perks for regulars
              </p>
            </div>
          </div>
          <svg className="w-4 h-4 text-[--color-text-muted] group-hover:text-[--color-brand] transition-colors shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-[--color-text-muted] mt-8">
        Powered by <span className="text-[--color-brand] font-medium">ServeSync</span>
      </p>

      {toast && <Toast message={toast} />}
      {showRewards && (
        <RewardsModal
          restaurant={ctx.restaurant}
          braceletDbId={ctx.braceletDbId}
          onClose={() => setShowRewards(false)}
        />
      )}
    </div>
  )
}
