import { MarketShell } from './MarketShell'

export default async function MarketLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth temporairement desactivee pour accelerer la navigation locale.
  // Pour reactiver : restaurer getCurrentAdmin() + redirect si aucun admin.
  const admin = {
    role: 'super_admin' as const,
    email: 'local-preview@iad.fr',
  }

  return (
    <MarketShell role={admin.role} email={admin.email}>
      {children}
    </MarketShell>
  )
}
