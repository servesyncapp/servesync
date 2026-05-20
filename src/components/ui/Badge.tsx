import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'brand' | 'success' | 'warning' | 'error' | 'neutral'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variants: Record<BadgeVariant, string> = {
  brand:   'bg-[--color-brand-muted] text-[--color-brand] border border-[--color-brand]/20',
  success: 'bg-green-950/50 text-green-400 border border-green-500/20',
  warning: 'bg-orange-950/50 text-orange-400 border border-orange-500/20',
  error:   'bg-red-950/50 text-[--color-error] border border-red-500/20',
  neutral: 'bg-[--color-surface-3] text-[--color-text-secondary] border border-[--color-border]',
}

export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
