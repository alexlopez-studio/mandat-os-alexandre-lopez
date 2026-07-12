import { NextResponse } from 'next/server'
import { buildClientPortalPreviewUrl } from '@/lib/client-portal-url'
import { signClientPortalPreviewToken } from '@/lib/client-portal-preview-token'
import { loadAdminClientDossier, rejectIfNoAdmin } from '@/lib/market/client-admin'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: Request, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    const detail = await loadAdminClientDossier(id)
    if (!detail) {
      return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })
    }
    if (detail.dossier.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Dossier client inactif' }, { status: 409 })
    }

    const token = signClientPortalPreviewToken(id)
    return NextResponse.json({
      success: true,
      data: {
        preview_url: buildClientPortalPreviewUrl(token),
        expires_in: 3600,
      },
    })
  } catch (err) {
    console.error('[POST /api/market/clients/[id]/preview-link]', err)
    return NextResponse.json({ success: false, error: 'Lien aperçu impossible' }, { status: 500 })
  }
}
