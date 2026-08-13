import { NextRequest, NextResponse } from 'next/server'
import { assertDossierExists, loadAdminClientDossier, rejectIfNoAdmin } from '@/lib/market/client-admin'
import { SELLER_ACTION_TEMPLATE, mapSellerActions } from '@/lib/market/seller-actions'
import { supabaseAdmin } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Actions de preparation du mandat. La creation, la mise a jour et la
 * suppression d'une action passent par la route `events` generique : seule
 * l'application du gabarit merite son propre point d'entree.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  const detail = await loadAdminClientDossier(id)
  if (!detail) {
    return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    data: mapSellerActions(detail.events.filter((event) => event.type === 'action')),
  })
}

/**
 * POST : applique le gabarit standard.
 *
 * Idempotent — seules les actions absentes sont creees, comparees par titre.
 * On peut donc le rejouer sur un dossier deja prepare sans creer de doublon,
 * et rattraper un dossier ouvert avant l'ajout d'une action au gabarit.
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    if (!(await assertDossierExists(id))) {
      return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })
    }

    const detail = await loadAdminClientDossier(id)
    const existing = new Set(
      (detail?.events ?? [])
        .filter((event) => event.type === 'action')
        .map((event) => event.title)
    )

    const missing = SELLER_ACTION_TEMPLATE.filter((entry) => !existing.has(entry.title))

    if (missing.length > 0) {
      const { error } = await supabaseAdmin.from('client_dossier_events').insert(
        missing.map((entry) => ({
          dossier_id: id,
          type: 'action' as const,
          title: entry.title,
          description: entry.description,
          status: 'todo',
          // Pas d'echeance par defaut : elle se pose au cas par cas.
          event_date: null,
          payload: { responsible: entry.responsible, action_key: entry.key },
          visible_to_client: true,
          created_by: 'admin',
        })) as never
      )

      if (error) {
        console.error('[POST /api/market/clients/[id]/actions] insert error:', error)
        return NextResponse.json(
          { success: false, error: `Erreur ajout des actions: ${error.message}` },
          { status: 500 }
        )
      }
    }

    const refreshed = await loadAdminClientDossier(id)
    return NextResponse.json({
      success: true,
      created: missing.length,
      data: mapSellerActions((refreshed?.events ?? []).filter((event) => event.type === 'action')),
    })
  } catch (err) {
    console.error('[POST /api/market/clients/[id]/actions]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erreur actions' },
      { status: 500 }
    )
  }
}
