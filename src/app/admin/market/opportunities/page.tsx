import type { Metadata } from 'next'
import { Suspense } from 'react'
import { OpportunitiesWorkspace } from './OpportunitiesWorkspace'

export const metadata: Metadata = {
  title: 'Opportunités / Mandats — Mandat OS',
}

export default function OpportunitiesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Opportunités / Mandats</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le cycle complet d’une affaire : de l’opportunité au mandat signé, côté vendeurs et acquéreurs.
        </p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Chargement des opportunités...</div>}>
        <OpportunitiesWorkspace />
      </Suspense>
    </div>
  )
}
