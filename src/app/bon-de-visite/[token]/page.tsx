import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getBonDeVisiteByToken } from '@/lib/bon-de-visite/storage'
import { BonDeVisiteDocument } from '@/components/bon-de-visite/BonDeVisiteDocument'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const bon = await getBonDeVisiteByToken(token)

  if (!bon) {
    return { title: 'Bon de visite non trouvé' }
  }

  return {
    title: `Bon de visite ${bon.reference} — ${bon.property_city}`,
    description: `Bon de visite certifié pour le bien situé à ${bon.property_address}, ${bon.property_city}.`,
  }
}

export default async function PublicBonDeVisitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const bon = await getBonDeVisiteByToken(token)

  if (!bon) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-slate-900/95 py-6 px-3 sm:px-6 print:bg-white print:p-0">
      <BonDeVisiteDocument bon={bon} publicToken={token} />
    </main>
  )
}
