import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { AdminRole } from '@/types/supabase'

export type AdminProfile = {
  id: string
  user_id: string
  email: string
  role: AdminRole
  full_name: string | null
  is_active: boolean
}

/**
 * Renvoie le profil admin de l'utilisateur connecté, ou null si :
 *  - pas de session Supabase,
 *  - email/user non présent dans admin_users,
 *  - compte désactivé.
 *
 * Lie automatiquement user_id à la fiche admin_users lors de la 1re connexion.
 */
export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) return null

  // Recherche par user_id (prioritaire) puis par email (1re connexion)
  const { data: byId } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  let record = byId
  if (!record) {
    const { data: byEmail } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .ilike('email', user.email)
      .maybeSingle()
    record = byEmail
    // Lie le user_id à la fiche si trouvée par email
    if (record && !record.user_id) {
      await supabaseAdmin
        .from('admin_users')
        .update({ user_id: user.id })
        .eq('id', record.id)
    }
  }

  if (!record || !record.is_active) return null

  return {
    id: record.id,
    user_id: user.id,
    email: record.email,
    role: record.role,
    full_name: record.full_name,
    is_active: record.is_active,
  }
}

/** Variante stricte : exige un super_admin, sinon renvoie null. */
export async function getCurrentSuperAdmin(): Promise<AdminProfile | null> {
  const admin = await getCurrentAdmin()
  return admin && admin.role === 'super_admin' ? admin : null
}
