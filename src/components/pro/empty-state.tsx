import * as React from 'react'
import { type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type EmptyStateProps = React.ComponentProps<'div'> & {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/35 px-6 py-10 text-center',
        className
      )}
      {...props}
    >
      {Icon ? (
        <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-accent text-primary ring-1 ring-border">
          <Icon className="size-5 text-primary" aria-hidden="true" />
        </div>
      ) : null}
      <div className="max-w-md space-y-1.5">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
