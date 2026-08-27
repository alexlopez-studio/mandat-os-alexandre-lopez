'use client'

import * as React from 'react'
import { PageLayout, PageHeader, PageSection } from '@/components/pro'
import { BonDeVisiteWizard } from '@/components/bon-de-visite/BonDeVisiteWizard'

export default function VisiteDirectPage() {
  return (
    <PageLayout width="narrow">
      <PageHeader
        eyebrow="Terrain"
        title="Nouveau bon de visite"
        description="Faites signer les acquéreurs directement sur votre téléphone lors de la visite."
      />

      <PageSection>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
          <React.Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Chargement...</div>}>
            <BonDeVisiteWizard />
          </React.Suspense>
        </div>
      </PageSection>
    </PageLayout>
  )
}
