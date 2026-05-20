import { AppShell, type NavItem } from '@/components/layout/AppShell'

const nav: NavItem[] = [
  {
    label: 'Requests',
    to: '/server',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 5.5h6M5 8h4M5 10.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function ServerDashboard() {
  return (
    <AppShell nav={nav} title="Server view">
      <div>
        <h1 className="text-2xl font-bold text-[--color-text-primary] mb-1">My Requests</h1>
        <p className="text-sm text-[--color-text-secondary] mb-6">Live requests from your bracelet</p>
        <div className="card p-10 flex flex-col items-center text-center gap-3">
          <img
            src="/logos/servesync-emblem.png"
            alt=""
            className="w-12 h-12 object-contain opacity-25"
          />
          <p className="text-sm text-[--color-text-muted]">No pending requests — you're all caught up!</p>
        </div>
      </div>
    </AppShell>
  )
}
