import { redirect } from 'next/navigation'

/**
 * /admin → redirige vers le dashboard Mandat OS.
 * (L'accès est protégé par le middleware + la garde du layout /app/dashboard.)
 */
export default function AdminPage() {
  redirect('/app/dashboard')
}
