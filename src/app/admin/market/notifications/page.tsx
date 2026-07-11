'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Bell, BellDot, Check, ArrowUpRight, Archive, Flame, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: string
  action_label: string | null
  market_property_id: string | null
  created_at: string
}

type StatusFilter = 'all' | 'unread'
type TypeFilter = 'all' | 'new_listing' | 'mandate'

const PRIORITY_CLASS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  critical: 'bg-red-100 text-red-600',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  price_drop: <ArrowUpRight className="h-4 w-4 text-red-500" />,
  new_listing: <Bell className="h-4 w-4 text-blue-500" />,
  expired: <Archive className="h-4 w-4 text-gray-500" />,
  match: <BellDot className="h-4 w-4 text-purple-500" />,
  mandate_golden: <Flame className="h-4 w-4 text-red-500" />,
  mandate_hot: <Flame className="h-4 w-4 text-orange-500" />,
  system: <Bell className="h-4 w-4 text-slate-500" />,
}

function iconFor(type: string): React.ReactNode {
  if (TYPE_ICONS[type]) return TYPE_ICONS[type]
  if (type.startsWith('mandate')) return <Flame className="h-4 w-4 text-orange-500" />
  return <Bell className="h-4 w-4" />
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  return `Il y a ${Math.floor(hours / 24)}j`
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [unreadCount, setUnreadCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (status === 'unread') params.set('status', 'unread')
      if (type === 'new_listing') params.set('type', 'new_listing')
      const res = await fetch(`/api/market/notifications?${params}`)
      const data = await res.json()
      let rows: Notification[] = data.notifications ?? []
      // Le filtre « Alertes mandat » couvre plusieurs types → filtré côté client.
      if (type === 'mandate') rows = rows.filter((n) => n.type.startsWith('mandate'))
      setNotifications(rows)
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [status, type])

  const loadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/market/notifications?status=unread&limit=1')
      const data = await res.json()
      setUnreadCount(data.total ?? 0)
    } catch {
      /* silencieux */
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadCount() }, [loadCount])

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await fetch(`/api/market/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'read' }),
      })
    } finally {
      loadCount()
      if (status === 'unread') load()
    }
  }

  async function archive(id: string) {
    const wasUnread = notifications.find((n) => n.id === id)?.status === 'unread'
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await fetch(`/api/market/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
    } finally {
      loadCount()
    }
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' })))
    setUnreadCount(0)
    try {
      await fetch('/api/market/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true, status: 'read' }),
      })
    } finally {
      loadCount()
      if (status === 'unread') load()
    }
  }

  const TYPE_TABS: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'Tous types' },
    { key: 'new_listing', label: 'Nouveaux biens' },
    { key: 'mandate', label: 'Alertes mandat' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">Alertes mandat, nouveaux biens et signaux du marché</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <>
              <Badge variant="secondary" className="rounded-full">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</Badge>
              <Button variant="ghost" size="sm" onClick={markAllRead}>Tout marquer comme lu</Button>
            </>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={status === 'all' ? 'primary' : 'outline'} size="sm" onClick={() => setStatus('all')}>Toutes</Button>
        <Button variant={status === 'unread' ? 'primary' : 'outline'} size="sm" onClick={() => setStatus('unread')}>Non lues</Button>
        <span className="mx-1 h-5 w-px bg-border" />
        {TYPE_TABS.map((t) => (
          <Button key={t.key} variant={type === t.key ? 'primary' : 'outline'} size="sm" onClick={() => setType(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <Card><CardContent className="flex items-center justify-center p-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>
        ) : notifications.length === 0 ? (
          <Card><CardContent className="flex items-center justify-center p-8 text-sm text-muted-foreground">Aucune notification</CardContent></Card>
        ) : (
          notifications.map((notif) => (
            <Card
              key={notif.id}
              className={cn('transition-colors', notif.status === 'unread' && 'border-l-4 border-l-brand bg-muted/20')}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <div className="mt-0.5 shrink-0">{iconFor(notif.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{notif.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{notif.message}</p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 text-[10px] px-1.5 py-0 h-5', PRIORITY_CLASS[notif.priority])}>
                      {notif.priority === 'critical' ? 'Urgent' : notif.priority}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{formatTimeAgo(notif.created_at)}</span>
                    <div className="flex items-center gap-1">
                      {notif.action_label && notif.market_property_id && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" asChild onClick={() => markRead(notif.id)}>
                          <Link href={`/app/properties/${notif.market_property_id}`}>{notif.action_label}</Link>
                        </Button>
                      )}
                      {notif.status === 'unread' && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markRead(notif.id)}>
                          <Check className="h-3 w-3 mr-1" /> Marquer lu
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => archive(notif.id)}>
                        <Archive className="h-3 w-3 mr-1" /> Archiver
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
