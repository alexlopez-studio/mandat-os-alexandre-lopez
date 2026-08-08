import * as React from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Grid, type GridCols } from './grid'

type LoadingStateProps = React.ComponentProps<'div'> & {
  /** Forme du contenu attendu : le squelette doit ressembler au resultat final. */
  variant?: 'table' | 'cards' | 'text'
  /** Nombre de lignes (table/text) ou de cartes (cards). */
  rows?: number
  cols?: GridCols
  label?: string
}

/**
 * Etat de chargement. Toujours un squelette a la forme du contenu final,
 * jamais un spinner plein ecran (voir `docs/DESIGN.md` §5).
 */
function LoadingState({
  variant = 'table',
  rows = 5,
  cols = 3,
  label = 'Chargement en cours',
  className,
  ...props
}: LoadingStateProps) {
  const items = Array.from({ length: rows })

  if (variant === 'cards') {
    return (
      <div role="status" aria-busy="true" aria-label={label} className={className} {...props}>
        <Grid cols={cols}>
          {items.map((_, index) => (
            <div key={index} className="rounded-lg border border-border bg-card p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-4 h-8 w-32" />
              <Skeleton className="mt-2 h-4 w-full" />
            </div>
          ))}
        </Grid>
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={label}
        className={cn('flex flex-col gap-2', className)}
        {...props}
      >
        {items.map((_, index) => (
          <Skeleton key={index} className={cn('h-4', index === rows - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}
      {...props}
    >
      <div className="flex items-center gap-4 border-b border-border bg-muted/50 px-4 py-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
      {items.map((_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  )
}

export { LoadingState }
