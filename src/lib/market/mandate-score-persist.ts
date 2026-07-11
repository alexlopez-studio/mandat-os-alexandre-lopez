// ═══════════════════════════════════════════════════════════════
// MandatFinder — Persistance du score + alerte de franchissement
// Recalcule le MandateProbabilityScore d'un bien après sync, le stocke
// (mandate_score/mandate_phase/scored_at) et émet une notification quand
// le vendeur passe en phase chaud/golden (à contacter pour le mandat).
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase'
import { scoreMarketProperty, type PriceHistoryRow } from './mandate-score'
import type { SellerPhase } from '@/lib/mandat/types'

const PHASE_RANK: Record<SellerPhase, number> = { cold: 0, warm: 1, hot: 2, golden: 3 }
const CONTACT_PHASES: SellerPhase[] = ['hot', 'golden']

function isSellerPhase(value: unknown): value is SellerPhase {
  return value === 'cold' || value === 'warm' || value === 'hot' || value === 'golden'
}

/**
 * Recalcule et persiste le score d'un bien, et alerte si le vendeur vient de
 * passer (à la hausse) en phase chaud/golden. À appeler après l'upsert d'un
 * bien dans la sync. Best-effort : les erreurs sont loguées sans interrompre la sync.
 */
export async function rescoreAndPersist(propertyId: string): Promise<void> {
  try {
    const { data: property } = await supabaseAdmin
      .from('market_properties')
      .select('id, price, first_seen_at, last_seen_at, published_at, status, title, city, zipcode, mandate_phase')
      .eq('id', propertyId)
      .single()

    if (!property) return

    const { data: history } = await supabaseAdmin
      .from('property_price_history')
      .select('old_price, new_price, variation_amount, variation_percent, detected_at')
      .eq('market_property_id', propertyId)

    const ms = scoreMarketProperty(property, (history ?? []) as PriceHistoryRow[])
    const previousPhase = isSellerPhase(property.mandate_phase) ? property.mandate_phase : null

    const { error: updateError } = await supabaseAdmin
      .from('market_properties')
      .update({
        mandate_score: ms.score,
        mandate_phase: ms.phase,
        scored_at: new Date().toISOString(),
      })
      .eq('id', propertyId)

    if (updateError) {
      console.error(`[rescoreAndPersist] update ${propertyId}:`, updateError.message)
      return
    }

    // Alerte : passage VERS hot/golden, strictement plus chaud qu'avant.
    const crossedUp =
      CONTACT_PHASES.includes(ms.phase) &&
      (previousPhase === null || PHASE_RANK[ms.phase] > PHASE_RANK[previousPhase])

    if (crossedUp) {
      await insertPhaseNotification(property, ms.phase, ms.score)
    }
  } catch (e) {
    console.error(`[rescoreAndPersist] ${propertyId}:`, e instanceof Error ? e.message : e)
  }
}

async function insertPhaseNotification(
  property: { id: string; title: string | null; city: string | null; zipcode: string | null },
  phase: SellerPhase,
  score: number,
): Promise<void> {
  const isGolden = phase === 'golden'
  const phaseLabel = isGolden ? "fenêtre d'or" : 'chaud'
  const where = [property.city, property.zipcode].filter(Boolean).join(' ')
  const title = property.title ?? 'Bien'

  const { error } = await supabaseAdmin.from('notifications').insert({
    type: isGolden ? 'mandate_golden' : 'mandate_hot',
    title: `Vendeur ${phaseLabel} : ${title}`,
    message: `${title}${where ? ` à ${where}` : ''} est passé en phase ${phaseLabel} (score ${score}/100). À contacter pour décrocher le mandat.`,
    priority: isGolden ? 'high' : 'medium',
    market_property_id: property.id,
    status: 'unread',
    action_label: 'Voir le bien',
  })

  if (error) {
    console.error(`[rescoreAndPersist] notification ${property.id}:`, error.message)
  }
}
