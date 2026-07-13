import { NextRequest, NextResponse } from 'next/server'
import { signClientPortalPreviewToken } from '@/lib/client-portal-preview-token'
import { loadAdminClientDossier } from '@/lib/market/client-admin'
import { supabaseAdmin } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return json(req, { success: false, error: 'Disponible uniquement en développement' }, 404)
  }

  try {
    const portalOrigin = sanitizePortalOrigin(req.nextUrl.searchParams.get('portal_origin'))
    const { data, error } = await supabaseAdmin
      .from('client_dossiers')
      .select('id')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(30)

    if (error) throw error

    const rows = await Promise.all(
      (data ?? []).map(async (row) => {
        const detail = await loadAdminClientDossier(row.id)
        if (!detail || detail.dossier.status !== 'active') return null

        const token = signClientPortalPreviewToken(detail.dossier.id)
        const snapshot = asRecord(detail.dossier.property_snapshot)
        const opinion = asRecord(detail.dossier.professional_opinion)
        const estimationStatus = getEstimationStatus(opinion)
        const salesFollowUpStatus = isSalesFollowUpActive(detail.opportunity?.stage) ? 'active' : 'teaser'
        const clientName = [
          detail.dossier.client_profile.first_name,
          detail.dossier.client_profile.last_name,
        ].filter(Boolean).join(' ').trim() || detail.dossier.client_profile.email || 'Client test'
        const propertyType = textValue(detail.seller_property?.type_bien, detail.opportunity?.property_type, snapshot.type_bien, snapshot.property_type, snapshot.type)
        const commune = textValue(detail.lead?.commune, detail.opportunity?.property_city, snapshot.commune, snapshot.city, snapshot.ville)

        return {
          id: detail.dossier.id,
          title: detail.dossier.title || clientName,
          clientName,
          propertyLabel: [propertyType, commune].filter(Boolean).join(' · '),
          opportunityStage: detail.opportunity?.stage ?? '',
          estimationStatus,
          salesFollowUpStatus,
          previewToken: token,
          previewPath: `/preview?token=${encodeURIComponent(token)}`,
          previewUrl: `${portalOrigin}/preview?token=${encodeURIComponent(token)}`,
        }
      }),
    )

    return json(req, {
      success: true,
      data: {
        dossiers: rows.filter(Boolean),
      },
    })
  } catch (err) {
    console.error('[GET /api/dev/client-portal-test-dossiers]', err)
    return json(req, { success: false, error: 'Impossible de charger les dossiers test' }, 500)
  }
}

function getEstimationStatus(opinion: Record<string, Json | undefined>) {
  if (opinion.client_portal_published === true) return 'published'
  const draftKeys = Object.keys(opinion).filter((key) => !key.startsWith('client_portal_'))
  return draftKeys.length > 0 ? 'draft' : 'empty'
}

function isSalesFollowUpActive(stage: string | null | undefined) {
  return stage === 'Mandat signé' || stage === 'Vendu'
}

function textValue(...values: Array<Json | string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function asRecord(value: Json): Record<string, Json | undefined> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, Json | undefined>
  return {}
}

function sanitizePortalOrigin(value: string | null) {
  if (!value) return 'http://localhost:3003'
  try {
    const url = new URL(value)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return url.origin
    }
  } catch {
    // Ignore invalid origins.
  }
  return 'http://localhost:3003'
}

function json(req: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) })
}

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin')
  const isLocalhost = origin ? /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) : false

  return {
    'Access-Control-Allow-Origin': isLocalhost ? origin! : 'http://localhost:3003',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}
