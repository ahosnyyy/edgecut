import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import { AppSidebar } from "../app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../ui/sidebar";
import { Separator } from "../ui/separator";
import { TooltipProvider } from "../ui/tooltip";
import { Button } from "../ui/button";
import { Sun01Icon, Moon02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { Badge } from "../ui/badge";
import { useProject } from "../../hooks/useProjects";
import { HeaderActionsProvider, useHeaderActions } from "./header-actions";

const routeLabels: Record<string, string> = {
  "quick-optimize": "Quick Optimize",
  projects: "Projects",
  "apartment-templates": "Apartment Types",
  templates: "Piece Templates",
  settings: "Settings",
};

function AppBreadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  const projectId = segments[0] === "projects" && segments[1] ? segments[1] : null;
  const { data: project } = useProject(projectId);

  if (segments.length === 0) return null;

  const crumbs: { label: string; path: string }[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += `/${seg}`;

    if (routeLabels[seg]) {
      crumbs.push({ label: routeLabels[seg], path: currentPath });
    } else if (i === segments.length - 1 && crumbs.length > 0) {
      if (projectId && project?.name) {
        crumbs.push({ label: project.name, path: currentPath });
      } else {
        crumbs.push({
          label: seg.length > 8 ? `${seg.slice(0, 8)}…` : seg,
          path: currentPath,
        });
      }
    }
  }

  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.path}>
              {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
              <BreadcrumbItem className="hidden md:block">
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link to={crumb.path} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
        {project?.status && (
          <Badge
            variant="secondary"
            className={
              "text-xs ml-1 " +
              (project.status === "active"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : project.status === "completed"
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                  : project.status === "archived"
                    ? "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400")
            }
          >
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Badge>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.setAttribute("data-theme", isDark ? "dark" : "light");
    try {
      localStorage.setItem("edgecut_theme", isDark ? "dark" : "light");
    } catch {}
  }, [isDark]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground"
      onClick={() => setIsDark((v) => !v)}
      title={isDark ? "Switch to light" : "Switch to dark"}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? (
        <HugeiconsIcon icon={Sun01Icon} size={16} />
      ) : (
        <HugeiconsIcon icon={Moon02Icon} size={16} />
      )}
    </Button>
  );
}

function HeaderBar() {
  const { actions } = useHeaderActions();
  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-10">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:self-center data-vertical:h-4"
        />
        <AppBreadcrumbs />
      </div>
      <div className="ml-auto flex items-center gap-2 pr-4">
        <ThemeToggle />
        {actions.map((action, i) => (
          <div key={i}>{action}</div>
        ))}
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <HeaderActionsProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <HeaderBar />
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </HeaderActionsProvider>
    </TooltipProvider>
  );
}
