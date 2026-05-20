import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export interface NavItem {
  label: string
  to: string
  icon: ReactNode
  /** Use true for index/parent routes so active state is exact-match only */
  end?: boolean
}

interface AppShellProps {
  children: ReactNode
  nav: NavItem[]
  title?: string
}

function Logo() {
  return (
    <img
      src="/logos/servesync-logo-transparent.png"
      alt="ServeSync"
      className="h-8 w-auto object-contain max-w-[152px] opacity-95 hover:opacity-100 transition-opacity"
    />
  )
}

export function AppShell({ children, nav, title }: AppShellProps) {
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[--color-base]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 h-14 border-b border-[--color-border] bg-[--color-base]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-full flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            {title && (
              <span className="text-xs text-[--color-text-muted] hidden sm:block">{title}</span>
            )}
            <button
              onClick={signOut}
              className="text-xs text-[--color-text-muted] hover:text-[--color-text-secondary] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-5xl mx-auto w-full px-4 gap-6 py-6">
        {/* Sidebar — desktop only */}
        <nav className="hidden md:flex flex-col gap-0.5 w-44 shrink-0 pt-1">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-[--radius-btn] text-sm transition-colors',
                isActive
                  ? 'bg-[--color-brand-muted] text-[--color-brand] font-medium'
                  : 'text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-2]',
              )}
            >
              <span className="shrink-0 opacity-80">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Page content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden sticky bottom-0 z-20 border-t border-[--color-border] bg-[--color-base]/95 backdrop-blur-sm">
        <div className="flex items-center justify-around h-16 px-2">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-xs transition-colors',
                isActive ? 'text-[--color-brand]' : 'text-[--color-text-muted]',
              )}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
