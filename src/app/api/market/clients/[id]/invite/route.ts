import { NextRequest, NextResponse } from 'next/server'
import { loadAdminClientDossier, rejectIfNoAdmin } from '@/lib/market/client-admin'
import { sendClientPortalInviteEmail } from '@/lib/resend'
import { supabase, supabaseAdmin } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const denied = await rejectIfNoAdmin()
  if (denied) return denied

  const { id } = await context.params
  try {
    const body = await readJson(req)
    const returnLinkOnly = body.return_link === true
    const detail = await loadAdminClientDossier(id)
    if (!detail) return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 })

    const profile = detail.dossier.client_profile
    const siteUrl = returnLinkOnly ? req.nextUrl.origin : process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
    const redirectTo = `${siteUrl}/auth/callback?next=/espace-client`

    const generated = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
      options: { redirectTo },
    })

    const actionLink = generated.data?.properties?.action_link ?? null
    if (returnLinkOnly && actionLink) {
      return NextResponse.json({
        success: true,
        data: {
          delivery: 'manual',
          action_link: actionLink,
        },
      })
    }

    if (returnLinkOnly && !actionLink) {
      const signup = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: profile.email,
        password: crypto.randomUUID(),
        options: { redirectTo },
      })
      const signupLink = signup.data?.properties?.action_link ?? null
      if (signupLink) {
        return NextResponse.json({
          success: true,
          data: {
            delivery: 'manual',
            action_link: signupLink,
          },
        })
      }
      console.error('[POST /api/market/clients/[id]/invite] return link:', generated.error, signup.error)
      return NextResponse.json({ success: false, error: 'Lien client impossible à générer' }, { status: 500 })
    }

    if (actionLink) {
      const sent = await sendClientPortalInviteEmail({
        to: profile.email,
        prenom: profile.first_name,
        magicLinkUrl: actionLink,
      })

      return NextResponse.json({
        success: true,
        data: {
          delivery: sent ? 'resend' : 'manual',
          action_link: sent ? null : actionLink,
        },
      })
    }

    const fallback = await supabase.auth.signInWithOtp({
      email: profile.email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    })

    if (fallback.error) {
      console.error('[POST /api/market/clients/[id]/invite]', generated.error, fallback.error)
      return NextResponse.json({ success: false, error: 'Envoi impossible' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { delivery: 'supabase' } })
  } catch (err) {
    console.error('[POST /api/market/clients/[id]/invite]', err)
    return NextResponse.json({ success: false, error: 'Erreur invitation client' }, { status: 500 })
  }
}

async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const value = await req.json()
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  } catch {
    return {}
  }
}
