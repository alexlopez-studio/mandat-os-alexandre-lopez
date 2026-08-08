import * as React from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const dataToolbarVariants = cva(
  'flex flex-col md:flex-row md:items-center md:justify-between',
  {
    variants: {
      variant: {
        default: 'gap-3 rounded-lg border border-border bg-card p-3 shadow-sm',
        pill: 'bg-white border border-slate-100 p-1.5 rounded-2xl gap-1 overflow-x-auto scrollbar-none shadow-sm h-auto',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

type DataToolbarProps = React.ComponentProps<'div'> & VariantProps<typeof dataToolbarVariants> & {
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
  variant,
  className,
  ...props
}: DataToolbarProps) {
  return (
    <div
      className={cn(dataToolbarVariants({ variant }), className)}
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
