import { AppShell, type NavItem } from '@/components/layout/AppShell'

const nav: NavItem[] = [
  {
    label: 'Restaurants',
    to: '/admin',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 14V7.5L8 2l6 5.5V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="6" y="9" width="4" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    label: 'Bracelets',
    to: '/admin/bracelets',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    label: 'Servers',
    to: '/admin/servers',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function AdminDashboard() {
  return (
    <AppShell nav={nav} title="ServeSync Admin">
      <div>
        <h1 className="text-2xl font-bold text-[--color-text-primary] mb-1">Restaurants</h1>
        <p className="text-sm text-[--color-text-secondary] mb-6">All ServeSync accounts</p>
        <div className="card p-10 flex flex-col items-center text-center gap-3">
          <img
            src="/logos/servesync-emblem.png"
            alt=""
            className="w-12 h-12 object-contain opacity-25"
          />
          <p className="text-sm text-[--color-text-muted]">No restaurants yet. Add one to get started.</p>
        </div>
      </div>
    </AppShell>
  )
}
