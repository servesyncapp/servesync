export default function Analytics() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[--color-text-primary] mb-1">Analytics</h1>
      <p className="text-sm text-[--color-text-secondary] mb-6">
        Engagement by item, server, and campaign
      </p>

      <div className="card overflow-hidden">
        {/* Brand-hero watermark panel */}
        <div className="relative h-52 bg-[--color-surface-2] flex items-center justify-center border-b border-[--color-border]">
          <img
            src="/logos/servesync-brand-hero.png"
            alt=""
            className="absolute inset-0 w-full h-full object-contain p-10 opacity-[0.07] pointer-events-none select-none"
          />
          <div className="relative z-10 text-center px-6">
            <p className="text-xs font-semibold text-[--color-brand] uppercase tracking-widest mb-2">
              Coming in the next build step
            </p>
            <p className="text-lg font-bold text-[--color-text-primary] mb-1">Analytics Dashboard</p>
            <p className="text-sm text-[--color-text-secondary] max-w-xs mx-auto">
              Tap rates, click-through by item, engagement per server, and campaign comparisons.
            </p>
          </div>
        </div>

        {/* Preview list of planned metrics */}
        <div className="px-5 py-4 grid grid-cols-2 gap-3">
          {[
            'Taps over time',
            'Clicks by item',
            'Top performing server',
            'Campaign comparison',
            'Rewards sign-up rate',
            'Request conversion',
          ].map(label => (
            <div key={label} className="flex items-center gap-2 text-xs text-[--color-text-muted]">
              <span className="w-1.5 h-1.5 rounded-full bg-[--color-brand] opacity-40 shrink-0" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
