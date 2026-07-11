import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'

/**
 * GET /api/admin/me
 * Renvoie le profil admin de l'utilisateur connecté (ou 401).
 */
export async function GET() {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  return NextResponse.json({
    admin: {
      email: admin.email,
      role: admin.role,
      full_name: admin.full_name,
    },
  })
}
