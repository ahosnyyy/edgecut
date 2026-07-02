import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Pdf01Icon } from "@hugeicons/core-free-icons";
import type { CuttingPlan } from "../hooks/useCuttingPlans";
import type { PiecePoolGroupData } from "../hooks/usePiecePools";
import { generateExportPDF, type PlanSectionData } from "../utils/exportPDF";

export interface ExportAllDialogProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  buildingName: string;
  savedPlans: CuttingPlan[];
  piecePoolGroups: PiecePoolGroupData[];
  unit: string;
  unitLabel: string;
  getRGBForLength: (length: number) => [number, number, number];
  getStockById: (id: string) => { label: string; length: number } | null | undefined;
  profileTypeLabel: (key: string) => string;
}

export default function ExportAllDialog({
  open,
  onClose,
  projectName,
  buildingName,
  savedPlans,
  piecePoolGroups,
  unit,
  unitLabel,
  getRGBForLength,
  getStockById,
  profileTypeLabel,
}: ExportAllDialogProps) {
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(
    () => new Set(savedPlans.map((p) => p.id)),
  );
  const [includePiecePools, setIncludePiecePools] = useState(true);
  const [includeMiniPiecePools, setIncludeMiniPiecePools] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPlanIds(new Set(savedPlans.map((p) => p.id)));
    }
  }, [open, savedPlans]);

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const selectedPlans = savedPlans.filter((p) => selectedPlanIds.has(p.id));

      const planSections: PlanSectionData[] = selectedPlans.map((plan) => {
        const bars = JSON.parse(plan.bars);
        const summary = JSON.parse(plan.summary);
        return {
          profileType: plan.profileType,
          profileTypeLabel: profileTypeLabel(plan.profileType),
          isApplied: plan.isApplied,
          bars,
          summary,
        };
      });

      const pools = includePiecePools
        ? piecePoolGroups.filter((g) => g.sizeGroups.length > 0)
        : undefined;

      const pdf = await generateExportPDF({
        projectName,
        buildingName,
        plans: planSections,
        piecePoolGroups: pools,
        includeMiniPiecePools: includeMiniPiecePools && !!pools,
        unit,
        unitLabel,
        getRGBForLength,
        getStockById,
      });

      pdf.save(`cutting-plans-${buildingName.toLowerCase().replace(/\s+/g, "-")}.pdf`);
      onClose();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Cutting Plans</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Plans to include:</span>
            {savedPlans.length === 0 ? (
              <p className="text-xs text-muted-foreground">No saved plans found for this building.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {savedPlans.map((plan) => {
                  const summary = JSON.parse(plan.summary);
                  const checked = selectedPlanIds.has(plan.id);
                  return (
                    <label
                      key={plan.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border/60 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePlan(plan.id)}
                      />
                      <span className="text-sm flex-1">{profileTypeLabel(plan.profileType)}</span>
                      <Badge
                        variant="secondary"
                        className={
                          "text-[9px] px-1.5 py-0 h-4 " +
                          (plan.isApplied
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground")
                        }
                      >
                        {plan.isApplied ? "Applied" : "Saved"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {summary.totalBars} bars · {summary.totalWastePercent?.toFixed(1)}%
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 px-3 py-2 rounded-md border border-border/60">
            <label className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 transition-colors px-2 py-1 rounded">
              <Checkbox
                checked={includePiecePools}
                onCheckedChange={(v) => setIncludePiecePools(v === true)}
              />
              <span className="text-sm">Pool Table</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 transition-colors px-2 py-1 rounded">
              <Checkbox
                checked={includeMiniPiecePools}
                onCheckedChange={(v) => setIncludeMiniPiecePools(v === true)}
              />
              <span className="text-sm">Mini Tables</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedPlanIds.size === 0 || isExporting}
          >
            <HugeiconsIcon icon={Pdf01Icon} size={14} />
            {isExporting ? "Exporting..." : "Export PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
