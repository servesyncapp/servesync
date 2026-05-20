import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  accent?: boolean
  className?: string
}

export function StatCard({ label, value, subtext, accent, className }: StatCardProps) {
  return (
    <div className={cn('card p-4', className)}>
      <p className="text-xs text-[--color-text-muted] mb-1 font-medium">{label}</p>
      <p className={cn(
        'text-2xl font-bold',
        accent ? 'text-[--color-brand]' : 'text-[--color-text-primary]',
      )}>
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-[--color-text-muted] mt-0.5">{subtext}</p>
      )}
    </div>
  )
}
