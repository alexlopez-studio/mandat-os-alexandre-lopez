import { NextRequest, NextResponse } from 'next/server'
import { loadClientPortalPayloadByDossierId, loadClientPortalPayloadForBearerToken } from '@/lib/client-portal-payload'
import { verifyClientPortalPreviewToken } from '@/lib/client-portal-preview-token'

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

export async function GET(req: NextRequest) {
  try {
    const previewToken = req.nextUrl.searchParams.get('preview_token')
    const dossierId = req.nextUrl.searchParams.get('dossier')

    const payload = previewToken
      ? await loadPreviewPayload(previewToken)
      : await loadClientPortalPayloadForBearerToken(req.headers.get('authorization'), dossierId)

    if (!payload) {
      return json(req, { success: false, error: 'Accès client requis' }, 401)
    }

    return json(req, { success: true, data: payload })
  } catch (err) {
    console.error('[GET /api/client-portal/dossier]', err)
    return json(req, { success: false, error: 'Erreur lecture suivi client' }, 500)
  }
}

async function loadPreviewPayload(token: string) {
  const payload = verifyClientPortalPreviewToken(token)
  if (!payload) return null
  return loadClientPortalPayloadByDossierId(payload.dossier_id)
}

function json(req: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) })
}

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin')
  const allowedOrigins = new Set([
    'https://espace.alexandrelopez.fr',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:5173',
  ])

  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://espace.alexandrelopez.fr',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}
