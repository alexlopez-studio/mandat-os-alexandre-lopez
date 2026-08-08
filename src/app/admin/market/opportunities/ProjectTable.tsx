'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type ProjectType = 'vente' | 'achat'

interface Project {
  id: string
  kind: ProjectType
  title: string
  stage: string
  priority: string
  next_action: string | null
  due_date: string | null
  property_city: string | null
  property_type: string | null
  budget_max: number | null
  estimated_price_min: number | null
  seller_name: string | null
  created_at: string
}

type ProjectTableProps = {
  search: string
  kindFilter: string
  activeFilter: string
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatPrice(value: number | null | undefined) {
  if (value == null) return null
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function dueBucket(value: string | null | undefined) {
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

export function ProjectTable({ search, kindFilter, activeFilter }: ProjectTableProps) {
  const router = useRouter()
  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const url = new URL('/api/market/projects', window.location.origin)
        url.searchParams.set('search', search)
        url.searchParams.set('kind', kindFilter)
        url.searchParams.set('active', activeFilter)

        const res = await fetch(url)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Chargement impossible')
        if (active) setRows(data.projects ?? [])
      } catch (error) {
        console.error('Erreur chargement projets', error)
        toast.error('Impossible de charger les projets')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [search, kindFilter, activeFilter])

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Type</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Secteur / Bien</TableHead>
              <TableHead>Prix / Budget</TableHead>
              <TableHead>Prochaine action</TableHead>
              <TableHead>Échéance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  Aucun projet trouvé
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer group"
                  onClick={() => router.push(`/app/opportunities/${row.id}`)}
                >
                  <TableCell>
                    <Badge variant="outline" className={row.kind === 'vente' ? 'text-blue-600 bg-blue-50' : 'text-emerald-600 bg-emerald-50'}>
                      {row.kind === 'vente' ? 'Vente' : 'Achat'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate" title={row.title}>
                    {row.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal text-xs">
                      {row.stage || 'Nouveau'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.seller_name ? (
                      <span className="text-sm font-medium">{row.seller_name}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucun contact</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[row.property_type, row.property_city].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {formatPrice(row.estimated_price_min || row.budget_max) || '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm" title={row.next_action || ''}>
                    {row.next_action || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className={`text-sm font-medium ${dueClass(row.due_date)}`}>
                      {formatDate(row.due_date)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
