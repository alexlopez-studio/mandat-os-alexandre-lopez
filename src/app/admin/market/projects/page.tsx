import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

import { OpportunitiesWorkspace } from './OpportunitiesWorkspace'

export const metadata: Metadata = {
  title: 'Projets — Mandat OS',
}

export default function OpportunitiesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <OpportunitiesWorkspace />
    </Suspense>
  )
}
