'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { WEEKDAYS, buildWeeks, dayKey } from '@/components/pro/calendar-utils'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Une publication a placer dans la grille.
 * `tone` porte le canal, pas l'urgence : la couleur sert a lire une semaine
 * d'un coup d'oeil (blog, LinkedIn, Instagram…).
 */
export type CalendarEntry = {
  id: string
  date: string
  label: string
  channelLabel: string
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
  muted?: boolean
}

type ContentCalendarProps = {
  entries: CalendarEntry[]
  month: Date
  onMonthChange: (month: Date) => void
  onSelectEntry?: (entry: CalendarEntry) => void
  emptyText?: string
  className?: string
}

const TONE_CHIP = {
  neutral: 'border-border bg-muted text-muted-foreground',
  brand: 'border-primary/20 bg-accent text-primary',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
} as const

/** Au-dela, la case deborde : le reste est resume par un « +N ». */
const MAX_VISIBLE_PER_DAY = 3

/**
 * Calendrier editorial mensuel : contrairement a `DeadlineCalendar`, qui pointe
 * les jours et n'ouvre la liste qu'au clic, les publications sont lisibles
 * directement dans la grille — c'est ce qu'on vient verifier sur un calendrier
 * de contenu.
 */
function ContentCalendar({
  entries,
  month,
  onMonthChange,
  onSelectEntry,
  emptyText,
  className,
}: ContentCalendarProps) {
  const entriesByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    for (const entry of entries) {
      const date = new Date(entry.date)
      if (Number.isNaN(date.getTime())) continue
      const key = dayKey(date)
      const bucket = map.get(key)
      if (bucket) bucket.push(entry)
      else map.set(key, [entry])
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }
    return map
  }, [entries])

  const weeks = React.useMemo(() => buildWeeks(month), [month])
  const todayKey = dayKey(new Date())

  function shiftMonth(delta: number) {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1))
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </span>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => shiftMonth(1)} aria-label="Mois suivant">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
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
          const dayEntries = entriesByDay.get(key) ?? []
          const outside = date.getMonth() !== month.getMonth()
          const isToday = key === todayKey
          const hidden = dayEntries.length - MAX_VISIBLE_PER_DAY

          return (
            <div
              key={key}
              className={cn(
                'flex min-h-24 flex-col gap-1 rounded-lg border p-2',
                outside ? 'bg-muted/30 text-muted-foreground/50' : 'bg-card',
                isToday && 'border-primary',
              )}
            >
              <span
                className={cn(
                  'text-xs font-bold leading-none',
                  isToday ? 'text-primary' : outside ? 'text-muted-foreground/50' : 'text-muted-foreground',
                )}
              >
                {date.getDate()}
              </span>

              {dayEntries.slice(0, MAX_VISIBLE_PER_DAY).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  disabled={!onSelectEntry}
                  onClick={() => onSelectEntry?.(entry)}
                  title={`${entry.channelLabel} — ${entry.label}`}
                  className={cn(
                    'w-full truncate rounded-lg border px-2 py-1 text-left text-xs font-semibold transition-opacity',
                    TONE_CHIP[entry.tone ?? 'neutral'],
                    entry.muted && 'opacity-60',
                    onSelectEntry && 'hover:opacity-80',
                  )}
                >
                  {entry.label}
                </button>
              ))}

              {hidden > 0 ? (
                <span className="px-2 text-xs font-medium text-muted-foreground">+{hidden}</span>
              ) : null}
            </div>
          )
        })}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {emptyText ?? 'Aucune publication planifiée ce mois-ci.'}
        </p>
      ) : null}
    </div>
  )
}

export { ContentCalendar }
