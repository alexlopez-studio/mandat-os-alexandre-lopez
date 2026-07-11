import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentSuperAdmin } from '@/lib/auth'
import type { AdminRole, Database } from '@/types/supabase'

type AdminUpdate = Database['public']['Tables']['admin_users']['Update']
const VALID_ROLES: AdminRole[] = ['super_admin', 'admin']

/**
 * PATCH /api/admin/users/[id]
 * Modifie le rôle / l'activation d'un administrateur.
 * Body : { role?, is_active?, full_name? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const su = await getCurrentSuperAdmin()
  if (!su) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    const { id } = await params
    const body = await req.json()

    const { data: target } = await supabaseAdmin
      .from('admin_users')
      .select('id, role, is_active')
      .eq('id', id)
      .maybeSingle()

    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const update: AdminUpdate = {}
    if (VALID_ROLES.includes(body.role)) update.role = body.role
    if (typeof body.is_active === 'boolean') update.is_active = body.is_active
    if (typeof body.full_name === 'string') update.full_name = body.full_name.trim() || null

    // Garde-fou : un super admin ne peut pas se rétrograder ni se désactiver lui-même
    // (évite de se verrouiller hors de la gestion des utilisateurs).
    if (target.id === su.id) {
      if (update.role && update.role !== 'super_admin') {
        return NextResponse.json({ error: 'Vous ne pouvez pas retirer votre propre rôle super admin' }, { status: 400 })
      }
      if (update.is_active === false) {
        return NextResponse.json({ error: 'Vous ne pouvez pas désactiver votre propre compte' }, { status: 400 })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .update(update)
      .eq('id', id)
      .select('id, email, full_name, role, is_active, user_id, created_at')
      .single()

    if (error) {
      console.error('[API /admin/users/[id]] PATCH error:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ user: data })
  } catch (e) {
    console.error('[API /admin/users/[id]] PATCH', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Supprime un administrateur (compte Auth + fiche).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const su = await getCurrentSuperAdmin()
  if (!su) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    const { id } = await params

    if (id === su.id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 })
    }

    const { data: target } = await supabaseAdmin
      .from('admin_users')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()

    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    // Supprime le compte Auth associé (si lié)
    if (target.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(target.user_id)
    }
    const { error } = await supabaseAdmin.from('admin_users').delete().eq('id', id)
    if (error) {
      console.error('[API /admin/users/[id]] DELETE error:', error)
      return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[API /admin/users/[id]] DELETE', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
