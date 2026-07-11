import * as React from 'react'

import { cn } from '@/lib/utils'

type DataToolbarProps = React.ComponentProps<'div'> & {
  title?: string
  description?: string
  filters?: React.ReactNode
  actions?: React.ReactNode
}

function DataToolbar({
  title,
  description,
  filters,
  actions,
  className,
  ...props
}: DataToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm md:flex-row md:items-center md:justify-between',
        className
      )}
      {...props}
    >
      {(title || description) ? (
        <div className="min-w-0 space-y-0.5">
          {title ? (
            <h2 className="truncate text-sm font-bold text-foreground">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {filters ? (
          <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
            {filters}
          </div>
        ) : null}
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { DataToolbar }
