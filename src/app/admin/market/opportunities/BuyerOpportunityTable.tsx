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

type BuyerCriteria = {
  id: string
  lead_id: string
  type_bien: string | null
  communes: string[] | null
  budget_max: number | null
  surface_min: number | null
  pieces_min: number | null
  active: boolean
  stage: string | null
  next_action: string | null
  due_date: string | null
  matched_at: string | null
  created_at: string
}

type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'no_due'
type ActiveFilter = 'all' | 'active' | 'paused'

type BuyerOpportunityTableProps = {
  search: string
  stageFilter: string
  activeFilter: ActiveFilter
  dueFilter: DueFilter
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatPrice(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
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

export function BuyerOpportunityTable({ search, stageFilter, activeFilter, dueFilter }: BuyerOpportunityTableProps) {
  const router = useRouter()
  const [rows, setRows] = useState<BuyerCriteria[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/market/buyers?active=all&limit=200')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Chargement impossible')
        if (active) setRows(data.buyers ?? [])
      } catch (error) {
        console.error('Erreur chargement opportunités acquéreurs', error)
        toast.error('Impossible de charger les acquéreurs')
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
        row.type_bien,
        row.stage,
        row.next_action,
        row.lead_id,
        row.communes?.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
      const matchesStage = stageFilter === 'all' || row.stage === stageFilter
      const matchesActive =
        activeFilter === 'all' ||
        (activeFilter === 'active' && row.active) ||
        (activeFilter === 'paused' && !row.active)
      const matchesDue = dueFilter === 'all' || dueBucket(row.due_date) === dueFilter
      return matchesSearch && matchesStage && matchesActive && matchesDue
    })
  }, [activeFilter, dueFilter, rows, search, stageFilter])

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table className="min-w-[1040px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Opportunité</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Activité</TableHead>
              <TableHead>Communes</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Critères</TableHead>
              <TableHead>Prochaine action</TableHead>
              <TableHead>Échéance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Chargement
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Aucun acquéreur à afficher.
                </TableCell>
              </TableRow>
            ) : filteredRows.map((row) => (
              <TableRow
                key={row.lead_id}
                role="button"
                tabIndex={0}
                className="cursor-pointer hover:bg-accent/30"
                onClick={() => router.push(`/app/acheteurs/${row.lead_id}`)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  router.push(`/app/acheteurs/${row.lead_id}`)
                }}
              >
                <TableCell className="py-3">
                  <div className="max-w-[220px]">
                    <p className="truncate font-medium">{row.type_bien ? `Recherche ${row.type_bien}` : 'Recherche acquéreur'}</p>
                    <p className="truncate text-xs text-muted-foreground">Créée le {formatDate(row.created_at)}</p>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <Badge variant="outline" className="bg-background">{row.stage ?? 'Nouveau contact'}</Badge>
                </TableCell>
                <TableCell className="py-3">
                  <Badge variant={row.active ? 'default' : 'secondary'}>{row.active ? 'Actif' : 'Pause'}</Badge>
                </TableCell>
                <TableCell className="py-3">
                  <span className="block max-w-[220px] truncate text-sm">{row.communes?.length ? row.communes.join(', ') : 'À qualifier'}</span>
                </TableCell>
                <TableCell className="py-3 font-medium">{formatPrice(row.budget_max)}</TableCell>
                <TableCell className="py-3">
                  <span className="text-sm">
                    {[row.surface_min ? `${row.surface_min} m² min` : null, row.pieces_min ? `${row.pieces_min} p. min` : null].filter(Boolean).join(' · ') || '—'}
                  </span>
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
