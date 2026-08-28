'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  HelpCircle,
  Home,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { PageLayout } from '@/components/pro'
import { AgendaCalendar, type AgendaEvent } from '@/components/dashboard/AgendaCalendar'
import { CopilotePanel } from '@/components/dashboard/CopilotePanel'

type DashboardAction = {
  id: string
  source: string
  source_label: string
  title: string
  object_label: string
  due_date: string | null
  bucket: string
  priority: string
  href: string
}

type DashboardPayload = {
  generated_at: string
  kpis: {
    actions_due: number
    opportunities_active: number
    signed_mandates: number
    network_to_relaunch: number
    hot_properties: number
  }
  actions: DashboardAction[]
}

export function DashboardCockpit() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/market/dashboard', { cache: 'no-store' })
      if (res.ok) {
        setPayload(await res.json())
      }
    } catch (err) {
      console.error('Erreur chargement dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  // Map actions from backend to agenda events
  const agendaEvents = useMemo<AgendaEvent[]>(() => {
    const baseEvents: AgendaEvent[] = [
      {
        id: '1',
        title: 'Pose des panneaux',
        date: '2026-08-27',
        time: '17:00',
        type: 'task',
        color: 'default',
      },
      {
        id: '2',
        title: 'TAVERNES',
        date: '2026-08-31',
        time: '18:00',
        type: 'visit',
        location: 'Tavernes',
        color: 'orange',
      },
      {
        id: '3',
        title: 'Post maison de village',
        date: '2026-08-27',
        time: '20:00',
        type: 'reminder',
        color: 'default',
      },
    ]

    if (!payload?.actions) return baseEvents

    const dynamicEvents: AgendaEvent[] = payload.actions
      .filter((act) => act.due_date)
      .map((act, index) => {
        const dateStr = act.due_date ? act.due_date.slice(0, 10) : '2026-08-27'
        const hour = 14 + (index % 8)
        return {
          id: `dyn-${act.id}`,
          title: act.title,
          date: dateStr,
          time: `${hour}:00`,
          type: act.source === 'opportunity' ? 'visit' : 'task',
          color: act.source === 'opportunity' ? 'orange' : 'default',
          location: act.object_label,
        }
      })

    return [...baseEvents, ...dynamicEvents]
  }, [payload])

  return (
    <PageLayout width="wide">
      <div className="space-y-6">
        {/* Top Header matching screenshot */}
        <div className="flex items-start gap-4">
          {/* Blue-Indigo gradient icon */}
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-primary-foreground shadow-sm">
            <Home className="size-5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>Cockpit Mandat OS</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-600 lowercase font-medium">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                Actif
              </span>
            </div>

            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-foreground leading-tight">
                Bonjour Alexandre,
              </h1>
              <span className="flex size-5 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 text-xs font-bold">
                ?
              </span>
            </div>

            <p className="text-xs text-muted-foreground font-medium">
              Voici votre agenda et les actions détectées pour aujourd'hui
            </p>
          </div>
        </div>

        {/* 2-Column Split: Agenda (Left) + Copilote (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Agenda */}
          <div className="lg:col-span-7">
            <AgendaCalendar events={agendaEvents} onRefresh={loadDashboard} />
          </div>

          {/* Right Column: Copilote */}
          <div className="lg:col-span-5">
            <CopilotePanel embedded={true} />
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
