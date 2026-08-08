import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Grilles standardisees : le responsive est gere ici, jamais dans les pages
 * (voir `docs/DESIGN.md` §3).
 */
const colClasses = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
} as const

type GridCols = keyof typeof colClasses

type GridProps = React.ComponentProps<'div'> & {
  cols?: GridCols
}

function Grid({ cols = 3, className, ...props }: GridProps) {
  return <div className={cn('grid gap-4', colClasses[cols], className)} {...props} />
}

export { Grid }
export type { GridCols }
