import { redirect } from 'next/navigation'
import { loadAdminClientDossier } from '@/lib/market/client-admin'

// La fiche client est fusionnée dans la fiche opportunité / acquéreur.
// On redirige vers l'affaire rattachée au dossier.
export default async function ClientDossierRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await loadAdminClientDossier(id).catch(() => null)
  const dossier = data?.dossier

  if (dossier?.client_type === 'buyer' && dossier.buyer_lead_id) {
    redirect(`/app/acheteurs/${dossier.buyer_lead_id}`)
  }
  if (dossier?.opportunity_id) {
    redirect(`/app/opportunities/${dossier.opportunity_id}`)
  }
  redirect('/app/opportunities')
}
