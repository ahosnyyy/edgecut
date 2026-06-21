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
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ScissorIcon,
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

const toolsNav: NavItem[] = [
  {
    title: "Cutting Optimizer",
    url: "/cutting-optimizer",
    icon: <HugeiconsIcon icon={ScissorIcon} strokeWidth={2} className="size-4" />,
  },
]

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
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <div className="relative flex items-center py-1.5 transition-all duration-200 ease-linear group-data-[collapsible=icon]:justify-center">
          <img src="/logo.svg" alt="Edgecut" className="h-5 w-auto px-2 transition-opacity duration-200 ease-linear opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:absolute" />
          <img src="/logo-mark.svg" alt="Edgecut" className="h-5 w-auto transition-opacity duration-200 ease-linear opacity-0 absolute group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:static" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Workspace" items={workspaceNav} />
        <div className="hidden group-data-[collapsible=icon]:flex justify-center px-3">
          <SidebarSeparator className="w-8" />
        </div>
        <NavGroup label="Library" items={libraryNav} />
        <div className="hidden group-data-[collapsible=icon]:flex justify-center px-3">
          <SidebarSeparator className="w-8" />
        </div>
        <NavGroup label="Tools" items={toolsNav} />
        <RecentProjects />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
