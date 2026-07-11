import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { UsersClient } from './UsersClient'

export const metadata: Metadata = {
  title: 'Utilisateurs — Mandat OS',
}

export default async function UsersPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login?redirect=/app/utilisateurs')
  // Réservé au super admin
  if (admin.role !== 'super_admin') redirect('/app/dashboard')

  return <UsersClient currentUserId={admin.id} />
}
