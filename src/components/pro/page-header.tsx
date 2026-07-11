import * as React from 'react'

import { cn } from '@/lib/utils'

type PageHeaderProps = React.ComponentProps<'header'> & {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
}

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 border-b border-border/80 pb-4 md:flex-row md:items-end md:justify-between',
        className
      )}
      {...props}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-normal text-primary">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-1">
            <h1 className="text-balance text-2xl font-extrabold leading-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  )
}

export { PageHeader }
