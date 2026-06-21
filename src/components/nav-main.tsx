import { Link, useLocation } from "react-router-dom"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

export interface NavItem {
  title: string
  url: string
  icon?: React.ReactNode
  items?: {
    title: string
    url: string
  }[]
}

function isRouteActive(pathname: string, url: string): boolean {
  if (url === "/projects") {
    return pathname === "/projects" || pathname.startsWith("/projects/")
  }
  return pathname === url || pathname.startsWith(url + "/")
}

export function NavGroup({
  label,
  items,
}: {
  label: string
  items: NavItem[]
}) {
  const { pathname } = useLocation()

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => {
          const active = isRouteActive(pathname, item.url)

          if (!item.items?.length) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={item.title}
                  render={
                    <Link to={item.url}>
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
            )
          }

          return (
            <Collapsible
              key={item.title}
              defaultOpen={active}
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton tooltip={item.title} isActive={active}>
                    {item.icon}
                    <span>{item.title}</span>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      strokeWidth={2}
                      className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
                    />
                  </SidebarMenuButton>
                }
              />
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton
                        isActive={isRouteActive(pathname, subItem.url)}
                        render={<Link to={subItem.url}><span>{subItem.title}</span></Link>}
                      />
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
