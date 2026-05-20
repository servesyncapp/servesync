import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hover, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'card',
        hover && 'transition-all duration-200 cursor-pointer hover:border-[--color-brand]/30 hover:bg-[--color-surface-2]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'
