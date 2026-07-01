import { useEffect } from "react";
import { useApp, ACTIONS } from "../context/AppContext";
import { StockPanel, SettingsPanel } from "../components/Input/InputPanel";
import DemandPieces from "../components/Demand/DemandPieces";
import ResultsPanel from "../components/Results/ResultsPanel";
import { validateInput } from "../engine/validator";
import {
  SparklesIcon,
  AlertCircleIcon,
  PackageIcon,
  Settings01Icon,
  CheckListIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

export default function QuickOptimize() {
  const { state, dispatch } = useApp();
  const { theme } = state.settings;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      root.classList.toggle("dark", prefersDark);
      root.setAttribute("data-theme", prefersDark ? "dark" : "light");

      const listener = (e: MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches);
        root.setAttribute("data-theme", e.matches ? "dark" : "light");
      };
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    } else {
      root.classList.toggle("dark", theme === "dark");
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  const handleOptimize = () => {
    const validation = validateInput(state);
    if (!validation.valid) {
      dispatch({
        type: ACTIONS.SET_VALIDATION_ERRORS,
        payload: validation.errors,
      });
      return;
    }
    dispatch({ type: ACTIONS.SET_OPTIMIZE_ANIMATION, payload: true });
    setTimeout(() => {
      dispatch({ type: ACTIONS.RUN_OPTIMIZE });
      dispatch({ type: ACTIONS.SET_OPTIMIZE_ANIMATION, payload: false });
    }, 400);
  };

  const totalPieces = state.demandPieces.reduce(
    (sum: number, p: any) => sum + p.quantity,
    0,
  );
  const hasInput = state.stockLengths.length > 0 && state.demandPieces.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Validation Errors */}
      {state.validationErrors.length > 0 && (
        <div className="px-4 pt-2 no-print w-full shrink-0">
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="px-4 py-2 flex items-start gap-3">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                size={16}
                className="text-destructive shrink-0 mt-0.5"
              />
              <div className="flex flex-col gap-0.5">
                {state.validationErrors.map((err: string, i: number) => (
                  <span key={i} className="text-sm text-destructive">
                    {err}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Shortage Warning */}
      {state.cuttingPlan?.unplaced && state.cuttingPlan.unplaced.count > 0 && (() => {
        const unplacedLength = state.cuttingPlan.unplaced.totalLength;
        const unplacedCount = state.cuttingPlan.unplaced.count;
        const unplacedWithKerf = unplacedLength + unplacedCount * state.settings.kerfWidth;
        const largestStock = [...state.stockLengths]
          .filter((s) => s.length > 0)
          .sort((a, b) => b.length - a.length)[0];
        const additionalBars = largestStock
          ? Math.ceil(unplacedWithKerf / largestStock.length)
          : null;
        return (
          <div className="px-4 pt-2 no-print w-full shrink-0">
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="px-4 py-2 flex items-start gap-3">
                <HugeiconsIcon
                  icon={AlertCircleIcon}
                  size={16}
                  className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    {unplacedCount} pieces ({Math.round(unplacedLength)}mm) couldn't be placed — insufficient stock.
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {additionalBars !== null
                      ? `${additionalBars}+ additional bars of ${largestStock.label || `${largestStock.length}mm`} needed · zero waste assumed`
                      : "Add more stock bars to fit all demand pieces."}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Desktop: 3-Column Layout */}
      <div className="flex-1 hidden lg:flex overflow-hidden">
        {/* Left: Stock + Settings (tabbed) */}
        <aside className="no-print w-[280px] xl:w-[320px] shrink-0 flex flex-col border-r overflow-hidden">
          <Tabs
            defaultValue="desktop-stock"
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-4 pt-4 pb-2">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="desktop-stock" className="gap-1.5">
                  <HugeiconsIcon
                    icon={PackageIcon}
                    size={14}
                    className="pointer-events-none"
                  />{" "}
                  Stock
                </TabsTrigger>
                <TabsTrigger value="desktop-settings" className="gap-1.5">
                  <HugeiconsIcon
                    icon={Settings01Icon}
                    size={14}
                    className="pointer-events-none"
                  />{" "}
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <TabsContent
                value="desktop-stock"
                className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                <StockPanel />
              </TabsContent>
              <TabsContent
                value="desktop-settings"
                className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                <SettingsPanel />
              </TabsContent>
            </div>
          </Tabs>
        </aside>

        {/* Center: Results */}
        <section className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5">
            <ResultsPanel />
          </div>
        </section>

        {/* Right: Demand Pieces */}
        <aside className="no-print w-[320px] xl:w-[360px] shrink-0 flex flex-col border-l overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <HugeiconsIcon icon={CheckListIcon} size={14} /> Demand Pieces
              </h2>
              <Badge
                variant="secondary"
                className="text-[10px] h-5 px-1.5 font-mono"
              >
                {totalPieces} pcs
              </Badge>
            </div>
            <DemandPieces />
          </div>

          {/* Fixed Optimize Bar at bottom of right sidebar */}
          <div className="border-t bg-background/95 backdrop-blur px-4 py-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <Button
                size="lg"
                className="px-4 font-semibold shadow-sm"
                onClick={handleOptimize}
                disabled={state.optimizeAnimation || !hasInput}
              >
                <HugeiconsIcon
                  icon={SparklesIcon}
                  size={16}
                  className={`mr-1.5 ${state.optimizeAnimation ? "animate-spin" : ""}`}
                />
                {state.optimizeAnimation ? "Working..." : "Optimize"}
              </Button>
              <span className="text-xs text-muted-foreground truncate">
                <strong className="text-foreground">{totalPieces}</strong> pcs ×{" "}
                <strong className="text-foreground">
                  {state.stockLengths.length}
                </strong>{" "}
                stock
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile/Tablet: 3-Tab Layout */}
      <div className="flex-1 flex flex-col lg:hidden overflow-hidden pt-12">
        <Tabs
          defaultValue="mobile-stock"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-4 pt-3 pb-2 no-print">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="mobile-stock" className="gap-1.5">
                <HugeiconsIcon icon={PackageIcon} size={14} /> Stock
              </TabsTrigger>
              <TabsTrigger value="mobile-settings" className="gap-1.5">
                <HugeiconsIcon icon={Settings01Icon} size={14} /> Settings
              </TabsTrigger>
              <TabsTrigger value="mobile-demand" className="gap-1.5">
                <HugeiconsIcon icon={CheckListIcon} size={14} /> Demand
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 no-print">
            <TabsContent
              value="mobile-stock"
              className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <StockPanel />
            </TabsContent>
            <TabsContent
              value="mobile-settings"
              className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <SettingsPanel />
            </TabsContent>
            <TabsContent
              value="mobile-demand"
              className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <DemandPieces />
            </TabsContent>
          </div>

          <div className="no-print border-t bg-background/95 backdrop-blur px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground truncate">
                <strong className="text-foreground">{totalPieces}</strong> pcs ×{" "}
                <strong className="text-foreground">
                  {state.stockLengths.length}
                </strong>{" "}
                stock
              </span>
              <Button
                size="lg"
                className="px-5 font-semibold shadow-sm"
                onClick={handleOptimize}
                disabled={state.optimizeAnimation || !hasInput}
              >
                <HugeiconsIcon
                  icon={SparklesIcon}
                  size={16}
                  className={`mr-2 ${state.optimizeAnimation ? "animate-spin" : ""}`}
                />
                {state.optimizeAnimation ? "Optimizing..." : "Optimize"}
              </Button>
            </div>
          </div>
        </Tabs>

        <div className="flex-1 overflow-y-auto p-4 border-t">
          <ResultsPanel />
        </div>
      </div>
    </div>
  );
}
