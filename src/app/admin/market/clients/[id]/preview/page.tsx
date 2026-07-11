import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ClientPortalView } from '@/app/espace-client/portal-view'
import type { ClientPortalDossier } from '@/lib/client-portal'
import { getCurrentAdmin } from '@/lib/auth'
import { loadAdminClientDossier } from '@/lib/market/client-admin'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ presentation?: string }>
}

export const metadata: Metadata = {
  title: 'Prévisualisation espace vendeur',
  robots: { index: false, follow: false },
}

export default async function ClientPortalPreviewPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const query = await searchParams
  const presentationMode = query?.presentation === '1'

  if (process.env.NODE_ENV === 'production') {
    const admin = await getCurrentAdmin()
    if (!admin) redirect(`/admin/login?redirect=/app/clients/${id}/preview`)
  }

  const detail = await loadAdminClientDossier(id)
  if (!detail) notFound()

  const data: ClientPortalDossier = {
    profile: detail.dossier.client_profile,
    dossier: detail.dossier,
    lead: detail.lead,
    sellerProperty: detail.seller_property,
    opportunity: detail.opportunity,
    documents: detail.documents,
    events: detail.events,
  }

  return (
    <ClientPortalView
      data={data}
      mode="preview"
      previewBackHref={`/app/clients/${id}`}
      showPreviewBanner={!presentationMode}
    />
  )
}
