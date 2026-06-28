import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FolderIcon,
  BuildingIcon,
  PackageIcon,
  Add01Icon,
  ArrowRight01Icon,
  Home13Icon,
} from "@hugeicons/core-free-icons";
import { useProjects } from "../hooks/useProjects";
import { useStockCoverage } from "../hooks/useDashboard";
import { useAuth } from "../auth/useAuth";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const { data: coverage } = useStockCoverage();
  const { user } = useAuth();

  const projectStats = useMemo(() => {
    const list = projects ?? [];
    const active = list.filter((p) => p.status === "active").length;
    const draft = list.filter((p) => p.status === "draft").length;
    const completed = list.filter((p) => p.status === "completed").length;
    return { total: list.length, active, draft, completed };
  }, [projects]);

  const buildingStats = useMemo(() => {
    const list = projects ?? [];
    const totalBuildings = list.reduce((s, p) => s + p.buildingCount, 0);
    const completedBuildings = list.reduce((s, p) => s + p.completedBuildings, 0);
    const activeBuildings = list
      .filter((p) => p.status === "active" || p.status === "draft")
      .reduce((s, p) => s + p.buildingCount, 0);
    return { totalBuildings, completedBuildings, activeBuildings };
  }, [projects]);

  const completionPct =
    buildingStats.totalBuildings > 0
      ? Math.round((buildingStats.completedBuildings / buildingStats.totalBuildings) * 100)
      : 0;
  const activeTotal = projectStats.active + projectStats.draft + projectStats.completed;
  const seg = (n: number) => (activeTotal > 0 ? (n / activeTotal) * 100 : 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 flex flex-col gap-4">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Welcome */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-stone-200/40 to-stone-300/30 border-stone-300/40">
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <CardContent className="relative pt-5 pb-5 flex flex-col gap-3 justify-between h-full">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-base font-semibold">
                  Welcome back, {user?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there"} 👋
                </span>
                <span className="text-[12px] text-muted-foreground/80">
                  You have <span className="font-medium text-foreground">{projectStats.active}</span> active project{projectStats.active !== 1 ? "s" : ""} · <span className="font-medium text-foreground">{buildingStats.activeBuildings}</span> active building{buildingStats.activeBuildings !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <div className="flex justify-end">
              <span className="text-[11px] text-muted-foreground/70">
                {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Active Projects */}
        <Card
          className="cursor-pointer hover:border-muted-foreground/30 transition-colors"
          onClick={() => navigate("/projects")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Projects</CardTitle>
            <HugeiconsIcon icon={FolderIcon} size={16} className="text-blue-500" />
          </CardHeader>
          <CardContent className="pt-0 flex flex-col gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{projectStats.active + projectStats.draft}</span>
              <span className="text-[11px] text-muted-foreground">active</span>
            </div>
            {activeTotal > 0 ? (
              <>
                <div className="flex items-center h-1.5 rounded-full overflow-hidden bg-muted">
                  <div className="h-full bg-emerald-500" style={{ width: `${seg(projectStats.active)}%` }} />
                  <div className="h-full bg-amber-500" style={{ width: `${seg(projectStats.draft)}%` }} />
                  <div className="h-full bg-blue-500" style={{ width: `${seg(projectStats.completed)}%` }} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500" />{projectStats.active} active</span>
                  <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500" />{projectStats.draft} draft</span>
                  <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-blue-500" />{projectStats.completed} done</span>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">No projects yet</p>
            )}
          </CardContent>
        </Card>

        {/* Completion */}
        <Card
          className="cursor-pointer hover:border-muted-foreground/30 transition-colors"
          onClick={() => navigate("/projects")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Completion</CardTitle>
            <HugeiconsIcon icon={BuildingIcon} size={16} className="text-violet-500" />
          </CardHeader>
          <CardContent className="pt-0 flex flex-col gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{completionPct}%</span>
              <span className="text-[11px] text-muted-foreground">
                {buildingStats.completedBuildings}/{buildingStats.totalBuildings} buildings
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Stock Coverage */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">Stock Coverage</CardTitle>
            {coverage?.hasData && (
              <Badge
                variant="secondary"
                className={
                  "text-[10px] h-5 px-2 " +
                  (coverage.coveragePct >= 90
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : coverage.coveragePct >= 60
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      : "bg-destructive/15 text-destructive")
                }
              >
                {coverage.coveragePct}%
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={() => navigate("/stock-catalog")}
          >
            Manage
            <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!coverage?.hasData ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <HugeiconsIcon icon={PackageIcon} size={24} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No active demand</p>
              <p className="text-xs text-muted-foreground">Coverage appears when projects have opening sizes</p>
            </div>
          ) : (
            <>

              {/* Per-system type tiles */}
              <div className="flex flex-col gap-4">
                {(() => {
                  const bySystem = new Map<string, typeof coverage.demandBreakdown>();
                  for (const d of coverage.demandBreakdown) {
                    const list = bySystem.get(d.system) ?? [];
                    list.push(d);
                    bySystem.set(d.system, list);
                  }
                  return Array.from(bySystem.entries()).map(([system, types]) => (
                    <div key={system} className="flex flex-col gap-2">
                      <span className="text-sm font-semibold capitalize">{system}</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {types.map((d) => {
                          const covPct = d.demandLength > 0
                            ? Math.min(100, Math.round((d.availableLength / d.demandLength) * 100))
                            : 100;
                          const deficit = Math.max(0, d.demandLength - d.availableLength);
                          const status = d.covered ? "covered" : covPct >= 60 ? "short" : "critical";
                          const statusLabel = d.covered ? "Covered" : covPct >= 60 ? "Short" : "Critical";
                          const barColor = d.covered
                            ? "bg-emerald-500"
                            : covPct >= 60
                              ? "bg-amber-500"
                              : "bg-destructive";

                          return (
                            <div
                              key={d.profileType}
                              className={
                                "flex flex-col gap-1.5 rounded-md border px-3 py-2.5 transition-colors " +
                                (status === "covered"
                                  ? "bg-card hover:bg-muted/30"
                                  : status === "short"
                                    ? "bg-amber-500/5 border-amber-500/20"
                                    : "bg-destructive/5 border-destructive/20")
                              }
                              onClick={() => navigate("/stock-catalog")}
                              style={{ cursor: "pointer" }}
                            >
                              {/* Type name + status */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium capitalize">{d.profileType}</span>
                                <span className={
                                  "text-[9px] font-medium px-1.5 py-0.5 rounded " +
                                  (status === "covered"
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : status === "short"
                                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-500"
                                      : "bg-destructive/15 text-destructive")
                                }>
                                  {statusLabel}
                                </span>
                              </div>

                              {/* Coverage bar */}
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={"h-full rounded-full " + barColor}
                                  style={{ width: `${covPct}%` }}
                                />
                              </div>

                              {/* Have / Need */}
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span className="tabular-nums">
                                  {(d.availableLength / 100).toFixed(0)} / {(d.demandLength / 100).toFixed(0)} cm
                                </span>
                                <span className={
                                  "tabular-nums font-medium " +
                                  (d.covered ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")
                                }>
                                  {covPct}%
                                </span>
                              </div>

                              {/* Bars to cover */}
                              {d.deficitBars > 0 && (
                                <div className="flex items-center gap-1.5 rounded bg-destructive/10 px-2 py-1 text-[9px] text-destructive font-medium">
                                  <span className="tabular-nums">−{((d.demandLength - d.availableLength) / 100).toFixed(0)}cm</span>
                                  <span className="text-destructive/40">·</span>
                                  <span className="tabular-nums">{d.deficitBars} bar{d.deficitBars !== 1 ? "s" : ""}</span>
                                  <span className="text-destructive/40">×</span>
                                  <span className="tabular-nums">{(d.barLength / 100).toFixed(0)}cm</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
