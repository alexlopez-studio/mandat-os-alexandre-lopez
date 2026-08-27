'use client'

import * as React from 'react'
import { PageLayout, PageHeader, PageSection } from '@/components/pro'
import { BonDeVisiteWizard } from '@/components/bon-de-visite/BonDeVisiteWizard'

export default function NouveauBonDeVisitePage() {
  return (
    <PageLayout width="narrow">
      <PageHeader
        eyebrow="Visites"
        title="Nouveau bon de visite"
        description="Remplissez les informations et faites signer les acquéreurs directement sur votre téléphone."
      />

      <PageSection>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
          <React.Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Chargement du formulaire...</div>}>
            <BonDeVisiteWizard />
          </React.Suspense>
        </div>
      </PageSection>
    </PageLayout>
  )
}
