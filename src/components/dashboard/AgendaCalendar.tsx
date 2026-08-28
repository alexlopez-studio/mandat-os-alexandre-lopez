'use client'

import { useMemo, useState } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  HelpCircle,
  Home,
  MapPin,
  RefreshCw,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface AgendaEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  durationHours?: number
  type: 'visit' | 'task' | 'meeting' | 'reminder'
  location?: string
  contactName?: string
  color?: 'default' | 'orange' | 'blue' | 'purple'
}

interface AgendaCalendarProps {
  events?: AgendaEvent[]
  onRefresh?: () => void
}

const DEFAULT_SAMPLE_EVENTS: AgendaEvent[] = [
  {
    id: '1',
    title: 'Pose des panneaux',
    date: '2026-08-27',
    time: '17:00',
    durationHours: 1,
    type: 'task',
    color: 'default',
  },
  {
    id: '2',
    title: 'TAVERNES',
    date: '2026-08-31',
    time: '18:00',
    durationHours: 1.5,
    type: 'visit',
    location: 'Tavernes',
    color: 'orange',
  },
  {
    id: '3',
    title: 'Post maison de village',
    date: '2026-08-27',
    time: '20:00',
    durationHours: 1,
    type: 'reminder',
    color: 'default',
  },
]

const HOURS = [
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
  '23:00',
]

export function AgendaCalendar({ events = DEFAULT_SAMPLE_EVENTS, onRefresh }: AgendaCalendarProps) {
  const [viewMode, setViewMode] = useState<'day' | 'upcoming'>('upcoming')
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null)
  const [eventList, setEventList] = useState<AgendaEvent[]>(events)

  const [newEvent, setNewEvent] = useState({
    title: '',
    time: '14:00',
    date: '2026-08-27',
    type: 'task' as 'visit' | 'task' | 'meeting' | 'reminder',
    color: 'default' as 'default' | 'orange' | 'blue' | 'purple',
    location: '',
  })

  // Generate 5 days relative to fixed or current date
  const days = useMemo(() => {
    const baseDate = new Date(2026, 7, 27) // Jeu 27 août 2026
    const dayNames = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']
    return Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(baseDate)
      d.setDate(baseDate.getDate() + i)
      const dayNum = d.getDate()
      const dayLabel = dayNames[d.getDay()]
      const iso = d.toISOString().slice(0, 10)
      return { dayLabel, dayNum, iso, fullDate: d }
    })
  }, [])

  const currentSelectedDateIso = days[selectedDayIndex]?.iso

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEvent.title.trim()) return

    const created: AgendaEvent = {
      id: String(Date.now()),
      title: newEvent.title.trim(),
      date: newEvent.date || currentSelectedDateIso,
      time: newEvent.time,
      type: newEvent.type,
      color: newEvent.type === 'visit' ? 'orange' : 'default',
      location: newEvent.location.trim() || undefined,
    }

    setEventList((prev) => [...prev, created])
    setAddEventOpen(false)
    setNewEvent({
      title: '',
      time: '14:00',
      date: currentSelectedDateIso,
      type: 'task',
      color: 'default',
      location: '',
    })
    toast.success('Événement ajouté à l’agenda')
  }

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-6 shadow-sm h-160 max-h-160 overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
            <CalendarIcon className="size-4" />
          </div>
          <h2 className="text-base font-bold text-foreground">Agenda</h2>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            title="Aide agenda"
          >
            <HelpCircle className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented View Toggle */}
          <div className="flex items-center rounded-full bg-muted/80 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={cn(
                'rounded-full px-4 py-1 transition-colors',
                viewMode === 'day'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Jour
            </button>
            <button
              type="button"
              onClick={() => setViewMode('upcoming')}
              className={cn(
                'rounded-full px-4 py-1 transition-colors',
                viewMode === 'upcoming'
                  ? 'bg-card text-sky-600 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              À venir
            </button>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              onRefresh?.()
              toast.success('Agenda actualisé')
            }}
            className="size-8 rounded-full text-muted-foreground hover:text-foreground"
            title="Rafraîchir"
          >
            <RefreshCw className="size-4" />
          </Button>

          {/* Send / Action Button */}
          <Button
            size="icon"
            onClick={() => {
              setNewEvent((prev) => ({ ...prev, date: currentSelectedDateIso }))
              setAddEventOpen(true)
            }}
            className="size-8 rounded-full bg-sky-500 text-primary-foreground hover:bg-sky-600 shadow-xs"
            title="Ajouter un événement"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>

      {/* Days Bar */}
      <div className="pt-2 pb-2">
        <div className="grid grid-cols-5 divide-x divide-border/40 text-center">
          {days.map((day, idx) => {
            const isSelected = idx === selectedDayIndex
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => setSelectedDayIndex(idx)}
                className={cn(
                  'group flex flex-col items-center justify-center py-2 transition-colors',
                  isSelected ? 'text-sky-600' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {day.dayLabel}
                </span>
                <span
                  className={cn(
                    'text-base font-extrabold flex items-center gap-1',
                    isSelected ? 'text-sky-600' : 'text-foreground'
                  )}
                >
                  {day.dayNum}
                  {isSelected && <span className="inline-block size-1 rounded-full bg-sky-600 ml-1" />}
                </span>
              </button>
            )
          })}
        </div>

        {/* Summer Vacation Banner */}
        <div className="mt-2 flex items-center justify-end">
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/60 px-2 py-1 text-xs font-semibold text-muted-foreground">
            <CalendarIcon className="size-3" />
            Vacances d'Été...
          </span>
        </div>
      </div>

      {/* Hourly Timeline Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border/60 bg-background/50 p-2">
        <div className="relative divide-y divide-border/30">
          {HOURS.map((hour) => {
            const hourPrefix = hour.slice(0, 2)
            const eventsThisHour = eventList.filter(
              (e) => e.time.startsWith(hourPrefix)
            )

            return (
              <div key={hour} className="grid grid-cols-12 min-h-12 items-center py-1 group hover:bg-muted/20 transition-colors">
                {/* Time Label */}
                <div className="col-span-2 text-xs font-semibold text-muted-foreground pl-2">
                  {hour}
                </div>

                {/* Event Columns */}
                <div className="col-span-10 grid grid-cols-5 gap-2 pr-2">
                  {days.map((day) => {
                    const matchedEvent = eventsThisHour.find((e) => e.date === day.iso)

                    if (!matchedEvent) {
                      return (
                        <div
                          key={day.iso}
                          onClick={() => {
                            setNewEvent({
                              title: '',
                              time: hour,
                              date: day.iso,
                              type: 'task',
                              color: 'default',
                              location: '',
                            })
                            setAddEventOpen(true)
                          }}
                          className="h-8 rounded-lg border border-transparent hover:border-dashed hover:border-border/60 cursor-pointer"
                        />
                      )
                    }

                    const isOrange = matchedEvent.color === 'orange' || matchedEvent.type === 'visit'

                    return (
                      <div
                        key={day.iso}
                        onClick={() => setSelectedEvent(matchedEvent)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold cursor-pointer transition-transform hover:scale-105 shadow-xs truncate',
                          isOrange
                            ? 'border-l-4 border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200'
                            : 'border border-border/80 bg-muted/90 text-foreground'
                        )}
                      >
                        {isOrange ? (
                          <Home className="size-3 shrink-0 text-amber-600" />
                        ) : (
                          <CalendarIcon className="size-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">
                          <span className="text-xs text-muted-foreground mr-1">
                            {matchedEvent.time}
                          </span>
                          {matchedEvent.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal Ajout d'événement */}
      <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
        <DialogContent className="bg-card">
          <form onSubmit={handleAddEvent}>
            <DialogHeader>
              <DialogTitle>Ajouter un créneau / événement</DialogTitle>
              <DialogDescription>
                Planifiez un rendez-vous, une visite ou un rappel dans votre agenda.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="space-y-2">
                <Label>Titre de l'événement</Label>
                <Input
                  value={newEvent.title}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Visite Tavernes, Estimation M. Dupont..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Heure</Label>
                  <Input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, time: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex gap-2">
                  {(['task', 'visit', 'meeting', 'reminder'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewEvent((prev) => ({ ...prev, type: t }))}
                      className={cn(
                        'flex-1 rounded-lg border p-2 text-xs font-semibold capitalize transition-colors',
                        newEvent.type === t
                          ? 'border-sky-500 bg-sky-500/10 text-sky-600'
                          : 'border-border bg-background text-muted-foreground'
                      )}
                    >
                      {t === 'visit' ? 'Visite' : t === 'meeting' ? 'RDV' : t === 'task' ? 'Tâche' : 'Rappel'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lieu (Optionnel)</Label>
                <Input
                  value={newEvent.location}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Ex: Tavernes, Agence..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddEventOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-sky-600 text-primary-foreground hover:bg-sky-700">
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Détails Événement */}
      <Dialog open={selectedEvent !== null} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="bg-card">
          {selectedEvent && (
            <div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarIcon className="size-4 text-sky-600" />
                  {selectedEvent.title}
                </DialogTitle>
                <DialogDescription>
                  Détails du créneau planifié.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                <div className="flex items-center gap-2 text-foreground">
                  <Clock className="size-4 text-muted-foreground" />
                  <span>
                    {selectedEvent.date} à {selectedEvent.time}
                  </span>
                </div>

                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-foreground">
                    <MapPin className="size-4 text-muted-foreground" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-bold uppercase">
                    {selectedEvent.type}
                  </Badge>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setEventList((prev) => prev.filter((e) => e.id !== selectedEvent.id))
                    setSelectedEvent(null)
                    toast.success('Événement supprimé')
                  }}
                >
                  Supprimer
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>
                  Fermer
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
