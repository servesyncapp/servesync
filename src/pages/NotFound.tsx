import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-[--color-base] flex flex-col items-center justify-center px-6 text-center gap-4">
      <img
        src="/logos/servesync-emblem.png"
        alt="ServeSync"
        className="w-16 h-16 object-contain opacity-25"
      />
      <h1 className="text-2xl font-bold text-[--color-text-primary]">Page not found</h1>
      <p className="text-sm text-[--color-text-secondary] max-w-xs">
        This link doesn't exist or may have expired.
      </p>
      <Link to="/" className="text-sm text-[--color-brand] hover:underline">Go home</Link>
    </div>
  )
}
