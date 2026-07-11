import { NextRequest, NextResponse } from 'next/server'
import { isAiProviderId } from '@/lib/ai/providers'
import { listAiCredentials, markCredentialTested, revokeAiCredential, upsertAiCredential } from '@/lib/ai/credentials'
import { testAiProvider } from '@/lib/ai/gateway'

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await listAiCredentials() })
  } catch (err) {
    console.error('[GET /api/ai/credentials]', err)
    return NextResponse.json({ success: false, error: 'Erreur lecture clés IA' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      provider_id?: unknown
      api_key?: unknown
      default_model?: unknown
      label?: unknown
      test?: unknown
    }

    if (!isAiProviderId(body.provider_id)) {
      return NextResponse.json({ success: false, error: 'Fournisseur IA invalide' }, { status: 400 })
    }
    if (typeof body.api_key !== 'string' || body.api_key.trim().length < 6) {
      return NextResponse.json({ success: false, error: 'Clé API invalide' }, { status: 400 })
    }

    const credential = await upsertAiCredential({
      providerId: body.provider_id,
      apiKey: body.api_key,
      defaultModel: typeof body.default_model === 'string' ? body.default_model : null,
      label: typeof body.label === 'string' ? body.label : null,
    })

    let testResult: { ok: boolean; error?: string } | null = null
    if (body.test !== false) {
      try {
        const ok = await testAiProvider(body.provider_id, credential.default_model)
        await markCredentialTested(body.provider_id, ok)
        testResult = { ok }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await markCredentialTested(body.provider_id, false, message)
        testResult = { ok: false, error: message }
      }
    }

    return NextResponse.json({ success: true, data: { credential_id: credential.id, test: testResult } })
  } catch (err) {
    console.error('[POST /api/ai/credentials]', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erreur clé IA' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'id requis' }, { status: 400 })
    await revokeAiCredential(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/ai/credentials]', err)
    return NextResponse.json({ success: false, error: 'Erreur révocation clé IA' }, { status: 500 })
  }
}
