import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import '@/components/avis-de-valeur/avis-de-valeur.css'
import { AvisDeValeurDocument } from '@/components/avis-de-valeur/avis-de-valeur-document'
import { LayoutGuard } from '@/components/avis-de-valeur/layout-guard'
import { ReportToolbar } from '@/components/avis-de-valeur/report-toolbar'
import { getCurrentAdmin } from '@/lib/auth'
import { buildAvisDeValeur } from '@/lib/avis-de-valeur/build'

export const metadata: Metadata = { title: 'Avis de valeur' }
export const dynamic = 'force-dynamic'

/**
 * Rendu du rapport A4 d'une opportunité.
 *
 * Route volontairement placée hors de `/admin/market`, dont le layout impose la
 * barre latérale : un document destiné au papier ne se compose pas dans une
 * colonne amputée d'un menu. Le contrôle d'accès est donc refait ici, puisque
 * c'est ce layout qui le portait.
 *
 * Composant serveur : l'assemblage des données précède le rendu, ce qui garantit
 * qu'une impression déclenchée immédiatement contient tout le document.
 */
export default async function AvisDeValeurPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login?redirect=/app/dashboard')

  const { id } = await params
  const avis = await buildAvisDeValeur(id)
  if (!avis) notFound()

  const title = [avis.property.propertyType, avis.property.city].filter(Boolean).join(' — ')

  return (
    <div className="min-h-screen bg-slate-900 print:bg-white">
      <ReportToolbar opportunityId={id} title={`Avis de valeur · ${title}`} warnings={avis.meta.warnings} />
      <LayoutGuard />

      <main className="px-4 py-8 print:p-0">
        <AvisDeValeurDocument avis={avis} />
      </main>
    </div>
  )
}
