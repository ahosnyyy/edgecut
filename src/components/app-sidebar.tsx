"use client"

import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { useEffect } from "react"

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
  Home13Icon,
  PackageIcon,
  SlidersVerticalIcon,
  DashboardSquare02Icon,
} from "@hugeicons/core-free-icons"
import { useProjects } from "@/hooks/useProjects"

const workspaceNav: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <HugeiconsIcon icon={DashboardSquare02Icon} strokeWidth={2} className="size-4" />,
  },
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

const catalogNav: NavItem[] = [
  {
    title: "Apartment Types",
    url: "/apartment-templates",
    icon: <HugeiconsIcon icon={Home13Icon} strokeWidth={2} className="size-4" />,
  },
  {
    title: "Profile Systems",
    url: "/profile-systems",
    icon: <HugeiconsIcon icon={SlidersVerticalIcon} strokeWidth={2} className="size-4" />,
  },
]

const inventoryNav: NavItem[] = [
  {
    title: "Stock Catalog",
    url: "/stock-catalog",
    icon: <HugeiconsIcon icon={PackageIcon} strokeWidth={2} className="size-4" />,
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
              isActive={pathname.startsWith(`/projects/${p.slug}`)}
              render={<Link to={`/projects/${p.slug}`}><span className="truncate">{p.name}</span></Link>}
            />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation()
  const { setOpenMobile, isMobile } = useSidebar()

  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [pathname, isMobile, setOpenMobile])

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <Link to="/dashboard" aria-label="Edgecut home" className="relative flex w-full min-w-0 items-center overflow-hidden py-1.5">
          <img src="/logo.svg" alt="Edgecut" className="h-5 w-auto max-w-none shrink-0 px-2 transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:opacity-0" />
          <img src="/logo-mark.svg" alt="Edgecut" className="absolute left-0 top-1/2 h-5 w-auto max-w-none shrink-0 -translate-y-1/2 px-2 opacity-0 transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:opacity-100" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Workspace" items={workspaceNav} />
        <div className="hidden group-data-[collapsible=icon]:flex justify-center px-3">
          <SidebarSeparator className="w-8" />
        </div>
        <NavGroup label="Inventory" items={inventoryNav} />
        <div className="hidden group-data-[collapsible=icon]:flex justify-center px-3">
          <SidebarSeparator className="w-8" />
        </div>
        <NavGroup label="Catalog" items={catalogNav} />
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
