'use client'

import * as React from 'react'
import { Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type BulkActionBarProps = React.ComponentProps<'div'> & {
  /** Nombre de lignes cochees. La barre disparait a zero. */
  count: number
  /** Nom de l'entite au singulier (« contact », « projet »). Le pluriel est ajoute. */
  noun: string
  onClear: () => void
  /** Affiche un indicateur pendant l'application d'une action groupee. */
  busy?: boolean
}

/**
 * Barre d'actions groupees des vues tableau, affichee des qu'une ligne est cochee.
 * Les actions sont passees en enfants (ordre de lecture : action principale en
 * premier) ; l'annulation de la selection est fournie par la primitive.
 */
function BulkActionBar({
  count,
  noun,
  onClear,
  busy = false,
  className,
  children,
  ...props
}: BulkActionBarProps) {
  if (count === 0) return null

  const plural = count > 1 ? 's' : ''

  return (
    <div
      role="region"
      aria-label="Actions groupées"
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-accent px-4 py-2 shadow-sm',
        className
      )}
      {...props}
    >
      <span className="text-xs font-bold text-primary">
        {busy ? <Loader2 className="mr-2 inline size-3.5 animate-spin" aria-hidden="true" /> : null}
        {count} {noun}
        {plural} sélectionné{plural}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={busy}
          className="h-8 rounded-full text-xs font-semibold"
        >
          <X className="mr-1 size-3.5" aria-hidden="true" />
          Annuler
        </Button>
      </div>
    </div>
  )
}

export { BulkActionBar }
