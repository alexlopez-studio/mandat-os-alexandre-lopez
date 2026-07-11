import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentSuperAdmin } from '@/lib/auth'
import type { AdminRole } from '@/types/supabase'

const VALID_ROLES: AdminRole[] = ['super_admin', 'admin']

/**
 * GET /api/admin/users
 * Liste les administrateurs (super admin uniquement).
 */
export async function GET() {
  const su = await getCurrentSuperAdmin()
  if (!su) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, email, full_name, role, is_active, user_id, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[API /admin/users] GET error:', error)
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] })
}

/**
 * POST /api/admin/users
 * Crée un administrateur (compte Auth + fiche admin_users).
 * Body : { email, full_name?, role?, password }
 */
export async function POST(req: NextRequest) {
  const su = await getCurrentSuperAdmin()
  if (!su) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    const body = await req.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : null
    const role: AdminRole = VALID_ROLES.includes(body.role) ? body.role : 'admin'

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Mot de passe trop court (8 caractères minimum)' }, { status: 400 })
    }

    // 1. Crée le compte Supabase Auth (email confirmé d'office)
    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    })

    if (authError || !created.user) {
      console.error('[API /admin/users] createUser:', authError)
      const msg = authError?.message?.includes('already')
        ? 'Un compte existe déjà avec cet email'
        : 'Impossible de créer le compte'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // 2. Upsert la fiche admin_users (whitelist + rôle)
    const { data: profile, error: dbError } = await supabaseAdmin
      .from('admin_users')
      .upsert(
        {
          email,
          user_id: created.user.id,
          role,
          full_name: fullName,
          is_active: true,
        },
        { onConflict: 'email' },
      )
      .select('id, email, full_name, role, is_active, user_id, created_at')
      .single()

    if (dbError) {
      // Rollback du compte Auth pour éviter un compte orphelin
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      console.error('[API /admin/users] upsert:', dbError)
      return NextResponse.json({ error: 'Erreur création de la fiche admin' }, { status: 500 })
    }

    return NextResponse.json({ user: profile }, { status: 201 })
  } catch (e) {
    console.error('[API /admin/users] POST', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
