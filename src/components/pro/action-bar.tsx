import * as React from 'react'

import { cn } from '@/lib/utils'

type ActionBarProps = React.ComponentProps<'div'>

/**
 * Ligne d'actions en bas de formulaire ou de modale.
 * L'ordre est fixe : action principale a droite, annulation a sa gauche
 * (voir `docs/DESIGN.md` §5). Passer les enfants dans cet ordre de lecture.
 */
function ActionBar({ className, ...props }: ActionBarProps) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end',
        className
      )}
      {...props}
    />
  )
}

export { ActionBar }
