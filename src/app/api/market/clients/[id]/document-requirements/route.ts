import { NextRequest, NextResponse } from 'next/server'
import {
  assertDossierExists,
  loadAdminClientDossier,
  loadDocuments,
  rejectIfNoAdmin,
} from '@/lib/market/client-admin'
import {
  documentRequirementsFor,
  reconcileRequirements,
  summarizeRequirements,
  type DocumentRow,
} from '@/lib/market/document-requirements'
import { normalizePropertyType, parseSaleContext, type SaleContext } from '@/lib/market/sale-context'
import { supabaseAdmin } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Matrice documentaire appliquee a un dossier.
 *
 * Meme squelette que la route `actions` : elle applique un gabarit de facon
 * idempotente. La difference tient au diff, qui porte ici sur
 * `client_documents.requirement_key` et non sur le titre — le libelle d'une
 * piece est editable par le conseiller, donc inutilisable comme identite.
 */

type SaleContextLookup =
  | { ok: true; context: SaleContext; projectId: string }
  | { ok: false; reason: 'no_project' | 'empty_context' }

/**
 * Remonte le contexte depuis le projet rattache au dossier.
 *
 * On lit `projects` directement et non la vue `opportunities` : ses triggers
 * `INSTEAD OF` exposent une liste fermee de colonnes, ou `sale_context` ne
 * figure pas.
 */
async function loadSaleContext(dossierId: string): Promise<SaleContextLookup> {
  const { data: dossier, error } = await supabaseAdmin
    .from('client_dossiers')
    .select('opportunity_id')
    .eq('id', dossierId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const projectId = (dossier as { opportunity_id: string | null } | null)?.opportunity_id
  if (!projectId) return { ok: false, reason: 'no_project' }

  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, sale_context, property_type')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError) throw new Error(projectError.message)
  if (!project) return { ok: false, reason: 'no_project' }

  const row = project as { id: string; sale_context: unknown; property_type: string | null }
  const parsed = parseSaleContext(row.sale_context)
  // Un contexte illisible en base ne doit pas casser la page : on le traite
  // comme non renseigne, le conseiller le ressaisira.
  if (!parsed.ok) return { ok: false, reason: 'empty_context' }
  if (!parsed.value.updated_at) return { ok: false, reason: 'empty_context' }

  return {
    ok: true,
    projectId: row.id,
    context: {
      ...parsed.value,
      // Le type de bien de la fiche fait foi tant qu'il n'a pas ete confirme
      // dans le contexte lui-meme.
      property_type: parsed.value.property_type ?? normalizePropertyType(row.property_type),
    },
  }
}

function contextMissingResponse(reason: 'no_project' | 'empty_context') {
  return NextResponse.json(
    {
      success: false,
      error:
        reason === 'no_project'
          ? "Ce dossier n'est rattaché à aucun projet : impossible de déterminer les pièces à fournir."
          : 'Renseigne le contexte de vente sur la fiche projet pour obtenir la liste des pièces.',
      reason,
    },
    { status: 409 }
  )
}

function toDocumentRows(documents: Array<Record<string, unknown>>): DocumentRow[] {
  return documents.map((document) => ({
    id: String(document.id),
    label: String(document.label ?? ''),
    requirement_key: (document.requirement_key as string | null) ?? null,
    status: String(document.status ?? 'missing'),
  }))
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    const detail = await loadAdminClientDossier(id)
    if (!detail) {
      return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })
    }

    const lookup = await loadSaleContext(id)
    if (!lookup.ok) return contextMissingResponse(lookup.reason)

    const rows = reconcileRequirements({
      context: lookup.context,
      documents: toDocumentRows(detail.documents as unknown as Array<Record<string, unknown>>),
    })

    return NextResponse.json({
      success: true,
      context: lookup.context,
      project_id: lookup.projectId,
      data: rows,
      summary: summarizeRequirements(rows),
    })
  } catch (err) {
    console.error('[GET /api/market/clients/[id]/document-requirements]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erreur matrice documentaire' },
      { status: 500 }
    )
  }
}

/**
 * POST : cree les pieces manquantes.
 *
 * Idempotent — seules les pieces dont la cle est absente du dossier sont
 * creees. Rejouable sans doublon, et rattrape un dossier ouvert avant l'ajout
 * d'une regle au referentiel.
 *
 * Body optionnel `{ keys: string[] }` pour n'ajouter qu'une piece ou une
 * selection, plutot que tout le gabarit.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    if (!(await assertDossierExists(id))) {
      return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })
    }

    const lookup = await loadSaleContext(id)
    if (!lookup.ok) return contextMissingResponse(lookup.reason)

    const body = await readBody(req)
    const requestedKeys = Array.isArray(body.keys)
      ? new Set(body.keys.filter((key): key is string => typeof key === 'string'))
      : null

    const existingDocuments = await loadDocuments(id)
    const existingKeys = new Set(
      (existingDocuments as unknown as Array<{ requirement_key: string | null }>)
        .map((document) => document.requirement_key)
        .filter((key): key is string => Boolean(key))
    )

    const missing = documentRequirementsFor(lookup.context)
      .filter(({ requirement }) => !existingKeys.has(requirement.key))
      .filter(({ requirement }) => !requestedKeys || requestedKeys.has(requirement.key))

    if (missing.length > 0) {
      const { error } = await supabaseAdmin.from('client_documents').insert(
        missing.map(({ requirement }) => ({
          dossier_id: id,
          requirement_key: requirement.key,
          label: requirement.label,
          category: requirement.produces.document!.category,
          // `missing` et non `requested` : une piece `requested` s'affiche au
          // vendeur comme une demande active. En creer trente d'un coup
          // transforme son espace en mur. Le conseiller bascule ensuite ce
          // qu'il veut reellement reclamer.
          status: 'missing' as const,
          notes: requirement.description,
        })) as never
      )

      if (error) {
        console.error('[POST /api/market/clients/[id]/document-requirements] insert error:', error)
        return NextResponse.json(
          { success: false, error: `Erreur ajout des pièces: ${error.message}` },
          { status: 500 }
        )
      }
    }

    const refreshed = await loadDocuments(id)
    const rows = reconcileRequirements({
      context: lookup.context,
      documents: toDocumentRows(refreshed as unknown as Array<Record<string, unknown>>),
    })

    return NextResponse.json({
      success: true,
      created: missing.length,
      context: lookup.context,
      data: rows,
      summary: summarizeRequirements(rows),
      documents: refreshed,
    })
  } catch (err) {
    console.error('[POST /api/market/clients/[id]/document-requirements]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erreur matrice documentaire' },
      { status: 500 }
    )
  }
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json()
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    // Appliquer tout le gabarit se fait par un POST sans corps.
    return {}
  }
}
