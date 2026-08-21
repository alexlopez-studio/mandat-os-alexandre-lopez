'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { WEEKDAYS, buildWeeks, dayKey } from '@/components/pro/calendar-utils'
import { cn } from '@/lib/utils'

/**
 * Une echeance a placer sur le calendrier.
 * `tone` porte l'urgence, pas la nature : `overdue` pour une echeance depassee,
 * `done` pour une echeance honoree, `default` sinon.
 */
export type DeadlineItem = {
  id: string
  date: string
  label: string
  hint?: string
  tone?: 'default' | 'overdue' | 'done'
}

type DeadlineCalendarProps = {
  items: DeadlineItem[]
  onSelectItem?: (item: DeadlineItem) => void
  emptyText?: string
  className?: string
}

const TONE_DOT: Record<NonNullable<DeadlineItem['tone']>, string> = {
  default: 'bg-primary',
  overdue: 'bg-destructive',
  done: 'bg-muted-foreground',
}

function formatHour(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Calendrier mensuel compact : chaque jour porteur d'une echeance est pastille,
 * un clic sur le jour deplie la liste des echeances correspondantes.
 * Le mois affiche au montage est celui de la prochaine echeance a venir.
 */
function DeadlineCalendar({ items = [], onSelectItem, emptyText, className }: DeadlineCalendarProps) {
  const itemsByDay = React.useMemo(() => {
    const map = new Map<string, DeadlineItem[]>()
    for (const item of items) {
      const date = new Date(item.date)
      if (Number.isNaN(date.getTime())) continue
      const key = dayKey(date)
      const bucket = map.get(key)
      if (bucket) bucket.push(item)
      else map.set(key, [item])
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }
    return map
  }, [items])

  const initialMonth = React.useMemo(() => {
    const now = Date.now()
    const upcoming = items
      .map((item) => new Date(item.date))
      .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() >= now)
      .sort((a, b) => a.getTime() - b.getTime())[0]
    const anchor = upcoming ?? new Date()
    return new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  }, [items])

  const [month, setMonth] = React.useState(initialMonth)
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null)

  const today = new Date()
  const todayKey = dayKey(today)

  const weeks = React.useMemo(() => buildWeeks(month), [month])

  const selectedItems = selectedDay ? itemsByDay.get(selectedDay) ?? [] : []

  function shiftMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
    setSelectedDay(null)
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => shiftMonth(-1)}
          aria-label="Mois précédent"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => shiftMonth(1)}
          aria-label="Mois suivant"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="py-1 text-center text-xs font-bold uppercase text-muted-foreground"
          >
            {label}
          </span>
        ))}

        {weeks.flat().map((date) => {
          const key = dayKey(date)
          const dayItems = itemsByDay.get(key) ?? []
          const outside = date.getMonth() !== month.getMonth()
          const isToday = key === todayKey
          const isSelected = key === selectedDay
          const hasOverdue = dayItems.some((item) => item.tone === 'overdue')

          return (
            <button
              key={key}
              type="button"
              disabled={dayItems.length === 0}
              onClick={() => setSelectedDay(isSelected ? null : key)}
              aria-label={`${date.toLocaleDateString('fr-FR')} — ${dayItems.length} échéance(s)`}
              className={cn(
                'flex h-9 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition-colors',
                outside ? 'text-muted-foreground/50' : 'text-foreground',
                dayItems.length > 0 && 'cursor-pointer hover:bg-muted',
                isToday && 'border border-primary font-bold text-primary',
                isSelected && 'bg-accent text-accent-foreground',
                hasOverdue && !isSelected && 'text-destructive',
              )}
            >
              <span className="leading-none">{date.getDate()}</span>
              <span className="flex h-1 items-center gap-0.5">
                {dayItems.slice(0, 3).map((item) => (
                  <span
                    key={item.id}
                    className={cn('size-1 rounded-full', TONE_DOT[item.tone ?? 'default'])}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {selectedDay ? (
        selectedItems.length > 0 ? (
          <ul className="space-y-2 border-t pt-4">
            {selectedItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!onSelectItem}
                  onClick={() => onSelectItem?.(item)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                    onSelectItem && 'hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1 size-2 shrink-0 rounded-full',
                      TONE_DOT[item.tone ?? 'default'],
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatHour(item.date)}
                      {item.hint ? ` · ${item.hint}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null
      ) : (
        <p className="border-t pt-4 text-xs text-muted-foreground">
          {items.length === 0
            ? emptyText ?? 'Aucune échéance planifiée.'
            : 'Cliquez sur un jour pointé pour voir ses échéances.'}
        </p>
      )}
    </div>
  )
}

export { DeadlineCalendar }
