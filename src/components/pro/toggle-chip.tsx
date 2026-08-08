import * as React from 'react'
import { type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type ToggleChipProps = Omit<React.ComponentProps<'button'>, 'type'> & {
  selected: boolean
  icon?: LucideIcon
}

/**
 * Pastille cliquable pour une selection multiple (typologies de contact,
 * criteres…). Meme forme que `StatusPill`, mais interactive.
 */
function ToggleChip({ selected, icon: Icon, className, children, ...props }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20',
        selected
          ? 'border-primary bg-accent text-primary'
          : 'border-border bg-background text-muted-foreground hover:bg-muted',
        className
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

export { ToggleChip }
