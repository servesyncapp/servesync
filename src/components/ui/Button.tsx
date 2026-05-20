import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'brand' | 'outline' | 'ghost' | 'danger'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant
  size?:     Size
  loading?:  boolean
  fullWidth?: boolean
}

const variants: Record<Variant, string> = {
  brand:   'bg-[--color-brand] text-[--color-base] hover:bg-[--color-brand-dim] font-semibold',
  outline: 'border border-[--color-border] text-[--color-text-primary] hover:border-[--color-brand] hover:text-[--color-brand]',
  ghost:   'text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-2]',
  danger:  'bg-red-950/40 text-[--color-error] border border-red-500/20 hover:bg-red-950/60',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'brand', size = 'md', loading, fullWidth, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[--radius-btn] transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]/40',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      )}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
