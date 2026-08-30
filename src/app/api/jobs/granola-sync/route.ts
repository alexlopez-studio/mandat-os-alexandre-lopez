import { NextRequest, NextResponse } from 'next/server'

import { dispatchGranolaActions } from '@/lib/integrations/granola/dispatch'
import { syncGranola } from '@/lib/integrations/granola/sync'

/**
 * Cron quotidien Granola.
 *
 * Le plan gratuit n'expose que les 30 derniers jours : sans passage quotidien,
 * les comptes rendus non ingeres sortent de la fenetre et sont definitivement
 * perdus. C'est la raison d'etre de ce job — il neutralise cette fenetre.
 *
 * Deux interrupteurs, dans cet ordre :
 *   1. `granola_sync_enabled` (app_settings) — la bascule metier, lue par `syncGranola` ;
 *   2. `granola_autodispatch_enabled` — l'execution des actions `low`, coupee
 *      par defaut tant que la qualite d'extraction n'a pas ete jugee.
 *
 * Auth cron : si `CRON_SECRET` est defini, l'en-tete Authorization Bearer est exige.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const sync = await syncGranola({ source: 'cron' })

  // Le dispatch ne tourne que si la sync a effectivement tourne : inutile de
  // rejouer une file d'actions quand rien de neuf n'est entre.
  const dispatch = sync.ran && !sync.error ? await dispatchGranolaActions({ limit: 30 }) : null

  if (sync.freshness.stale) {
    console.warn(`[Cron granola-sync] ALERTE FRAICHEUR — ${sync.freshness.message}`)
  }

  console.log(
    `[Cron granola-sync] ${sync.ran ? 'execute' : `ignore (${sync.skipped_reason})`}` +
      (sync.ingest
        ? ` — ${sync.ingest.fetched} reunion(s), ${sync.ingest.created} creee(s), ${sync.ingest.updated} maj, ` +
          `${sync.ingest.classified} rattachee(s), ${sync.ingest.needs_review} a arbitrer`
        : '') +
      (dispatch ? ` | dispatch: ${dispatch.executed} executee(s), ${dispatch.failed} en echec` : ''),
  )

  return NextResponse.json({
    success: sync.error === null,
    sync,
    dispatch,
    alert: sync.freshness.stale ? sync.freshness.message : null,
  })
}
