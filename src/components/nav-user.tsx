import { useNavigate } from "react-router-dom"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import { UnfoldMoreIcon, Logout01Icon, Settings01Icon, UserCircleIcon } from "@hugeicons/core-free-icons"
import { useAuth } from "@/auth/useAuth"

export function NavUser() {
  const { isMobile } = useSidebar()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "?"

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar className="rounded-md after:rounded-md">
              <AvatarFallback className="rounded-md text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-xs leading-tight">
              <span className="truncate font-medium">{user?.name || user?.email}</span>
              <span className="truncate text-xs">{user?.email}</span>
            </div>
            <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={2} className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="rounded-md after:rounded-md">
                    <AvatarFallback className="rounded-md text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user?.name || user?.email}</span>
                    <span className="truncate text-xs">{user?.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <HugeiconsIcon icon={UserCircleIcon} strokeWidth={2} />
                Profile
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
