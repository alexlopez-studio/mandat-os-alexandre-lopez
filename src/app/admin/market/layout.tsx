import { redirect } from 'next/navigation'
import { MarketShell } from './MarketShell'
import { getCurrentAdmin } from '@/lib/auth'

export default async function MarketLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await getCurrentAdmin()

  if (!admin) {
    redirect('/admin/login?redirect=/app/dashboard')
  }

  return (
    <MarketShell role={admin.role} email={admin.email}>
      {children}
    </MarketShell>
  )
}
