'use client'

import { User, Building2, TrendingDown, Zap, Archive } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Seuil d'affichage du badge « sous-évalué » (% sous la médiane prix/m² de la zone).
const UNDERVALUATION_BADGE_THRESHOLD = 5

/** Type de vendeur : gagnabilité du mandat. PAP = cible premium. */
export function SellerTypeBadge({ type }: { type?: string | null }) {
  if (type === 'individual') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1 text-[10px] px-1.5 py-0 h-5">
        <User className="h-3 w-3" /> Particulier
      </Badge>
    )
  }
  if (type === 'agency') {
    return (
      <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-5 text-muted-foreground">
        <Building2 className="h-3 w-3" /> Agence
      </Badge>
    )
  }
  return null
}

/**
 * Ligne de dimensions descriptives d'un bien (lisibles, à côté du score) :
 * type de vendeur, sous-évaluation, DPE passoire, retrait récent.
 */
export function DimensionBadges({
  sellerType,
  undervaluationPct,
  dpe,
  status,
  className,
}: {
  sellerType?: string | null
  undervaluationPct?: number | null
  dpe?: string | null
  status?: string | null
  className?: string
}) {
  const isUndervalued = (undervaluationPct ?? 0) >= UNDERVALUATION_BADGE_THRESHOLD
  const dpeUpper = (dpe ?? '').toUpperCase()
  const isPassoire = dpeUpper === 'F' || dpeUpper === 'G'
  const isExpired = status === 'expired' || status === 'removed'

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      <SellerTypeBadge type={sellerType} />
      {isUndervalued && (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 gap-1 text-[10px] px-1.5 py-0 h-5">
          <TrendingDown className="h-3 w-3" /> Sous-évalué −{undervaluationPct}%
        </Badge>
      )}
      {isPassoire && (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1 text-[10px] px-1.5 py-0 h-5">
          <Zap className="h-3 w-3" /> DPE {dpeUpper}
        </Badge>
      )}
      {isExpired && (
        <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-5 text-muted-foreground">
          <Archive className="h-3 w-3" /> Retiré
        </Badge>
      )}
    </div>
  )
}
