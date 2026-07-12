import { NextResponse } from 'next/server'
import { buildClientPortalDossierUrl } from '@/lib/client-portal-url'
import { loadAdminClientDossier, rejectIfNoAdmin } from '@/lib/market/client-admin'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: Request, context: RouteContext) {
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

    return NextResponse.json({
      success: true,
      data: {
        client_url: buildClientPortalDossierUrl(detail.dossier.public_token),
        public_token: detail.dossier.public_token,
      },
    })
  } catch (err) {
    console.error('[GET /api/market/clients/[id]/client-link]', err)
    return NextResponse.json({ success: false, error: 'Lien client impossible' }, { status: 500 })
  }
}
