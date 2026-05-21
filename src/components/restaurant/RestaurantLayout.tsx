import { Outlet } from 'react-router-dom'
import { AppShell, type NavItem } from '@/components/layout/AppShell'

const nav: NavItem[] = [
  {
    label: 'Overview',
    to: '/restaurant',
    end: true, // exact-match only — don't stay active on /restaurant/items etc.
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
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
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
  {
    label: 'Requests',
    to: '/restaurant/requests',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5a4 4 0 014 4v2.5l1 1.5H3L4 8V5.5a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

/**
 * Shared layout wrapper for all /restaurant/* pages.
 * Renders the AppShell (nav + header) and an <Outlet /> where
 * the matched child route's page component appears.
 */
export default function RestaurantLayout() {
  return (
    <AppShell nav={nav} title="Restaurant">
      <Outlet />
    </AppShell>
  )
}
