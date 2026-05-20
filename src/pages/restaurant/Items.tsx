import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

// ── Types ────────────────────────────────────────────────────────────────────

type Category = 'appetizer' | 'drink' | 'top_seller' | 'daily_special' | 'upsell'

interface FeaturedItem {
  id: string
  name: string
  category: Category
  description: string | null
  price: number | null
  image_url: string | null
  active: boolean
  sort_order: number
  created_at: string
}

// ── Category display map ─────────────────────────────────────────────────────

const CATEGORY: Record<Category, { label: string; icon: string }> = {
  appetizer:    { label: 'Starter',       icon: '🥗' },
  drink:        { label: 'Drink',         icon: '🍹' },
  top_seller:   { label: 'Top Seller',    icon: '⭐' },
  daily_special:{ label: 'Daily Special', icon: '✨' },
  upsell:       { label: 'Upsell',        icon: '🔥' },
}

// ── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({ item }: { item: FeaturedItem }) {
  const meta = CATEGORY[item.category] ?? { label: item.category, icon: '•' }

  return (
    <div className="card p-4 flex items-start gap-4">
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-14 h-14 rounded-lg object-cover shrink-0 border border-[--color-border]"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-[--color-surface-3] border border-[--color-border] flex items-center justify-center text-xl shrink-0">
          {meta.icon}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge variant="brand">{meta.icon} {meta.label}</Badge>
          {!item.active && <Badge variant="neutral">Inactive</Badge>}
        </div>
        <p className="font-semibold text-[--color-text-primary] truncate">{item.name}</p>
        {item.description && (
          <p className="text-sm text-[--color-text-secondary] mt-0.5 line-clamp-2">
            {item.description}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        {item.price != null ? (
          <span className="text-sm font-semibold text-[--color-brand]">
            ${item.price.toFixed(2)}
          </span>
        ) : (
          <span className="text-sm text-[--color-text-muted]">—</span>
        )}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="card p-10 flex flex-col items-center text-center gap-4">
      <img
        src="/logos/servesync-emblem.png"
        alt=""
        className="w-14 h-14 object-contain opacity-30"
      />
      <div>
        <p className="font-semibold text-[--color-text-primary]">No featured items yet</p>
        <p className="text-sm text-[--color-text-secondary] mt-1 max-w-xs">
          Add items in Supabase to build your tap page menu.
        </p>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Items() {
  // Pull all auth state so we can log and guard correctly
  const { user, role, restaurantId, loading: authLoading } = useAuth()

  const [items, setItems]   = useState<FeaturedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    // Debug: log auth state every time it changes
    console.log('[Items] auth state —', { user: user?.email, role, restaurantId, authLoading })

    // Wait until AuthProvider has finished resolving the session
    if (authLoading) return

    // Auth is done but no restaurantId — stop loading and show an error
    if (!restaurantId) {
      console.warn('[Items] restaurantId is null after auth resolved. user:', user?.email, 'role:', role)
      setError('No restaurant linked to your account. Contact your ServeSync administrator.')
      setLoading(false)
      return
    }

    loadItems()
  }, [restaurantId, authLoading])

  async function loadItems() {
    console.log('[Items] fetching featured_items for restaurantId:', restaurantId)
    setLoading(true)
    setError(null)

    try {
      const { data, error: sbError } = await supabase
        .from('featured_items')
        .select('id, name, category, description, price, image_url, active, sort_order, created_at')
        .eq('restaurant_id', restaurantId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      console.log('[Items] Supabase response —', { data, error: sbError })

      if (sbError) {
        console.error('[Items] Supabase error:', sbError)
        setError(sbError.message)
      } else {
        console.log('[Items] loaded', data?.length ?? 0, 'items')
        setItems((data ?? []) as FeaturedItem[])
      }
    } catch (err) {
      console.error('[Items] unexpected error:', err)
      setError(err instanceof Error ? err.message : 'Unexpected error loading items.')
    } finally {
      // Always clear the spinner — no matter what happened above
      setLoading(false)
    }
  }

  const activeItems   = items.filter(i => i.active)
  const inactiveItems = items.filter(i => !i.active)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text-primary] mb-1">Featured Items</h1>
          <p className="text-sm text-[--color-text-secondary]">
            {loading
              ? 'Loading…'
              : error
              ? 'Could not load items'
              : `${activeItems.length} active item${activeItems.length !== 1 ? 's' : ''} on your tap page`}
          </p>
        </div>
        <Button variant="brand" size="sm" disabled>
          + Add item
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="card border-red-500/20 bg-red-950/20 p-4 mb-5">
          <p className="text-sm font-medium text-[--color-error] mb-1">Failed to load items</p>
          <p className="text-sm text-[--color-text-secondary]">{error}</p>
          {restaurantId && (
            <button
              onClick={loadItems}
              className="text-xs text-[--color-brand] hover:underline mt-2 block"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="card p-4 flex items-start gap-4 animate-pulse">
              <div className="w-14 h-14 rounded-lg bg-[--color-surface-3] shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 bg-[--color-surface-3] rounded w-20" />
                <div className="h-4 bg-[--color-surface-3] rounded w-48" />
                <div className="h-3 bg-[--color-surface-3] rounded w-64" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Items list */}
      {!loading && !error && (
        <>
          {activeItems.length === 0 && inactiveItems.length === 0 && <EmptyState />}

          {activeItems.length > 0 && (
            <div className="space-y-3 mb-6">
              {activeItems.map(item => <ItemRow key={item.id} item={item} />)}
            </div>
          )}

          {inactiveItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[--color-text-muted] uppercase tracking-widest mb-3">
                Inactive ({inactiveItems.length})
              </p>
              <div className="space-y-3 opacity-60">
                {inactiveItems.map(item => <ItemRow key={item.id} item={item} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
