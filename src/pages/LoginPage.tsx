import { type FormEvent, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/restaurant'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-[--color-base] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img
            src="/logos/servesync-emblem.png"
            alt="ServeSync"
            className="w-20 h-20 object-contain mb-5 drop-shadow-[0_0_20px_rgba(168,230,61,0.25)]"
          />
          <img
            src="/logos/servesync-logo-transparent.png"
            alt="ServeSync"
            className="h-7 w-auto object-contain max-w-[180px] mb-2"
          />
          <p className="text-sm text-[--color-text-muted]">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">Email</label>
            <input
              className="input"
              type="email"
              required
              autoComplete="email"
              placeholder="you@restaurant.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[--color-text-secondary] mb-1.5">Password</label>
            <input
              className="input"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-[--color-error] bg-red-950/30 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
}
