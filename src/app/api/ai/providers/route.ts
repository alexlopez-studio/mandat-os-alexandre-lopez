import { NextRequest, NextResponse } from 'next/server'
import { AI_PROVIDER_CATALOG, isAiProviderId } from '@/lib/ai/providers'
import { listAiCredentials, resolveDefaultProvider, setDefaultAiProvider } from '@/lib/ai/credentials'

export async function GET() {
  try {
    const [credentials, defaults] = await Promise.all([
      listAiCredentials(),
      resolveDefaultProvider(),
    ])
    const configured = new Set(credentials.map((credential) => credential.provider_id))

    return NextResponse.json({
      success: true,
      data: {
        providers: AI_PROVIDER_CATALOG.map((provider) => ({
          ...provider,
          configured: configured.has(provider.id),
        })),
        credentials,
        defaults,
      },
    })
  } catch (err) {
    console.error('[GET /api/ai/providers]', err)
    return NextResponse.json({ success: false, error: 'Erreur fournisseurs IA' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { provider_id?: unknown; model?: unknown }
    if (!isAiProviderId(body.provider_id)) {
      return NextResponse.json({ success: false, error: 'Fournisseur IA invalide' }, { status: 400 })
    }

    await setDefaultAiProvider(body.provider_id, typeof body.model === 'string' ? body.model : null)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/ai/providers]', err)
    return NextResponse.json({ success: false, error: 'Erreur réglage fournisseur IA' }, { status: 500 })
  }
}
