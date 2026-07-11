'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type OpportunityRow = {
  id: string
  title: string | null
  stage: string | null
  priority: string | null
  source_channel: string | null
  next_action: string | null
  due_date: string | null
  seller_name: string | null
  seller_phone: string | null
  seller_email: string | null
  property_city: string | null
  property_type: string | null
  created_at: string
  property: { title: string | null; city: string | null; price: number | null } | null
}

type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'no_due'

type SellerOpportunityTableProps = {
  search: string
  stageFilter: string
  dueFilter: DueFilter
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatPrice(value: number | null | undefined) {
  if (value == null) return null
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function propertyLabel(row: OpportunityRow) {
  const fallback = [row.property_type, row.property_city].filter(Boolean).join(' · ')
  return row.property?.title ?? (fallback || 'Bien à qualifier')
}

function dueBucket(value: string | null | undefined): DueFilter | 'later' {
  if (!value) return 'no_due'
  const due = new Date(value)
  if (Number.isNaN(due.getTime())) return 'no_due'
  const today = new Date()
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((dueDay.getTime() - todayDay.getTime()) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'week'
  return 'later'
}

function dueClass(value: string | null | undefined) {
  const bucket = dueBucket(value)
  if (bucket === 'overdue') return 'text-red-700'
  if (bucket === 'today') return 'text-amber-700'
  if (bucket === 'week') return 'text-blue-700'
  return 'text-muted-foreground'
}

export function SellerOpportunityTable({ search, stageFilter, dueFilter }: SellerOpportunityTableProps) {
  const router = useRouter()
  const [rows, setRows] = useState<OpportunityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/market/opportunities?limit=100')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Chargement impossible')
        if (active) setRows(data.opportunities ?? [])
      } catch (error) {
        console.error('Erreur chargement opportunités vendeurs', error)
        toast.error('Impossible de charger les vendeurs')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch = !query || [
        row.title,
        row.stage,
        row.source_channel,
        row.next_action,
        row.seller_name,
        row.seller_phone,
        row.seller_email,
        row.property_city,
        row.property_type,
        row.property?.title,
        row.property?.city,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
      const matchesStage = stageFilter === 'all' || row.stage === stageFilter
      const matchesDue = dueFilter === 'all' || dueBucket(row.due_date) === dueFilter
      return matchesSearch && matchesStage && matchesDue
    })
  }, [dueFilter, rows, search, stageFilter])

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Opportunité</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Bien</TableHead>
              <TableHead>Prochaine action</TableHead>
              <TableHead>Échéance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Chargement
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Aucun vendeur à afficher.
                </TableCell>
              </TableRow>
            ) : filteredRows.map((row) => (
              <TableRow
                key={row.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer hover:bg-accent/30"
                onClick={() => router.push(`/app/opportunities/${row.id}`)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  router.push(`/app/opportunities/${row.id}`)
                }}
              >
                <TableCell className="py-3">
                  <div className="max-w-[260px]">
                    <p className="truncate font-medium">{row.title ?? 'Opportunité vendeur'}</p>
                    <p className="truncate text-xs text-muted-foreground">Créée le {formatDate(row.created_at)}</p>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <Badge variant="outline" className="bg-background">{row.stage ?? 'Sans statut'}</Badge>
                </TableCell>
                <TableCell className="py-3">
                  <div className="max-w-[220px] text-sm">
                    <p className="truncate">{row.seller_name || 'Contact à qualifier'}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.seller_phone || row.seller_email || row.source_channel || '—'}</p>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <div className="max-w-[240px] text-sm">
                    <p className="truncate">{propertyLabel(row)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[row.property?.city, formatPrice(row.property?.price)].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <span className="block max-w-[240px] truncate text-sm">{row.next_action ?? '—'}</span>
                </TableCell>
                <TableCell className={`py-3 font-medium ${dueClass(row.due_date)}`}>
                  {formatDate(row.due_date)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
