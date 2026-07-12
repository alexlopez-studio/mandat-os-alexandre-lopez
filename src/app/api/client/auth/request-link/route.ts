import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { buildClientPortalAuthRedirect } from '@/lib/client-portal-url'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string }
    const email = body.email?.trim().toLowerCase()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Email invalide' },
        { status: 400 },
      )
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('client_profiles')
      .select('id, is_active')
      .eq('email', email)
      .maybeSingle()

    if (profileError) {
      console.error('[client auth request-link] profile:', profileError)
      return NextResponse.json(
        { success: false, error: 'Impossible de préparer la connexion' },
        { status: 500 },
      )
    }

    if (!profile?.is_active) {
      return NextResponse.json(
        { success: false, error: 'Aucun espace client actif pour cet email' },
        { status: 404 },
      )
    }

    const emailRedirectTo = buildClientPortalAuthRedirect()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
      },
    })

    if (error) {
      console.error('[client auth request-link] otp:', error)
      return NextResponse.json(
        { success: false, error: 'Impossible d’envoyer le lien de connexion' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[client auth request-link]', err)
    return NextResponse.json(
      { success: false, error: 'Erreur connexion client' },
      { status: 500 },
    )
  }
}
