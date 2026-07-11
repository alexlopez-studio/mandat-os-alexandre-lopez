import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentSuperAdmin } from '@/lib/auth'

/**
 * POST /api/admin/users/[id]/reset-password
 * Définit un nouveau mot de passe temporaire pour un administrateur.
 * Body : { password }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const su = await getCurrentSuperAdmin()
  if (!su) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    const { id } = await params
    const body = await req.json()
    const password = typeof body.password === 'string' ? body.password : ''

    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Mot de passe trop court (8 caractères minimum)' }, { status: 400 })
    }

    const { data: target } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('id', id)
      .maybeSingle()

    if (!target?.user_id) {
      return NextResponse.json({ error: 'Compte Auth non lié à cet utilisateur' }, { status: 404 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(target.user_id, { password })
    if (error) {
      console.error('[API /admin/users/[id]/reset-password]:', error)
      return NextResponse.json({ error: 'Erreur réinitialisation' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[API /admin/users/[id]/reset-password] POST', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
