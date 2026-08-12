import * as React from 'react'

import type { SellerPhase } from '@/lib/mandat/types'

import { StatusPill } from './status-pill'

type Tone = React.ComponentProps<typeof StatusPill>['tone']

const phaseConfig: Record<SellerPhase, { label: string; tone: Tone }> = {
  cold: { label: 'Froid', tone: 'neutral' },
  warm: { label: 'Tiède', tone: 'brand' },
  hot: { label: 'Chaud', tone: 'warning' },
  golden: { label: "Fenêtre d'or", tone: 'danger' },
}

function SellerPhaseBadge({ phase }: { phase: SellerPhase }) {
  const config = phaseConfig[phase] ?? phaseConfig.cold

  return <StatusPill tone={config.tone}>{config.label}</StatusPill>
}

export { SellerPhaseBadge }
