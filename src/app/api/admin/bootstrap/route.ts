import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/admin/bootstrap
 * Crée le tout premier compte super admin (Supabase Auth ne pouvant pas être
 * alimenté par une migration SQL).
 *
 * Protégé par un secret partagé : la variable d'env ADMIN_BOOTSTRAP_SECRET.
 * Body : { secret, email, password }
 *
 * À supprimer / désactiver (retirer la variable d'env) une fois le 1er compte créé.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_BOOTSTRAP_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Bootstrap désactivé' }, { status: 404 })
  }

  try {
    const body = await req.json()
    if (body.secret !== secret) {
      return NextResponse.json({ error: 'Secret invalide' }, { status: 401 })
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email.includes('@') || password.length < 8) {
      return NextResponse.json({ error: 'Email/mot de passe invalides' }, { status: 400 })
    }

    // Crée le compte Auth (email confirmé)
    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    let userId = created?.user?.id
    if (authError || !userId) {
      // Si le compte existe déjà, on le retrouve pour (re)lier la fiche admin
      const { data: list } = await supabaseAdmin.auth.admin.listUsers()
      const existing = list?.users.find((u) => u.email?.toLowerCase() === email)
      if (!existing) {
        return NextResponse.json({ error: authError?.message ?? 'Création impossible' }, { status: 400 })
      }
      userId = existing.id
    }

    // Upsert la fiche super_admin
    const { error: dbError } = await supabaseAdmin
      .from('admin_users')
      .upsert(
        { email, user_id: userId, role: 'super_admin', is_active: true },
        { onConflict: 'email' },
      )

    if (dbError) {
      return NextResponse.json({ error: 'Erreur fiche admin' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, email, role: 'super_admin' })
  } catch (e) {
    console.error('[API /admin/bootstrap] POST', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
