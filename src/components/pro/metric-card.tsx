import * as React from 'react'
import { type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type MetricCardProps = React.ComponentProps<'article'> & {
  label: string
  value: string
  detail?: string
  trend?: string
  icon?: LucideIcon
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
}

const toneClasses = {
  neutral: 'bg-card text-foreground ring-border',
  brand: 'bg-accent text-foreground ring-primary/20',
  success: 'bg-emerald-50 text-emerald-950 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-950 ring-amber-200',
  danger: 'bg-red-50 text-red-950 ring-red-200',
}

function MetricCard({
  label,
  value,
  detail,
  trend,
  icon: Icon,
  tone = 'neutral',
  className,
  ...props
}: MetricCardProps) {
  return (
    <article
      className={cn(
        'flex min-h-28 flex-col justify-between rounded-lg p-4 shadow-sm ring-1',
        toneClasses[tone],
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background/90 ring-1 ring-border/70">
            <Icon className="size-4 text-primary" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-2xl font-bold leading-none tracking-normal">
            {value}
          </p>
          {trend ? (
            <span className="rounded-md bg-background/80 px-1.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border/70">
              {trend}
            </span>
          ) : null}
        </div>
        {detail ? (
          <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </article>
  )
}

export { MetricCard }
