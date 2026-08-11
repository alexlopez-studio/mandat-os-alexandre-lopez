'use client'

import * as React from 'react'
import { KanbanIcon, LayoutGrid, List, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ViewMode = 'table' | 'kanban' | 'cards'

/**
 * Ordre d'affichage fixe de la bascule, quelles que soient les vues activees :
 * tableau (vue par defaut, seule a permettre la selection multiple), puis
 * kanban, puis cartes.
 */
const MODE_ORDER: ViewMode[] = ['table', 'kanban', 'cards']

const MODE_META: Record<ViewMode, { label: string; icon: LucideIcon }> = {
  table: { label: 'Tableau', icon: List },
  kanban: { label: 'Kanban', icon: KanbanIcon },
  cards: { label: 'Cartes', icon: LayoutGrid },
}

type ViewModeToggleProps = {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  /** Vues proposees. L'ordre du tableau passe est ignore au profit de MODE_ORDER. */
  modes?: ViewMode[]
  className?: string
}

function ViewModeToggle({
  value,
  onChange,
  modes = ['table', 'cards'],
  className,
}: ViewModeToggleProps) {
  const visibleModes = MODE_ORDER.filter((mode) => modes.includes(mode))

  return (
    <div
      role="group"
      aria-label="Mode d’affichage"
      className={cn('flex items-center gap-1 rounded-full bg-secondary/50 p-1', className)}
    >
      {visibleModes.map((mode) => {
        const { label, icon: Icon } = MODE_META[mode]
        return (
          <Button
            key={mode}
            variant={value === mode ? 'default' : 'ghost'}
            size="sm"
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
            className="h-7 rounded-full px-3 text-xs font-bold"
          >
            <Icon className="mr-1.5 size-3.5" aria-hidden="true" /> {label}
          </Button>
        )
      })}
    </div>
  )
}

export { ViewModeToggle }
