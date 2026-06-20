"use client"

import * as React from "react"
import { Link, useLocation } from "react-router-dom"

import { NavGroup, type NavItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MaterialAndTextureIcon,
  FolderIcon,
  LayoutGridIcon,
  RulerIcon,
} from "@hugeicons/core-free-icons"
import { useProjects } from "@/hooks/useProjects"

const workspaceNav: NavItem[] = [
  {
    title: "Projects",
    url: "/projects",
    icon: <HugeiconsIcon icon={FolderIcon} strokeWidth={2} className="size-4" />,
  },
]

function QuickOptimizeButton() {
  const { pathname } = useLocation()
  const active = pathname === "/quick-optimize" || pathname.startsWith("/quick-optimize/")

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Quick Optimize"
          isActive={active}
          className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          render={
            <Link to="/quick-optimize">
              <HugeiconsIcon icon={MaterialAndTextureIcon} strokeWidth={2} className="size-4" />
              <span>Quick Optimize</span>
            </Link>
          }
        />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

const libraryNav: NavItem[] = [
  {
    title: "Apartment Types",
    url: "/apartment-templates",
    icon: <HugeiconsIcon icon={LayoutGridIcon} strokeWidth={2} className="size-4" />,
  },
  {
    title: "Piece Templates",
    url: "/templates",
    icon: <HugeiconsIcon icon={RulerIcon} strokeWidth={2} className="size-4" />,
  },
]

function RecentProjects() {
  const { data: projects } = useProjects()
  const { pathname } = useLocation()
  const { state } = useSidebar()
  const recent = (projects ?? []).slice(0, 5)

  if (recent.length === 0 || state === "collapsed") return null

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Recent Projects</SidebarGroupLabel>
      <SidebarMenu>
        {recent.map((p) => (
          <SidebarMenuItem key={p.id}>
            <SidebarMenuButton
              tooltip={p.name}
              isActive={pathname.startsWith(`/projects/${p.id}`)}
              render={<Link to={`/projects/${p.id}`}><span className="truncate">{p.name}</span></Link>}
            />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavUser />
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Workspace" items={workspaceNav} />
        <NavGroup label="Library" items={libraryNav} />
        <RecentProjects />
      </SidebarContent>
      <SidebarFooter>
        <QuickOptimizeButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
