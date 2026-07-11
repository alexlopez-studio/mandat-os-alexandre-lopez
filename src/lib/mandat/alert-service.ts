// ═══════════════════════════════════════════════════════════════
// MandatFinder — Alert Service
// Rôle : Détecter les biens nouvellement "golden" et envoyer
//        un email d'alerte via Resend.
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase'
import { buildGoldenAlertEmail, type GoldenListing } from '@/lib/email/golden-alert-template'

const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'MandatFinder <estimation@alexlopez-provence.fr>'
const TO = 'alexlopez.studio@gmail.com'

const db = {
  seller_scores: () => supabaseAdmin.from('seller_scores' as unknown as never) as ReturnType<typeof supabaseAdmin.from>,
  listings: () => supabaseAdmin.from('listings' as unknown as never) as ReturnType<typeof supabaseAdmin.from>,
}

export interface GoldenAlertResult {
  new_golden_count: number
  email_sent: boolean
  skipped: boolean
}

/**
 * Détecte les biens qui sont passés en phase "golden" aujourd'hui
 * (score calculé ce jour avec phase=golden, sans score golden hier)
 * et envoie un email d'alerte si nécessaire.
 */
export async function sendGoldenAlertIfNeeded(): Promise<GoldenAlertResult> {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Listings avec phase=golden calculée aujourd'hui
  const { data: todayGolden, error: e1 } = await (db.seller_scores() as any)
    .select('listing_id')
    .eq('phase', 'golden')
    .gte('calculated_at', `${today}T00:00:00Z`)
    .lt('calculated_at', `${today}T23:59:59Z`)

  if (e1) throw e1
  if (!todayGolden || todayGolden.length === 0) {
    return { new_golden_count: 0, email_sent: false, skipped: true }
  }

  const todayGoldenIds = todayGolden.map((r: any) => r.listing_id as string)

  // Parmi eux, ceux qui étaient déjà golden hier → exclure
  const { data: alreadyGolden } = await (db.seller_scores() as any)
    .select('listing_id')
    .eq('phase', 'golden')
    .in('listing_id', todayGoldenIds)
    .gte('calculated_at', `${yesterday}T00:00:00Z`)
    .lt('calculated_at', `${yesterday}T23:59:59Z`)

  const alreadyGoldenIds = new Set((alreadyGolden ?? []).map((r: any) => r.listing_id as string))
  const newGoldenIds = todayGoldenIds.filter((id: string) => !alreadyGoldenIds.has(id))

  if (newGoldenIds.length === 0) {
    return { new_golden_count: 0, email_sent: false, skipped: true }
  }

  // Récupérer les détails des listings + scores du jour
  const { data: listings, error: e2 } = await (db.listings() as any)
    .select('id, title, city, zipcode, property_type, price, surface, url, first_seen_at')
    .in('id', newGoldenIds)

  if (e2) throw e2

  const { data: scores } = await (db.seller_scores() as any)
    .select('listing_id, score, breakdown')
    .in('listing_id', newGoldenIds)
    .gte('calculated_at', `${today}T00:00:00Z`)
    .lt('calculated_at', `${today}T23:59:59Z`)

  const scoreMap = new Map((scores ?? []).map((s: any) => [s.listing_id as string, s as any]))

  const goldenListings: GoldenListing[] = (listings ?? []).map((l: any) => {
    const scoreRow: any = scoreMap.get(l.id as string)
    const breakdown: any = scoreRow?.breakdown ?? {}
    const daysOnline = Math.floor(
      (Date.now() - new Date(l.first_seen_at).getTime()) / 86400000,
    )
    return {
      id: l.id,
      title: l.title,
      city: l.city,
      zipcode: l.zipcode,
      property_type: l.property_type,
      price: l.price,
      surface: l.surface,
      score: (scoreRow?.score as number) ?? 0,
      days_online: daysOnline,
      price_drops_count: (breakdown?.frustration?.drops_count as number) ?? 0,
      total_drop_percent: (breakdown?.drop_intensity?.total_drop_percent as number | null) ?? null,
      is_relisted: (breakdown?.behavior?.is_relisted as boolean) ?? false,
      url: l.url,
    }
  })

  // Trier par score décroissant
  goldenListings.sort((a, b) => b.score - a.score)

  const emailSent = await sendGoldenAlert(goldenListings)

  return {
    new_golden_count: newGoldenIds.length,
    email_sent: emailSent,
    skipped: false,
  }
}

async function sendGoldenAlert(listings: GoldenListing[]): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[GoldenAlert] RESEND_API_KEY manquant, email non envoyé.')
    return false
  }

  const { subject, html, text } = buildGoldenAlertEmail(listings)

  try {
    const r = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: FROM, to: [TO], subject, html, text }),
    })
    if (!r.ok) {
      const body = await r.text()
      console.error('[GoldenAlert] Erreur Resend:', r.status, body)
    }
    return r.ok
  } catch (err) {
    console.error('[GoldenAlert] Erreur fetch Resend:', err)
    return false
  }
}
