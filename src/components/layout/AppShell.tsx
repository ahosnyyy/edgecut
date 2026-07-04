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
  dashboard: "Dashboard",
  "cutting-optimizer": "Quick Optimize",
  projects: "Projects",
  "apartment-templates": "Apartment Types",
  "piece-templates": "Piece Templates",
  "profile-systems": "Profile Systems",
  "stock-catalog": "Stock Catalog",
  settings: "Settings",
};

function AppBreadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  const projectId = segments[0] === "projects" && segments[1] ? segments[1] : null;
  const buildingId = segments[0] === "projects" && segments[2] === "buildings" && segments[3] ? segments[3] : null;
  const { data: project, isLoading: projectLoading } = useProject(projectId);

  if (segments.length === 0) return null;

  const crumbs: { label: string; path: string }[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += `/${seg}`;

    if (routeLabels[seg]) {
      crumbs.push({ label: routeLabels[seg], path: currentPath });
    } else if (seg === "buildings") {
      continue;
    } else if (projectId && i === 1) {
      if (project?.name) {
        crumbs.push({ label: project.name, path: currentPath });
      } else if (projectLoading) {
        crumbs.push({ label: "…", path: currentPath });
      } else {
        crumbs.push({ label: seg.length > 8 ? `${seg.slice(0, 8)}…` : seg, path: currentPath });
      }
    } else if (buildingId && i === 3) {
      const building = project?.buildings?.find((b) => b.id === buildingId || b.slug === buildingId);
      crumbs.push({ label: building?.name ?? (projectLoading ? "…" : "Building"), path: currentPath });
    } else if (i === segments.length - 1 && crumbs.length > 0) {
      if (projectId && project?.name) {
        crumbs.push({ label: project.name, path: currentPath });
      } else if (projectId && projectLoading) {
        crumbs.push({ label: "…", path: currentPath });
      } else {
        crumbs.push({
          label: seg.length > 8 ? `${seg.slice(0, 8)}…` : seg,
          path: currentPath,
        });
      }
    }
  }

  if (crumbs.length === 0) return null;

  // On mobile, show only the last crumb as a page title
  const mobileTitle = crumbs.length > 0 ? crumbs[crumbs.length - 1].label : null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Mobile: show only last crumb */}
        {mobileTitle && (
          <BreadcrumbItem className="md:hidden">
            <BreadcrumbPage className="truncate max-w-[40vw]">{mobileTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
        {/* Desktop: full breadcrumb trail */}
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
        {(() => {
          const building = buildingId ? project?.buildings?.find((b) => b.id === buildingId || b.slug === buildingId) : null;
          const status = building?.status ?? project?.status;
          if (!status) return null;
          return (
            <Badge
              variant="secondary"
              className={
                "text-[10px] px-1.5 py-0 h-4 ml-1 shrink-0 " +
                (status === "active"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : status === "completed"
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                    : status === "archived"
                      ? "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400")
              }
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          );
        })()}
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
    <header className="flex h-12 md:h-10 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-10">
      <div className="flex items-center gap-2 px-3 md:px-4 min-w-0">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:self-center data-vertical:h-4 hidden md:flex"
        />
        <div className="min-w-0 overflow-hidden">
          <AppBreadcrumbs />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1.5 md:gap-2 pr-3 md:pr-4 shrink-0">
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
          <SidebarInset className="overflow-hidden">
            <HeaderBar />
            <div className="flex flex-1 flex-col min-h-0 overflow-y-auto overflow-x-hidden">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </HeaderActionsProvider>
    </TooltipProvider>
  );
}
