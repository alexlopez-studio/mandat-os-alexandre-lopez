'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Bell, BellDot, Check, Archive, Loader2, Home, Flame, Users, TrendingDown, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// Méta par type : icône + libellé + teinte (lecture immédiate, sobre).
const TYPE_META: Record<string, { label: string; Icon: LucideIcon; tint: string }> = {
  new_listing: { label: 'Nouveau bien', Icon: Home, tint: 'text-blue-600 bg-blue-50' },
  mandate_golden: { label: "Fenêtre d'or", Icon: Flame, tint: 'text-red-600 bg-red-50' },
  mandate_hot: { label: 'Vendeur chaud', Icon: Flame, tint: 'text-orange-600 bg-orange-50' },
  matching_buyer: { label: 'Acquéreur', Icon: Users, tint: 'text-purple-600 bg-purple-50' },
  price_drop: { label: 'Baisse de prix', Icon: TrendingDown, tint: 'text-rose-600 bg-rose-50' },
}

function metaFor(type: string): { label: string; Icon: LucideIcon; tint: string } {
  if (TYPE_META[type]) return TYPE_META[type]
  if (type.startsWith('mandate')) return TYPE_META.mandate_hot
  return { label: 'Notification', Icon: Bell, tint: 'text-slate-600 bg-slate-100' }
}

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

type FilterKey = 'new_listing' | 'all'

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${days}j`
}

export function NotificationsSheet() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('new_listing')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const loadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/market/notifications?status=unread&limit=1')
      const data = await res.json()
      setUnreadCount(data.total ?? 0)
    } catch {
      /* silencieux : la cloche ne doit pas casser le header */
    }
  }, [])

  const loadList = useCallback(async (key: FilterKey) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (key === 'new_listing') params.set('type', 'new_listing')
      const res = await fetch(`/api/market/notifications?${params}`)
      const data = await res.json()
      setNotifications(data.notifications ?? [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCount() }, [loadCount])
  useEffect(() => { if (open) loadList(filter) }, [open, filter, loadList])

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
    }
  }

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await fetch(`/api/market/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'read' }),
      })
    } catch {
      loadCount()
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <>
              <BellDot className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {unreadCount} non lues
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>Alertes et nouveaux biens de votre marché</SheetDescription>
        </SheetHeader>

        {/* Filtre */}
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant={filter === 'new_listing' ? 'primary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter('new_listing')}
          >
            Nouveaux biens
          </Button>
          <Button
            variant={filter === 'all' ? 'primary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter('all')}
          >
            Tout
          </Button>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={markAllRead}>
              Tout marquer comme lu
            </Button>
          )}
        </div>

        <Separator className="my-4" />

        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter === 'new_listing' ? 'Aucun nouveau bien' : 'Aucune notification'}
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const meta = metaFor(notif.type)
              const unread = notif.status === 'unread'
              return (
                <div
                  key={notif.id}
                  className={cn(
                    'flex gap-3 rounded-lg border p-3 transition-colors',
                    unread ? 'border-l-2 border-l-brand bg-primary/5' : 'opacity-90',
                  )}
                >
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', meta.tint)}>
                    <meta.Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {meta.label}
                      </span>
                      {unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                        {formatTimeAgo(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-tight mt-0.5">{notif.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                    <div className="mt-2 flex items-center gap-1">
                      {notif.action_label && notif.market_property_id && (
                        <Button variant="outline" size="sm" className="h-7 text-xs mr-1" asChild onClick={() => markRead(notif.id)}>
                          <Link href={`/app/properties/${notif.market_property_id}`}>{notif.action_label}</Link>
                        </Button>
                      )}
                      {unread && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Marquer comme lue" onClick={() => markRead(notif.id)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Archiver" onClick={() => archive(notif.id)}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
