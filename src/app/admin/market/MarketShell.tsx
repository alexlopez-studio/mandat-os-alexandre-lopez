'use client'

import { Toaster } from '@/components/ui/sonner'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { NotificationsSheet } from '@/components/admin/NotificationsSheet'
import type { AdminRole } from '@/types/supabase'

export function MarketShell({
  children,
  role,
  email,
}: {
  children: React.ReactNode
  role: AdminRole
  email: string
}) {
  return (
    <SidebarProvider>
      <AppSidebar role={role} email={email} />
      <SidebarInset className="app-product min-w-0 bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-4 backdrop-blur lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="ml-auto">
            <NotificationsSheet />
          </div>
        </header>
        <div className="min-w-0 overflow-x-hidden p-4 lg:p-6">{children}</div>
      </SidebarInset>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  )
}
