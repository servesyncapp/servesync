import { AppShell, type NavItem } from '@/components/layout/AppShell'
import { StatCard } from '@/components/ui/StatCard'

const nav: NavItem[] = [
  {
    label: 'Overview',
    to: '/restaurant',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor"/>
        <rect x="6.5" y="6" width="3" height="8" rx="1" fill="currentColor"/>
        <rect x="11" y="3" width="3" height="11" rx="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    label: 'Items',
    to: '/restaurant/items',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 5v3.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: 'Analytics',
    to: '/restaurant/analytics',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 12.5l3.5-4 3 2.5 5.5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: 'Sales',
    to: '/restaurant/sales',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v12M5 5.5h4.5a1.5 1.5 0 010 3H6.5a1.5 1.5 0 000 3H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function RestaurantDashboard() {
  return (
    <AppShell nav={nav} title="Restaurant">
      <div>
        <h1 className="text-2xl font-bold text-[--color-text-primary] mb-1">Overview</h1>
        <p className="text-sm text-[--color-text-secondary] mb-6">Today's engagement at a glance</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatCard label="Taps today"     value="—" accent />
          <StatCard label="Clicks today"   value="—" accent />
          <StatCard label="Requests today" value="—" accent />
        </div>

        <div className="card p-6 text-center">
          <p className="text-sm text-[--color-text-muted]">
            Connect your Supabase project and add featured items to see live data here.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
