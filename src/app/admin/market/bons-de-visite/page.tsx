'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  FileCheck2Icon,
  PlusIcon,
  SearchIcon,
  ExternalLinkIcon,
  MailIcon,
  CalendarIcon,
  UsersIcon,
  Building2Icon,
} from 'lucide-react'
import {
  PageLayout,
  PageHeader,
  PageSection,
  DataToolbar,
  SearchInput,
  EmptyState,
  LoadingState,
  StatusPill,
} from '@/components/pro'
import { Button } from '@/components/ui/button'
import type { BonDeVisite } from '@/lib/bon-de-visite/types'

export default function BonsDeVisitePage() {
  const [bons, setBons] = React.useState<BonDeVisite[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')

  const loadBons = React.useCallback(async () => {
    setLoading(true)
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await fetch(`/api/market/bons-de-visite${q}`)
      if (res.ok) {
        const data = await res.json()
        setBons(data.bons || [])
      }
    } catch (err) {
      console.error('Erreur chargement bons de visite:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  React.useEffect(() => {
    const timer = setTimeout(loadBons, 200)
    return () => clearTimeout(timer)
  }, [loadBons])

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    } catch {
      return iso
    }
  }

  const getEmailTone = (status: string) => {
    if (status === 'sent') return 'success'
    if (status === 'partial') return 'warning'
    if (status === 'failed') return 'danger'
    return 'neutral'
  }

  const getEmailLabel = (status: string) => {
    if (status === 'sent') return 'Email envoyé'
    if (status === 'partial') return 'Envoi partiel'
    if (status === 'failed') return 'Échec envoi'
    return 'En attente'
  }

  return (
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Affaires"
        title="Bons de visite"
        description="Générez, signez sur mobile et archivez vos bons de visite numériques avec envoi automatisé aux acquéreurs."
        actions={
          <Button asChild>
            <Link href="/app/bons-de-visite/nouveau">
              <PlusIcon className="size-4 mr-2" />
              Nouveau bon de visite
            </Link>
          </Button>
        }
      />

      <PageSection>
        <DataToolbar
          title="Historique des visites"
          description={`${bons.length} bon${bons.length > 1 ? 's' : ''} certifié${bons.length > 1 ? 's' : ''}`}
          filters={
            <SearchInput
              label="Rechercher un bon"
              placeholder="Rechercher par référence, adresse, commune ou visiteur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          }
        />

        {loading ? (
          <LoadingState variant="table" rows={4} />
        ) : bons.length === 0 ? (
          <EmptyState
            icon={FileCheck2Icon}
            title={search ? 'Aucun résultat' : 'Aucun bon de visite'}
            description={
              search
                ? 'Aucun bon de visite ne correspond à votre recherche.'
                : 'Créez votre premier bon de visite directement depuis votre téléphone ou ordinateur.'
            }
            action={
              <Button asChild>
                <Link href="/app/bons-de-visite/nouveau">
                  <PlusIcon className="size-4 mr-2" />
                  Créer un bon de visite
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs font-bold uppercase tracking-normal text-muted-foreground">
                <tr>
                  <th className="p-4">Référence</th>
                  <th className="p-4">Bien & Commune</th>
                  <th className="p-4">Date de visite</th>
                  <th className="p-4">Visiteurs</th>
                  <th className="p-4">Statut email</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bons.map((bon) => (
                  <tr key={bon.id} className="transition-colors hover:bg-muted/20">
                    <td className="p-4 font-bold text-foreground">
                      <Link
                        href={`/bon-de-visite/${bon.token}`}
                        target="_blank"
                        className="hover:underline text-primary"
                      >
                        {bon.reference}
                      </Link>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">
                          {bon.property_address}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {bon.property_zipcode ? `${bon.property_zipcode} ` : ''}
                          {bon.property_city} · {bon.property_type || 'Bien'}
                        </span>
                      </div>
                    </td>

                    <td className="p-4 text-xs text-muted-foreground">
                      {formatDate(bon.visit_at)}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-foreground">
                          {bon.visitors.map((v) => `${v.first_name} ${v.last_name}`).join(', ')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {bon.visitors_count} visiteur{bon.visitors_count > 1 ? 's' : ''} (Signé par {bon.signer_name})
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <StatusPill tone={getEmailTone(bon.email_status)}>
                        {getEmailLabel(bon.email_status)}
                      </StatusPill>
                    </td>

                    <td className="p-4 text-right">
                      <Button asChild variant="outline" size="sm" className="text-xs">
                        <Link href={`/bon-de-visite/${bon.token}`} target="_blank">
                          <ExternalLinkIcon className="size-3.5 mr-1" />
                          Consulter
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </PageLayout>
  )
}
