"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2Icon,
  BarChart3Icon,
  BotIcon,
  KanbanIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  PackageIcon,
  UserPlusIcon,
  FlameIcon,
  type LucideIcon,
} from "lucide-react"
import type { AdminRole } from "@/types/supabase"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"

type SidebarNavItem = {
  title: string
  url: string
  icon: LucideIcon
}

const PILOTAGE_ITEMS: SidebarNavItem[] = [
  { title: "Dashboard", url: "/app/dashboard", icon: LayoutDashboardIcon },
  { title: "Assistant IA", url: "/app/assistant", icon: BotIcon },
]

const OPPORTUNITY_ITEMS: SidebarNavItem[] = [
  { title: "Opportunités / Mandats", url: "/app/opportunities", icon: KanbanIcon },
  { title: "Contacts", url: "/app/leads", icon: UserPlusIcon },
  { title: "Réseau", url: "/app/liste-chaude", icon: FlameIcon },
]

const MARKET_ITEMS: SidebarNavItem[] = [
  { title: "Biens", url: "/app/properties", icon: Building2Icon },
  { title: "Data & BI", url: "/app/dvf", icon: BarChart3Icon },
]

const CONFIG_ITEMS: SidebarNavItem[] = [
  { title: "Paramètres", url: "/app/settings", icon: SettingsIcon },
]

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  role?: AdminRole
  email?: string
}

export function AppSidebar({ role, email, ...props }: AppSidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/app/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  const withActiveState = (items: SidebarNavItem[]) =>
    items.map((item) => ({
      ...item,
      isActive: isActive(item.url),
    }))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
            <SidebarMenuButton
              asChild
              className="min-w-0 flex-1 data-[slot=sidebar-menu-button]:!p-1.5 group-data-[collapsible=icon]:flex-none"
            >
              <Link href="/app/dashboard">
                <PackageIcon className="h-5 w-5 text-primary" />
                <span className="text-base font-extrabold">Mandat OS</span>
              </Link>
            </SidebarMenuButton>
            <SidebarTrigger className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:mt-1" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain title="Pilotage" items={withActiveState(PILOTAGE_ITEMS)} />
        <NavMain title="Affaires" items={withActiveState(OPPORTUNITY_ITEMS)} />
        <NavMain title="Marché" items={withActiveState(MARKET_ITEMS)} />
        <NavMain title="Configuration" items={withActiveState(CONFIG_ITEMS)} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: email ? email.split("@")[0] : "Administrateur",
            email: email ?? "",
            avatar: "/alexandre-lopez-no-background.png",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
