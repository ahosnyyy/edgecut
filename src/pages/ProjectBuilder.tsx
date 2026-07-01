import { useState, useMemo, useEffect, Fragment, type ReactNode } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  useProject,
  useUpdateProject,
  useCreateBuilding,
  useSaveAssignments,
  useSaveOpeningSizes,
  useDeleteProject,
  useProjectPieces,
  useProjectStock,
  useAddStock,
  useUpdateStock,
  useDeleteStock,
  useStockCatalog,
  type Project,
  type StockEntry,
  type StockCatalogEntry,
} from "../hooks/useProjects";
import { apiFetch } from "../auth/apiClient";
import { Button } from "../components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { LoadingState } from "../components/ui/loading-states";
import { Spinner } from "../components/ui/spinner";
import { SaveButton, ConfirmDialog, DeleteGuardDialog } from "../components/ui/action-buttons";
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "../components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Delete02Icon,
  Add01Icon,
  AddSquareIcon,
  SaveIcon,
  PencilRulerIcon,
  BuildingIcon,
  AssignmentsIcon,
  RulerIcon,
  PuzzleIcon,
  PackageIcon,
  Settings01Icon,
  InformationSquareIcon,
  ArrowLeft01Icon,
  Recycle01Icon,
  ArrowRight01Icon,
  ArchiveArrowDownIcon,
  Search01Icon,
  FilterIcon,
  AlertCircleIcon,
  ScissorIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { useSettings } from "../hooks/useSettings";
import { useTemplate, type TemplatePiece } from "../hooks/useTemplates";
import { useProfileSystems, type SystemConstant } from "../hooks/useProfileSystems";
import { generatePieces, type TemplateVariable } from "../engine/pieceGenerator";
import { useProfileTypes } from "../hooks/useProfileTypes";
import { OptimizationTab } from "./OptimizationTab";

function useProfileTypeLabel() {
  const { data: profileTypes } = useProfileTypes();
  return (key: string) => profileTypes?.find((pt) => pt.key === key)?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

interface AssignmentGrid {
  [key: string]: string | null;
}

interface SizeGrid {
  [key: string]: { width: string; height: string };
}

export default function ProjectBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { kerfWidth: globalKerfWidth, optimizationStrategy: globalStrategy } = useSettings();
  const { data: project, isLoading } = useProject(id ?? null);
  const { data: stockEntries } = useProjectStock(id ?? null);
  const { data: allStockCatalog } = useStockCatalog();
  const { data: profileTypes } = useProfileTypes();
  const profileTypeLabel = useProfileTypeLabel();
  const lockedSystems = useMemo(() => {
    if (!stockEntries) return new Set<string>();
    const used = new Set<string>();
    for (const entry of stockEntries) {
      if (entry.profileSystem) {
        used.add(entry.profileSystem);
      } else if (entry.sourceDefaultId && allStockCatalog) {
        const def = allStockCatalog.find((d) => d.id === entry.sourceDefaultId);
        if (def) used.add(def.profileSystem);
      }
    }
    return used;
  }, [stockEntries, allStockCatalog]);
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const createBuildingMutation = useCreateBuilding();

  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [status, setStatus] = useState<Project["status"]>("draft");
  const [projectSearchParams, setProjectSearchParams] = useSearchParams();
  const activeTab = projectSearchParams.get("tab") ?? "buildings";
  const setActiveTab = (v: string) => {
    setProjectSearchParams(v === "buildings" ? {} : { tab: v }, { replace: true });
  };
  const [kerfWidth, setKerfWidth] = useState(5);
  const [optimizationStrategy, setOptimizationStrategy] = useState<Project["optimizationStrategy"]>("maximize_large_bars");
  const [profileSystem, setProfileSystem] = useState<string[]>(["manazil"]);

  // Buildings filters
  const [buildingSearch, setBuildingSearch] = useState("");
  const [buildingFilterStatus, setBuildingFilterStatus] = useState<string>("all");

  // Stock filters
  const [stockSearch, setStockSearch] = useState("");
  const [stockFilterType, setStockFilterType] = useState<string>("all");
  const [stockFilterSystem, setStockFilterSystem] = useState<string>("all");

  useEffect(() => {
    if (project) {
      setName(project.name);
      setClient(project.client ?? "");
      setStatus(project.status);
      setKerfWidth(project.kerfWidth ?? globalKerfWidth);
      setOptimizationStrategy(project.optimizationStrategy ?? globalStrategy);
      setProfileSystem(project.profileSystem ?? ["manazil"]);
    }
  }, [project]);

  const handleSaveSettings = async () => {
    if (!id) return;
    await updateMutation.mutateAsync({
      id,
      data: {
        name,
        client,
        kerfWidth,
        optimizationStrategy,
        profileSystem,
      },
    });
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteMutation.mutateAsync(id);
    navigate("/projects");
  };

  const handleArchive = async () => {
    if (!id) return;
    await updateMutation.mutateAsync({ id, data: { status: "archived" } });
    setStatus("archived");
  };

  if (isLoading) {
    return (
      <LoadingState label="Loading project..." className="h-full" />
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const buildings = project.buildings ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 shrink-0">
        <h1 className="text-lg font-semibold truncate">{project.name}</h1>
        {project.client && (
          <span className="text-sm text-muted-foreground truncate">· {project.client}</span>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="buildings">
                <HugeiconsIcon icon={BuildingIcon} size={14} />
                Buildings
              </TabsTrigger>
              <TabsTrigger value="stock">
                <HugeiconsIcon icon={PackageIcon} size={14} />
                Stock
              </TabsTrigger>
            </TabsList>
            <TabsList>
              <TabsTrigger value="settings">
                <HugeiconsIcon icon={Settings01Icon} size={14} />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="buildings" className="flex-1">
            <div className="flex items-center justify-end gap-2">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  value={buildingSearch}
                  onChange={(e) => setBuildingSearch(e.target.value)}
                  placeholder="Search buildings..."
                  className="w-44 pl-7 h-8 text-xs"
                />
              </div>
              <Select
                value={buildingFilterStatus}
                onValueChange={(v) => setBuildingFilterStatus(v ?? "all")}
              >
                <SelectTrigger className="w-32 h-8 text-xs gap-1.5">
                  <HugeiconsIcon icon={FilterIcon} size={14} className="text-muted-foreground" />
                  <SelectValue>
                    {buildingFilterStatus === "all" ? "All Status" : buildingFilterStatus.charAt(0).toUpperCase() + buildingFilterStatus.slice(1)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {buildingStatusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="stock" className="flex-1">
            <div className="flex items-center justify-end gap-2">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="Search stock..."
                  className="w-44 pl-7 h-8 text-xs"
                />
              </div>
              <Select
                value={stockFilterSystem}
                onValueChange={(v) => setStockFilterSystem(v ?? "all")}
              >
                <SelectTrigger className="w-28 h-8 text-xs gap-1.5">
                  <HugeiconsIcon icon={FilterIcon} size={14} className="text-muted-foreground" />
                  <SelectValue>
                    {stockFilterSystem === "all" ? "All Systems" : stockFilterSystem.charAt(0).toUpperCase() + stockFilterSystem.slice(1)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Systems</SelectItem>
                  {profileSystem.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={stockFilterType}
                onValueChange={(v) => setStockFilterType(v ?? "all")}
              >
                <SelectTrigger className="w-32 h-8 text-xs gap-1.5">
                  <HugeiconsIcon icon={FilterIcon} size={14} className="text-muted-foreground" />
                  <SelectValue>
                    {stockFilterType === "all" ? "All Types" : profileTypeLabel(stockFilterType)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(profileTypes ?? []).map(([, pt]) => (
                    <SelectItem key={pt.key} value={pt.key}>{pt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 py-2">
            <TabsContent value="buildings">
              <BuildingsManager
                projectId={id!}
                projectSlug={project.slug}
                buildings={buildings}
                onCreateBuilding={createBuildingMutation.mutateAsync}
                search={buildingSearch}
                setSearch={setBuildingSearch}
                filterStatus={buildingFilterStatus}
                setFilterStatus={setBuildingFilterStatus}
              />
            </TabsContent>
            <TabsContent value="stock">
              <StockManagement
                projectId={id!}
                profileSystems={profileSystem}
                search={stockSearch}
                setSearch={setStockSearch}
                filterType={stockFilterType}
                setFilterType={setStockFilterType}
                filterSystem={stockFilterSystem}
                setFilterSystem={setStockFilterSystem}
              />
            </TabsContent>
            <TabsContent value="settings">
              <ProjectSettings
                name={name}
                client={client}
                status={status}
                onNameChange={setName}
                onClientChange={setClient}
                onSave={handleSaveSettings}
                isSaving={updateMutation.isPending}
                onDelete={handleDelete}
                onArchive={handleArchive}
                isDeleting={deleteMutation.isPending}
                isArchiving={updateMutation.isPending}
                kerfWidth={kerfWidth}
                optimizationStrategy={optimizationStrategy}
                profileSystem={profileSystem}
                lockedSystems={lockedSystems}
                onKerfWidthChange={setKerfWidth}
                onOptimizationStrategyChange={setOptimizationStrategy}
                onProfileSystemChange={setProfileSystem}
                globalKerfWidth={globalKerfWidth}
                globalStrategy={globalStrategy}
              />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// ─── Stock Tab ────────────────────────────────────────────────────────────────

function StockManagement({ projectId, profileSystems, search, setSearch, filterType, setFilterType, filterSystem, setFilterSystem }: { 
  projectId: string;
  profileSystems: string[];
  search: string;
  setSearch: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterSystem: string;
  setFilterSystem: (v: string) => void;
}) {
  const { data: stockEntries, isLoading } = useProjectStock(projectId);
  const { data: stockCatalog } = useStockCatalog(profileSystems);
  const { fromMM: convertFromMM, toMM: convertToMM, formatLength, unitLabel } = useSettings();
  const { data: profileTypes } = useProfileTypes();
  const profileTypeLabel = useProfileTypeLabel();
  const addMutation = useAddStock();
  const updateStockMutation = useUpdateStock();
  const deleteMutation = useDeleteStock();

  const [view, setView] = useState<"stock" | "remnants">("stock");
  const [showCreate, setShowCreate] = useState(false);
  const [newQty, setNewQty] = useState(-1);
  const [newLength, setNewLength] = useState<number | "">("");
  const [newLabel, setNewLabel] = useState("");
  const [selectedDefaultId, setSelectedDefaultId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"catalog" | "custom">("catalog");

  const defaultsForView = useMemo(() => {
    if (!stockCatalog || view === "remnants") return [];
    return stockCatalog;
  }, [stockCatalog, view]);

  const effectiveMode = defaultsForView.length === 0 ? "custom" : addMode;

  const getAvailableQty = (defaultId: string | null): number => {
    if (!defaultId) return -1;
    const def = stockCatalog?.find((d) => d.id === defaultId);
    if (!def || def.quantity === -1) return -1;
    return def.quantity - def.reservedQty;
  };

  const [qtyError, setQtyError] = useState<string | null>(null);

  const handlePickDefault = (defaultId: string) => {
    const def = stockCatalog?.find((d) => d.id === defaultId);
    if (!def) return;
    setSelectedDefaultId(defaultId);
    const available = def.quantity === -1 ? -1 : def.quantity - def.reservedQty;
    setNewQty(available <= 0 ? 0 : available);
    setNewLength(def.length);
    setNewLabel("");
  };

  const filtered = useMemo(() => {
    if (!stockEntries) return [];
    let result = stockEntries.filter((s) => s.isRemnant === (view === "remnants"));
    if (filterSystem !== "all") {
      result = result.filter((s) => {
        const def = s.sourceDefaultId ? stockCatalog?.find((d) => d.id === s.sourceDefaultId) : null;
        return (s.profileSystem ?? def?.profileSystem) === filterSystem;
      });
    }
    if (filterType !== "all") {
      result = result.filter((s) => {
        const def = s.sourceDefaultId ? stockCatalog?.find((d) => d.id === s.sourceDefaultId) : null;
        return def?.profileType === filterType;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => {
        const def = s.sourceDefaultId ? stockCatalog?.find((d) => d.id === s.sourceDefaultId) : null;
        return (
          (def?.label ?? "").toLowerCase().includes(q) ||
          (def?.profileType ?? "").toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [stockEntries, view, search, filterType, filterSystem, stockCatalog]);

  const handleAdd = () => {
    const isRemnant = view === "remnants";
    const qty = isRemnant ? (newQty === -1 ? 1 : newQty) : newQty;

    // Require label for custom entries
    if (effectiveMode === "custom" && !newLabel.trim()) {
      setQtyError("Label is required for custom entries.");
      return;
    }

    // Require length for custom entries (remnants or manual stock)
    if (effectiveMode === "custom" && (newLength === "" || newLength <= 0)) {
      setQtyError("Length is required.");
      return;
    }

    // Require catalog selection in catalog mode
    if (effectiveMode === "catalog" && defaultsForView.length > 0 && !selectedDefaultId) {
      setQtyError("Please pick a catalog entry or switch to Custom.");
      return;
    }

    // Check available inventory on the linked default
    if (selectedDefaultId && qty > 0) {
      const available = getAvailableQty(selectedDefaultId);
      if (available >= 0 && qty > available) {
        setQtyError(
          `Only ${available} available. Cannot add ${qty}.`
        );
        return;
      }
    }
    setQtyError(null);

    // Check if an entry with the same sourceDefaultId already exists
    const existing = filtered.find(
      (s) => s.sourceDefaultId === (selectedDefaultId ?? null) && s.isRemnant === isRemnant,
    );

    if (existing && qty > 0) {
      // Bump quantity on existing entry
      const newQty = (existing.quantity === -1 ? 0 : existing.quantity) + qty;
      updateStockMutation.mutate({
        projectId,
        stockId: existing.id,
        data: { quantity: newQty },
      });
    } else {
      const def = selectedDefaultId ? stockCatalog?.find((d) => d.id === selectedDefaultId) : null;
      addMutation.mutate({
        projectId,
        data: {
          profileType: def?.profileType ?? "",
          color: def?.color ?? "#000000",
          length: newLength === "" ? (def?.length ?? null) : newLength,
          label: effectiveMode === "custom" ? (newLabel.trim() || null) : (def?.label ?? null),
          quantity: qty,
          isRemnant,
          sourceDefaultId: selectedDefaultId,
        },
      });
    }
    setShowCreate(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ projectId, stockId: id });
  };

  const resetForm = () => {
    setSelectedDefaultId(null);
    setNewQty(-1);
    setNewLength("");
    setNewLabel("");
    setQtyError(null);
    setAddMode("catalog");
  };

  if (isLoading) {
    return (
      <LoadingState label="Loading stock..." />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5 w-fit">
          <button
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              view === "stock"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setView("stock")}
          >
            Stock
          </button>
          <button
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              view === "remnants"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setView("remnants")}
          >
            Remnants
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        (search.trim() || filterType !== "all" || filterSystem !== "all") ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={FilterIcon} />
              </EmptyMedia>
              <EmptyTitle>No {view === "remnants" ? "remnants" : "stock"} match your filters</EmptyTitle>
              <EmptyDescription>
                {search.trim()
                  ? `No results for "${search.trim()}".`
                  : `No ${view === "remnants" ? "remnants" : "stock"} with the selected filters.`}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilterType("all"); setFilterSystem("all"); }}>
                Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={view === "remnants" ? Recycle01Icon : PackageIcon} />
              </EmptyMedia>
              <EmptyTitle>No {view === "remnants" ? "remnants" : "stock"} yet</EmptyTitle>
              <EmptyDescription>
                {view === "remnants"
                  ? "Add leftover pieces from previous cuts."
                  : "Add stock bars available for cutting."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button className="gap-1.5" onClick={() => setShowCreate(true)}>
                <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
                Add {view === "remnants" ? "Remnant" : "Stock"}
              </Button>
            </EmptyContent>
          </Empty>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <Card
            size="sm"
            className="cursor-pointer border border-dashed border-muted-foreground/30 ring-0 bg-muted/10 hover:border-primary/40 hover:bg-muted/20 transition-colors"
            onClick={() => setShowCreate(true)}
          >
            <div className="flex flex-col items-center justify-center gap-1.5 py-3">
              <HugeiconsIcon icon={view === "remnants" ? Recycle01Icon : PackageIcon} size={20} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Add {view === "remnants" ? "Remnant" : "Stock"}</span>
            </div>
          </Card>
          {filtered.map((entry) => (
            <Card
              key={entry.id}
              size="sm"
              className={`pb-0 transition-colors ${entry.isRemnant ? "border-dashed" : ""} group`}
            >
              <CardHeader className="pb-1">
                <CardAction>
                  <DeleteGuardDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={13} />
                      </Button>
                    }
                    usageCheckUrl={`/api/projects/${projectId}/stock/${entry.id}/usage`}
                    title="Delete stock entry?"
                    description="This will permanently remove the stock entry from this project."
                    confirmLabel="Delete"
                    isPending={deleteMutation.isPending}
                    onConfirm={() => handleDelete(entry.id)}
                  />
                </CardAction>
                <CardTitle className="text-sm truncate flex items-center gap-1.5">
                  {entry.isRemnant && (
                    <HugeiconsIcon icon={Recycle01Icon} size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                  )}
                  {(() => {
                    const def = entry.sourceDefaultId
                      ? stockCatalog?.find((d) => d.id === entry.sourceDefaultId)
                      : null;
                    return def?.label ?? entry.label ?? (entry.isRemnant ? "Remnant" : "Stock");
                  })()}
                </CardTitle>
                <CardDescription className="text-xs truncate flex items-center gap-1.5">
                  {(() => {
                    const def = entry.sourceDefaultId
                      ? stockCatalog?.find((d) => d.id === entry.sourceDefaultId)
                      : null;
                    const sysKey = entry.profileSystem ?? def?.profileSystem ?? null;
                    return (
                      <>
                        {sysKey && (
                          <Badge
                            variant="secondary"
                            className={
                              "text-[9px] px-1 py-0 h-4 capitalize shrink-0 " +
                              (sysKey === "manazil"
                                ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                : "bg-orange-500/15 text-orange-700 dark:text-orange-400")
                            }
                          >
                            {sysKey}
                          </Badge>
                        )}
                        <span className="truncate">
                          {def
                            ? ` · ${profileTypeLabel(def.profileType)} · ${formatLength(entry.length ?? def.length)}`
                            : entry.length != null
                              ? ` · ${profileTypeLabel(entry.profileType)} · ${formatLength(entry.length)}`
                              : "Custom"}
                        </span>
                      </>
                    );
                  })()}
                </CardDescription>
              </CardHeader>
              <CardFooter className="bg-muted/50 py-2.5">
                <div className="flex items-center justify-between w-full gap-2 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>{entry.quantity === -1 ? "∞ unlimited" : `${entry.quantity} bars`}</span>
                    {entry.isRemnant && (
                      <>
                        <Separator orientation="vertical" className="my-0.5" />
                        <span>Remnant</span>
                      </>
                    )}
                  </div>
                  {entry.quantity !== -1 && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <input
                        type="number"
                        min={1}
                        defaultValue={10}
                        className="w-12 h-5 px-1 text-[10px] text-center rounded border bg-background"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = parseInt((e.target as HTMLInputElement).value, 10);
                            if (!isNaN(val) && val !== 0) {
                              const available = getAvailableQty(entry.sourceDefaultId);
                              if (available >= 0 && val > 0 && val > available) {
                                return;
                              }
                              updateStockMutation.mutate({
                                projectId,
                                stockId: entry.id,
                                data: { quantity: Math.max(0, entry.quantity + val) },
                              });
                              (e.target as HTMLInputElement).value = "10";
                            }
                          }
                        }}
                      />
                      <button
                        className="flex items-center justify-center h-5 w-5 rounded border bg-background hover:bg-accent transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          const input = (e.currentTarget.previousSibling as HTMLInputElement);
                          const val = parseInt(input.value, 10);
                          if (!isNaN(val) && val !== 0) {
                            const available = getAvailableQty(entry.sourceDefaultId);
                            if (available >= 0 && val > 0 && val > available) {
                              return;
                            }
                            updateStockMutation.mutate({
                              projectId,
                              stockId: entry.id,
                              data: { quantity: Math.max(0, entry.quantity + val) },
                            });
                            input.value = "10";
                          }
                        }}
                      >
                        <HugeiconsIcon icon={Add01Icon} size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setShowCreate(false); resetForm(); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New {view === "remnants" ? "Remnant" : "Stock"}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              {defaultsForView.length > 0 && (
                <div className="grid grid-cols-2 gap-0 rounded-md border overflow-hidden">
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      effectiveMode === "catalog"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() => { setAddMode("catalog"); setSelectedDefaultId(null); setNewLabel(""); }}
                  >
                    From Catalog
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      effectiveMode === "custom"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() => { setAddMode("custom"); setSelectedDefaultId(null); setNewLength(""); }}
                  >
                    Custom
                  </button>
                </div>
              )}

              {effectiveMode === "catalog" && defaultsForView.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ns-default">Pick from catalog ({profileSystems.join(", ")})</Label>
                  <Select
                    value={selectedDefaultId ?? ""}
                    onValueChange={(v) => v && handlePickDefault(v)}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="Choose a catalog entry...">
                        {selectedDefaultId
                          ? stockCatalog?.find((d) => d.id === selectedDefaultId)?.label ?? "Custom"
                          : "Choose a catalog entry..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {defaultsForView.map((d) => {
                        const avail = d.quantity === -1 ? -1 : d.quantity - d.reservedQty;
                        return (
                          <SelectItem key={d.id} value={d.id}>
                            <span className="flex items-center gap-2">
                              {d.label ?? `${d.profileType} ${formatLength(d.length)}`}
                              {avail >= 0 && (
                                <span className={
                                  "text-[10px] " +
                                  (avail <= 0
                                    ? "text-red-500"
                                    : avail <= Math.max(5, d.quantity * 0.15)
                                      ? "text-amber-500"
                                      : "text-muted-foreground")
                                }>
                                  ({avail} avail)
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {effectiveMode === "custom" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ns-label">Label <span className="text-red-500">*</span></Label>
                  <Input
                    id="ns-label"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Leftover from job X"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ns-length">
                    Length ({unitLabel})
                    {effectiveMode === "catalog" ? (
                      <span className="text-[10px] text-muted-foreground ml-1">(from catalog)</span>
                    ) : (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                  </Label>
                  <Input
                    id="ns-length"
                    type="number"
                    min={1}
                    value={newLength === "" ? "" : convertFromMM(newLength)}
                    disabled={effectiveMode === "catalog"}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewLength(isNaN(val) ? "" : convertToMM(val));
                    }}
                    placeholder="e.g. 350"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ns-qty">
                    Quantity
                    {effectiveMode === "catalog" && selectedDefaultId && newQty !== -1 && (
                      <span className="text-[10px] text-muted-foreground ml-1">(of {stockCatalog?.find(d => d.id === selectedDefaultId)?.quantity ?? 0} total)</span>
                    )}
                  </Label>
                  <Input
                    id="ns-qty"
                    type="text"
                    value={newQty === -1 ? "∞" : String(newQty)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === "∞" || raw === "" || raw.toLowerCase() === "inf") {
                        setNewQty(-1);
                      } else {
                        const val = parseInt(raw, 10);
                        if (!isNaN(val) && val >= 0) setNewQty(val);
                      }
                    }}
                    placeholder="∞"
                  />
                </div>
              </div>
              {qtyError && (
                <p className="text-xs text-red-500">{qtyError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleAdd} disabled={addMutation.isPending} className="gap-1.5">
                {addMutation.isPending ? <Spinner className="size-4" /> : <HugeiconsIcon icon={Add01Icon} size={14} />}
                {addMutation.isPending ? "Adding..." : `Add ${view === "remnants" ? "Remnant" : "Stock"}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function ProjectSettings({
  name, client, status, onNameChange, onClientChange, onSave, isSaving, onDelete, onArchive, isDeleting, isArchiving,
  kerfWidth, optimizationStrategy, profileSystem, lockedSystems,
  onKerfWidthChange, onOptimizationStrategyChange, onProfileSystemChange,
  globalKerfWidth, globalStrategy,
}: {
  name: string;
  client: string;
  status: Project["status"];
  onNameChange: (v: string) => void;
  onClientChange: (v: string) => void;
  onSave: () => void;
  isSaving: boolean;
  onDelete: () => void;
  onArchive: () => void;
  isDeleting: boolean;
  isArchiving: boolean;
  kerfWidth: number;
  optimizationStrategy: Project["optimizationStrategy"];
  profileSystem: string[];
  lockedSystems: Set<string>;
  onKerfWidthChange: (v: number) => void;
  onOptimizationStrategyChange: (v: Project["optimizationStrategy"]) => void;
  onProfileSystemChange: (v: string[]) => void;
  globalKerfWidth: number;
  globalStrategy: Project["optimizationStrategy"];
}) {
  const { unitLabel } = useSettings();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-stretch gap-4">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-sm">General</CardTitle>
            <CardDescription className="text-xs">Basic project information and status.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <Label htmlFor="p-name" className="text-xs text-muted-foreground">Name</Label>
              <Input id="p-name" value={name} onChange={(e) => onNameChange(e.target.value)} className="h-7 " />
            </div>
            <Separator />
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <Label htmlFor="p-client" className="text-xs text-muted-foreground">Client</Label>
              <Input id="p-client" value={client} onChange={(e) => onClientChange(e.target.value)} className="h-7 " />
            </div>
            <Separator />
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={
                    "text-[10px] " +
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
                <span className="text-[10px] text-muted-foreground">Derived from building statuses</span>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <Label className="text-xs text-muted-foreground">Profile</Label>
              <div className="flex flex-col gap-1">
                <Combobox
                  items={["manazil", "premier"]}
                  multiple
                  value={profileSystem}
                  onValueChange={(v) => {
                    const next = v as string[];
                    const filtered = next.filter((s) => !lockedSystems.has(s) || profileSystem.includes(s));
                    onProfileSystemChange(
                      filtered.length === 0 ? profileSystem : Array.from(new Set(filtered))
                    );
                  }}
                >
                  <ComboboxChips>
                    <ComboboxValue>
                      {profileSystem.map((item) => (
                        <ComboboxChip key={item} showRemove={!lockedSystems.has(item)}>
                          {item.charAt(0).toUpperCase() + item.slice(1)}
                        </ComboboxChip>
                      ))}
                    </ComboboxValue>
                    <ComboboxChipsInput placeholder="Add profile system..." />
                  </ComboboxChips>
                  <ComboboxContent>
                    <ComboboxEmpty>No systems found.</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item.charAt(0).toUpperCase() + item.slice(1)}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {lockedSystems.size > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {Array.from(lockedSystems).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")} in use by stock entries.
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-sm">Optimization</CardTitle>
            <CardDescription className="text-xs">Cutting optimizer settings for this project.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground">{unitLabel}</span>
                <span className="text-[10px] text-muted-foreground">Set in <button onClick={() => navigate("/settings")} className="underline hover:text-foreground">Settings</button></span>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <Label htmlFor="p-kerf" className="text-xs text-muted-foreground">Kerf Width</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="p-kerf"
                  type="number"
                  value={kerfWidth}
                  onChange={(e) => onKerfWidthChange(parseFloat(e.target.value) || 0)}
                  className="h-7  w-full"
                />
                <span className="text-xs text-muted-foreground shrink-0">mm</span>
                {kerfWidth === globalKerfWidth && (
                  <span className="text-[10px] text-muted-foreground shrink-0">Global default</span>
                )}
                {kerfWidth !== globalKerfWidth && (
                  <button
                    type="button"
                    onClick={() => onKerfWidthChange(globalKerfWidth)}
                    className="text-[10px] text-muted-foreground underline hover:text-foreground shrink-0"
                  >Reset</button>
                )}
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <Label className="text-xs text-muted-foreground">Goal</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={optimizationStrategy}
                  onValueChange={(v) => onOptimizationStrategyChange(v as Project["optimizationStrategy"])}
                >
                  <SelectTrigger className="h-7 text-xs w-full">
                    <SelectValue>
                      {optimizationStrategy === "maximize_large_bars" ? "Maximize Large Bars" : "Balanced"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maximize_large_bars">Maximize Large Bars</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                  </SelectContent>
                </Select>
                {optimizationStrategy === globalStrategy ? (
                  <span className="text-[10px] text-muted-foreground shrink-0">Global</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOptimizationStrategyChange(globalStrategy)}
                    className="text-[10px] text-muted-foreground underline hover:text-foreground shrink-0"
                  >Reset</button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <SaveButton
          onClick={onSave}
          isPending={isSaving}
          disabled={false}
        />
      </div>
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
          <CardDescription className="text-xs">Irreversible and destructive actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium">Archive this project</span>
                <span className="text-xs text-muted-foreground">Mark all buildings as archived and hide from active lists.</span>
              </div>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="gap-1.5 shrink-0 w-36 justify-center" disabled={status === "archived" || isArchiving}>
                    <HugeiconsIcon icon={ArchiveArrowDownIcon} size={14} />
                    Archive Project
                  </Button>
                }
                title="Archive this project?"
                description="This will mark all buildings as archived and hide them from active lists. You can still find archived projects in the project list."
                confirmLabel="Archive"
                variant="default"
                isPending={isArchiving}
                onConfirm={onArchive}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium">Delete this project</span>
                <span className="text-xs text-muted-foreground">All buildings, assignments, and piece pools will be lost.</span>
              </div>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 shrink-0 w-36 justify-center" disabled={isDeleting}>
                    <HugeiconsIcon icon={Delete02Icon} size={14} />
                    Delete Project
                  </Button>
                }
                title="Delete this project?"
                description="All buildings, assignments, and piece pools will be permanently lost. This action cannot be undone."
                confirmLabel="Delete"
                isPending={isDeleting}
                onConfirm={onDelete}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Building Detail View ─────────────────────────────────────────────────────

export function BuildingDetail({
  building, projectId, aptTemplates, projectProfileSystems, existingAssignments, existingSizes, aptTemplateNames, onNext, onPrev, hasNext, hasPrev, onUpdateBuilding, onDeleteBuilding, canDelete, isDeletingBuilding,
}: {
  building: BuildingLike;
  projectId: string;
  aptTemplates: { id: string; name: string; profileSystemKeys?: string | null }[];
  projectProfileSystems: string[];
  existingAssignments: { floor: number; apartmentIndex: number; apartmentTemplateId: string | null }[];
  existingSizes: { apartmentTemplateOpeningId: string; floor: number; apartmentIndex: number; width: number; height: number }[];
  aptTemplateNames: Record<string, string>;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  onUpdateBuilding: (args: { projectId: string; buildingId: string; data: { name?: string; floors?: number; apartmentsPerFloor?: number; floorLabels?: string[]; status?: BuildingLike["status"] } }) => Promise<any>;
  onDeleteBuilding: (args: { projectId: string; buildingId: string }) => Promise<any>;
  canDelete: boolean;
  isDeletingBuilding: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const subTab = searchParams.get("tab") ?? "assignments";
  const setSubTab = (v: string) => {
    setSearchParams(v === "assignments" ? {} : { tab: v }, { replace: true });
  };

  return (
    <div className="flex flex-col gap-3">
      <Tabs key={subTab} value={subTab} onValueChange={setSubTab}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="assignments">
                <HugeiconsIcon icon={AssignmentsIcon} size={14} />
                Floor Assignments
              </TabsTrigger>
              <TabsTrigger value="sizes">
                <HugeiconsIcon icon={RulerIcon} size={14} />
                Opening Sizes
              </TabsTrigger>
              <TabsTrigger value="pieces">
                <HugeiconsIcon icon={PuzzleIcon} size={14} />
                Piece Pools
              </TabsTrigger>
              <TabsTrigger value="optimization">
                <HugeiconsIcon icon={ScissorIcon} size={14} />
                Optimization
              </TabsTrigger>
            </TabsList>
            <TabsList>
              <TabsTrigger value="settings">
                <HugeiconsIcon icon={Settings01Icon} size={14} />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        <TabsContent value="assignments" className="mt-3">
          <FloorAssignments
            projectId={projectId}
            building={building}
            aptTemplates={aptTemplates}
            projectProfileSystems={projectProfileSystems}
            existingAssignments={existingAssignments}
            onPrev={onPrev}
            onNext={onNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
          />
        </TabsContent>
        <TabsContent value="sizes" className="mt-3">
          <OpeningSizes
            projectId={projectId}
            building={building}
            existingAssignments={existingAssignments}
            existingSizes={existingSizes}
            aptTemplateNames={aptTemplateNames}
            onPrev={onPrev}
            onNext={onNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
          />
        </TabsContent>
        <TabsContent value="pieces" className="mt-3">
          <PiecePools
            projectId={projectId}
            building={building}
            existingAssignments={existingAssignments}
            existingSizes={existingSizes}
            aptTemplateNames={aptTemplateNames}
            onPrev={onPrev}
            onNext={onNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
          />
        </TabsContent>
        <TabsContent value="optimization" className="mt-3">
          <OptimizationTab
            projectId={projectId}
            building={building}
            existingAssignments={existingAssignments}
            existingSizes={existingSizes}
            aptTemplateNames={aptTemplateNames}
            onPrev={onPrev}
            onNext={onNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
          />
        </TabsContent>
        <TabsContent value="settings" className="mt-3">
          <BuildingSettings
            building={building}
            projectId={projectId}
            onUpdateBuilding={onUpdateBuilding}
            onDeleteBuilding={onDeleteBuilding}
            canDelete={canDelete}
            isDeletingBuilding={isDeletingBuilding}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Building Settings Tab ────────────────────────────────────────────────────

const buildingStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

function BuildingSettings({
  building, projectId, onUpdateBuilding, onDeleteBuilding, canDelete, isDeletingBuilding,
}: {
  building: BuildingLike;
  projectId: string;
  onUpdateBuilding: (args: { projectId: string; buildingId: string; data: { name?: string; floors?: number; apartmentsPerFloor?: number; floorLabels?: string[]; status?: BuildingLike["status"] } }) => Promise<any>;
  onDeleteBuilding: (args: { projectId: string; buildingId: string }) => Promise<any>;
  canDelete: boolean;
  isDeletingBuilding: boolean;
}) {
  const [name, setName] = useState(building.name);
  const [floors, setFloors] = useState(building.floors);
  const [apts, setApts] = useState(building.apartmentsPerFloor);
  const [status, setStatus] = useState<BuildingLike["status"]>(building.status);
  let initFloorLabels: string[] = [];
  try { initFloorLabels = JSON.parse(building.floorLabels); } catch { initFloorLabels = []; }
  const [floorLabels, setFloorLabels] = useState<string[]>(initFloorLabels);
  const [saving, setSaving] = useState(false);

  const updateFloorLabel = (i: number, v: string) => {
    const arr = [...floorLabels];
    arr[i] = v;
    setFloorLabels(arr);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateBuilding({ projectId, buildingId: building.id, data: { name, floors, apartmentsPerFloor: apts, floorLabels, status } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">General</CardTitle>
          <CardDescription className="text-xs">Building configuration and apartment layout.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <Label htmlFor="b-name" className="text-xs text-muted-foreground">Name</Label>
            <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
          </div>
          <Separator />
          <div className="grid grid-cols-[120px_1fr_1fr] items-center gap-3">
            <Label className="text-xs text-muted-foreground">Layout</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} value={floors} onChange={(e) => setFloors(parseInt(e.target.value) || 1)} className="h-8 text-xs w-24" />
              <span className="text-xs text-muted-foreground">floors</span>
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} value={apts} onChange={(e) => setApts(parseInt(e.target.value) || 1)} className="h-8 text-xs w-24" />
              <span className="text-xs text-muted-foreground">apts/floor</span>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-[120px_1fr] items-start gap-3">
            <Label className="text-xs text-muted-foreground pt-1.5">Floor Labels</Label>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: floors }, (_, i) => (
                <Input key={i} value={floorLabels[i] ?? String.fromCharCode(65 + i)} onChange={(e) => updateFloorLabel(i, e.target.value)} className="w-14 h-8 text-center text-xs" />
              ))}
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <Label htmlFor="b-status" className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as BuildingLike["status"])}>
              <SelectTrigger id="b-status" className="h-8 text-xs w-40">
                <SelectValue placeholder="Status">
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {buildingStatusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <SaveButton
              onClick={handleSave}
              isPending={saving}
              disabled={!name.trim()}
            />
          </div>
        </CardContent>
      </Card>
      {canDelete && (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
            <CardDescription className="text-xs">Irreversible and destructive actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium">Delete this building</span>
                <span className="text-xs text-muted-foreground">All floor assignments, opening sizes, and piece pools for this building will be lost.</span>
              </div>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 shrink-0 w-36 justify-center" disabled={isDeletingBuilding}>
                    <HugeiconsIcon icon={Delete02Icon} size={14} />
                    Delete Building
                  </Button>
                }
                title="Delete this building?"
                description="All floor assignments, opening sizes, and piece pools for this building will be permanently lost. This action cannot be undone."
                confirmLabel="Delete"
                isPending={isDeletingBuilding}
                onConfirm={() => onDeleteBuilding({ projectId, buildingId: building.id })}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Buildings Manager Tab ────────────────────────────────────────────────────

export interface BuildingLike {
  id: string;
  slug: string;
  name: string;
  floors: number;
  apartmentsPerFloor: number;
  floorLabels: string; // JSON array of floor labels (e.g. ["A","B","C"])
  sortOrder: number;
  status: "draft" | "active" | "completed" | "archived";
  createdAt: number;
}

function BuildingsManager({
  projectId, projectSlug, buildings, onCreateBuilding, search, setSearch, filterStatus, setFilterStatus,
}: {
  projectId: string;
  projectSlug: string;
  buildings: BuildingLike[];
  onCreateBuilding: (args: { projectId: string; data: { name: string; floors?: number; apartmentsPerFloor?: number; floorLabels?: string[] } }) => Promise<any>;
  search: string;
  setSearch: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
}) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFloors, setNewFloors] = useState(6);
  const [newApts, setNewApts] = useState(4);
  const [newFloorLabels, setNewFloorLabels] = useState<string[]>(["A", "B", "C", "D", "E", "F"]);
  const [isCreating, setIsCreating] = useState(false);

  const updateNewFloorLabel = (i: number, v: string) => {
    const arr = [...newFloorLabels];
    arr[i] = v;
    setNewFloorLabels(arr);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const labels = Array.from({ length: newFloors }, (_, i) => newFloorLabels[i] ?? String.fromCharCode(65 + i));
    setIsCreating(true);
    try {
      await onCreateBuilding({ projectId, data: { name: newName, floors: newFloors, apartmentsPerFloor: newApts, floorLabels: labels } });
      setShowCreate(false);
      setNewName("");
    } finally {
      setIsCreating(false);
    }
  };

  const filtered = useMemo(() => {
    let result = buildings;
    if (filterStatus !== "all") {
      result = result.filter((b) => b.status === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((b) => b.name.toLowerCase().includes(q));
    }
    return result;
  }, [buildings, search, filterStatus]);

  return (
    <div className="flex flex-col gap-3">
      {buildings.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={BuildingIcon} />
            </EmptyMedia>
            <EmptyTitle>No buildings yet</EmptyTitle>
            <EmptyDescription>Add a building to start defining floors and apartment layouts.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button className="gap-1.5" onClick={() => setShowCreate(true)}>
              <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
              Add Building
            </Button>
          </EmptyContent>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={FilterIcon} />
            </EmptyMedia>
            <EmptyTitle>No buildings match your filters</EmptyTitle>
            <EmptyDescription>
              {search.trim()
                ? `No results for "${search.trim()}".`
                : `No buildings with status "${filterStatus}".`}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilterStatus("all"); }}>
              Clear filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <Card
            size="sm"
            className="cursor-pointer border border-dashed border-muted-foreground/30 ring-0 bg-muted/10 hover:border-primary/40 hover:bg-muted/20 transition-colors"
            onClick={() => setShowCreate(true)}
          >
            <div className="flex flex-col items-center justify-center gap-1.5 py-3">
              <HugeiconsIcon icon={AddSquareIcon} size={20} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Add Building</span>
            </div>
          </Card>
          {filtered.map((b) => {
            return (
              <Card key={b.id} size="sm" className={`pb-0 cursor-pointer hover:border-primary/40 transition-colors${b.status === "archived" ? " opacity-50" : ""}`} onClick={() => navigate(`/projects/${projectSlug}/buildings/${b.slug}`)}>
                <CardHeader className="pb-1">
                  <CardAction>
                    <Badge variant="secondary" className={
                      "text-[10px] " +
                      (b.status === "active"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : b.status === "completed"
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                          : b.status === "archived"
                            ? "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-400")
                    }>
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </Badge>
                  </CardAction>
                  <CardTitle className="text-sm truncate">{b.name}</CardTitle>
                  <CardDescription className="text-xs truncate">
                    {b.floors} floors × {b.apartmentsPerFloor} apts/floor
                  </CardDescription>
                </CardHeader>
                <CardFooter className="bg-muted/50 py-2.5">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{b.floors * b.apartmentsPerFloor} apartments</span>
                    <Separator orientation="vertical" className="my-0.5" />
                    <span>Created {new Date(b.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Dialog open={true} onOpenChange={setShowCreate}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New Building</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nb-name">Name</Label>
                <Input id="nb-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Tower B" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nb-floors">Floors</Label>
                  <Input id="nb-floors" type="number" min={1} value={newFloors}
                    onChange={(e) => setNewFloors(parseInt(e.target.value) || 1)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nb-apts">Apartments per Floor</Label>
                  <Input id="nb-apts" type="number" min={1} value={newApts}
                    onChange={(e) => setNewApts(parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Label>Floor Labels</Label>
                  <Tooltip>
                    <TooltipTrigger render={<span className="inline-flex items-center text-muted-foreground cursor-help" />}>
                      <HugeiconsIcon icon={InformationSquareIcon} size={14} />
                    </TooltipTrigger>
                    <TooltipContent>You can edit them after creating.</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: newFloors }, (_, i) => (
                    <Input key={i} value={newFloorLabels[i] ?? String.fromCharCode(65 + i)} onChange={(e) => updateNewFloorLabel(i, e.target.value)} className="w-14 h-8 text-center text-xs" />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <SaveButton
                onClick={handleCreate}
                isPending={isCreating}
                isCreate
                disabled={!newName.trim()}
                onCancel={() => setShowCreate(false)}
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Floor Assignments Tab ─────────────────────────────────────────────────────────

function FloorAssignments({
  projectId, building, aptTemplates, projectProfileSystems, existingAssignments, onPrev, onNext, hasPrev, hasNext,
}: {
  projectId: string;
  building: BuildingLike;
  aptTemplates: { id: string; name: string; profileSystemKeys?: string | null }[];
  projectProfileSystems: string[];
  existingAssignments: { floor: number; apartmentIndex: number; apartmentTemplateId: string | null }[];
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const saveMutation = useSaveAssignments();
  const floors = building.floors;
  const apartmentsPerFloor = building.apartmentsPerFloor;
  let floorLabels: string[] = [];
  try { floorLabels = JSON.parse(building.floorLabels); } catch { floorLabels = []; }

  const templateNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of aptTemplates) m[t.id] = t.name;
    return m;
  }, [aptTemplates]);

  // Check if an apartment template uses profile systems not in the project's list
  const getMismatchedSystems = (templateId: string | null): string[] => {
    if (!templateId) return [];
    const tpl = aptTemplates.find((t) => t.id === templateId);
    if (!tpl?.profileSystemKeys) return [];
    const keys = tpl.profileSystemKeys.split(",").map((k) => k.trim()).filter(Boolean);
    return keys.filter((k) => !projectProfileSystems.includes(k));
  };

  const [grid, setGrid] = useState<AssignmentGrid>({});

  useEffect(() => {
    const g: AssignmentGrid = {};
    for (const a of existingAssignments) {
      g[`${a.floor}_${a.apartmentIndex}`] = a.apartmentTemplateId;
    }
    setGrid(g);
  }, [existingAssignments]);

  const handleCellChange = (floor: number, aptIndex: number, value: string | null) => {
    setGrid((g) => ({ ...g, [`${floor}_${aptIndex}`]: value }));
  };

  const handleFillAll = (templateId: string | null) => {
    setGrid((g) => {
      const newG = { ...g };
      for (let f = 0; f < floors; f++) {
        for (let i = 0; i < apartmentsPerFloor; i++) {
          newG[`${f}_${i}`] = templateId;
        }
      }
      return newG;
    });
  };

  const handleReset = () => {
    const g: AssignmentGrid = {};
    for (const a of existingAssignments) {
      g[`${a.floor}_${a.apartmentIndex}`] = a.apartmentTemplateId;
    }
    setGrid(g);
  };

  const fillAllValue = useMemo(() => {
    const values = new Set<string>();
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < apartmentsPerFloor; i++) {
        values.add(grid[`${f}_${i}`] ?? "");
      }
    }
    return values.size === 1 ? [...values][0] : "";
  }, [grid, floors, apartmentsPerFloor]);

  const handleSave = async () => {
    const assignments: { floor: number; apartmentIndex: number; apartmentTemplateId: string | null }[] = [];
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < apartmentsPerFloor; i++) {
        const tid = grid[`${f}_${i}`];
        assignments.push({ floor: f, apartmentIndex: i, apartmentTemplateId: tid ?? null });
      }
    }
    await saveMutation.mutateAsync({ projectId, buildingId: building.id, assignments });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={onPrev} disabled={!hasPrev}>
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            <Button variant="outline" size="icon" onClick={onNext} disabled={!hasNext}>
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
          </div>
          <span className="text-sm font-medium">{building.name}</span>
          <span className="text-xs text-muted-foreground">
            {building.floors} floors × {building.apartmentsPerFloor} apts · {building.floors * building.apartmentsPerFloor} total
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={fillAllValue} onValueChange={(v: string | null) => v && handleFillAll(v)}>
            <SelectTrigger className="w-40 h-7 text-xs">
              <span className="text-muted-foreground">Fill all...</span>
            </SelectTrigger>
            <SelectContent>
              {aptTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleFillAll(null)}>
            Clear
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
            <TableRow className="border-b hover:bg-transparent">
              <TableHead className="h-9 text-xs w-24 font-semibold">{building.name}</TableHead>
              {Array.from({ length: apartmentsPerFloor }, (_, i) => (
                <TableHead key={i} className="h-9 text-xs text-center font-semibold">
                  Apartment {i + 1}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: floors }, (_, f) => (
              <TableRow key={f} className="group">
                <TableCell className="text-xs font-medium py-1.5 text-muted-foreground group-hover:text-foreground">Floor {floorLabels[f] ?? String.fromCharCode(65 + f)}</TableCell>
                {Array.from({ length: apartmentsPerFloor }, (_, i) => (
                  <TableCell key={i} className="py-3 px-4 text-center">
                    <Select
                      value={grid[`${f}_${i}`] ?? ""}
                      onValueChange={(v: string | null) => handleCellChange(f, i, v || null)}
                    >
                      <SelectTrigger className="h-7 text-xs justify-center w-full">
                        <SelectValue placeholder="—">
                          {grid[`${f}_${i}`] ? templateNameMap[grid[`${f}_${i}`]!] ?? grid[`${f}_${i}`] : "—"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {aptTemplates.map((t) => {
                          const mismatches = getMismatchedSystems(t.id);
                          return (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="flex items-center gap-2">
                                {t.name}
                                {mismatches.length > 0 && (
                                  <HugeiconsIcon icon={AlertCircleIcon} size={11} className="text-amber-500 shrink-0" />
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {(() => {
                      const mismatches = getMismatchedSystems(grid[`${f}_${i}`] ?? null);
                      if (mismatches.length === 0) return null;
                      return (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 dark:text-amber-500">
                          <HugeiconsIcon icon={AlertCircleIcon} size={10} className="shrink-0" />
                          <span>Uses {mismatches.join(", ")} (not in project)</span>
                        </div>
                      );
                    })()}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="sticky bottom-0 flex flex-col gap-2 py-2 bg-background/80 backdrop-blur-sm">
        <Separator />
        <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={handleReset} className="h-7">
              Reset
            </Button>
            <Button className="gap-1.5 h-7" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Spinner className="size-3.5" /> : <HugeiconsIcon icon={SaveIcon} size={14} />}
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
      </div>
    </div>
  );
}

// ─── Opening Sizes Tab ────────────────────────────────────────────────────────

function OpeningSizes({
  projectId, building, existingAssignments, existingSizes, aptTemplateNames, onPrev, onNext, hasPrev, hasNext,
}: {
  projectId: string;
  building: BuildingLike;
  existingAssignments: { floor: number; apartmentIndex: number; apartmentTemplateId: string | null }[];
  existingSizes: { apartmentTemplateOpeningId: string; floor: number; apartmentIndex: number; width: number; height: number }[];
  aptTemplateNames: Record<string, string>;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const saveMutation = useSaveOpeningSizes();
  const { fromMM: convertFromMM, toMM: convertToMM, unitLabel } = useSettings();
  const floors = building.floors;
  const apartmentsPerFloor = building.apartmentsPerFloor;
  let floorLabels: string[] = [];
  try { floorLabels = JSON.parse(building.floorLabels); } catch { floorLabels = []; }

  const [sizes, setSizes] = useState<SizeGrid>({});
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Build a map of apartment template → openings
  const assignmentMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const a of existingAssignments) {
      m[`${a.floor}_${a.apartmentIndex}`] = a.apartmentTemplateId;
    }
    return m;
  }, [existingAssignments]);

  // Collect all unique apartment template IDs used in assignments
  const usedTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of existingAssignments) {
      if (a.apartmentTemplateId) ids.add(a.apartmentTemplateId);
    }
    return Array.from(ids);
  }, [existingAssignments]);

  // Fetch openings for each used template via React Query
  const templateQueries = useQueries({
    queries: usedTemplateIds.map((tplId) => ({
      queryKey: ["apartment-template", tplId],
      queryFn: () => apiFetch<{ openings: { id: string; label: string; pieceTemplateId: string; templateName: string }[] }>(`/api/apartment-templates/${tplId}`),
      enabled: !!tplId,
    })),
  });

  const templateOpeningsMap = useMemo(() => {
    const m: Record<string, { id: string; label: string; pieceTemplateId: string; templateName: string }[]> = {};
    usedTemplateIds.forEach((tplId, i) => {
      const q = templateQueries[i];
      if (q?.data?.openings) {
        m[tplId] = q.data.openings.map((o) => ({ id: o.id, label: o.label, pieceTemplateId: o.pieceTemplateId, templateName: o.templateName }));
      }
    });
    return m;
  }, [templateQueries, usedTemplateIds]);

  // All opening instances across all used templates, grouped by pieceTemplateId
  const allGroups = useMemo(() => {
    const groupMap = new Map<string, { pieceTemplateId: string; pieceTemplateName: string; openings: { id: string; label: string; aptTemplateName: string }[] }>();
    for (const [tplId, openings] of Object.entries(templateOpeningsMap)) {
      const aptTplName = aptTemplateNames[tplId] ?? "Unknown";
      for (const o of openings) {
        if (!groupMap.has(o.pieceTemplateId)) {
          groupMap.set(o.pieceTemplateId, { pieceTemplateId: o.pieceTemplateId, pieceTemplateName: o.templateName, openings: [] });
        }
        groupMap.get(o.pieceTemplateId)!.openings.push({ id: o.id, label: o.label, aptTemplateName: aptTplName });
      }
    }
    return Array.from(groupMap.values());
  }, [templateOpeningsMap, aptTemplateNames]);

  // Load existing sizes into state
  useEffect(() => {
    const g: SizeGrid = {};
    for (const s of existingSizes) {
      g[`${s.apartmentTemplateOpeningId}_${s.floor}_${s.apartmentIndex}`] = {
        width: String(convertFromMM(s.width)),
        height: String(convertFromMM(s.height)),
      };
    }
    setSizes(g);
  }, [existingSizes, convertFromMM]);

  // Auto-select first group
  useEffect(() => {
    if (!activeGroupId && allGroups.length > 0) {
      setActiveGroupId(allGroups[0].pieceTemplateId);
    }
  }, [allGroups, activeGroupId]);

  const handleCellChange = (openingId: string, floor: number, aptIndex: number, field: "width" | "height", value: string) => {
    const key = `${openingId}_${floor}_${aptIndex}`;
    setSizes((s) => ({
      ...s,
      [key]: { ...s[key], [field]: value },
    }));
  };

  const handleFillAll = (groupPieceTemplateId: string, width: string, height: string) => {
    const group = allGroups.find((g) => g.pieceTemplateId === groupPieceTemplateId);
    if (!group) return;
    const openingIds = new Set(group.openings.map((o) => o.id));
    setSizes((s) => {
      const newS = { ...s };
      for (let f = 0; f < floors; f++) {
        for (let i = 0; i < apartmentsPerFloor; i++) {
          const aptTplId = assignmentMap[`${f}_${i}`];
          if (!aptTplId) continue;
          const openings = templateOpeningsMap[aptTplId] ?? [];
          for (const o of openings) {
            if (openingIds.has(o.id)) {
              newS[`${o.id}_${f}_${i}`] = { width, height };
            }
          }
        }
      }
      return newS;
    });
  };

  const handleFillBucket = (groupPieceTemplateId: string, width: string, height: string, cells: { floor: number; aptIndex: number }[]) => {
    const group = allGroups.find((g) => g.pieceTemplateId === groupPieceTemplateId);
    if (!group) return;
    const openingIds = new Set(group.openings.map((o) => o.id));
    setSizes((s) => {
      const newS = { ...s };
      for (const { floor, aptIndex } of cells) {
        const aptTplId = assignmentMap[`${floor}_${aptIndex}`];
        if (!aptTplId) continue;
        const openings = templateOpeningsMap[aptTplId] ?? [];
        for (const o of openings) {
          if (openingIds.has(o.id)) {
            newS[`${o.id}_${floor}_${aptIndex}`] = { width, height };
          }
        }
      }
      return newS;
    });
  };

  const handleClearAll = (groupPieceTemplateId: string) => {
    const group = allGroups.find((g) => g.pieceTemplateId === groupPieceTemplateId);
    if (!group) return;
    const openingIds = new Set(group.openings.map((o) => o.id));
    setSizes((s) => {
      const newS = { ...s };
      for (const key of Object.keys(newS)) {
        const openingId = key.split("_")[0];
        if (openingIds.has(openingId)) {
          delete newS[key];
        }
      }
      return newS;
    });
  };

  const handleReset = () => {
    const g: SizeGrid = {};
    for (const s of existingSizes) {
      g[`${s.apartmentTemplateOpeningId}_${s.floor}_${s.apartmentIndex}`] = {
        width: String(convertFromMM(s.width)),
        height: String(convertFromMM(s.height)),
      };
    }
    setSizes(g);
  };

  const handleSave = async () => {
    const sizesArr: { apartmentTemplateOpeningId: string; floor: number; apartmentIndex: number; width: number; height: number }[] = [];
    for (const [key, val] of Object.entries(sizes)) {
      const [openingId, floor, aptIndex] = key.split("_");
      const w = parseFloat(val.width);
      const h = parseFloat(val.height);
      if (isNaN(w) || isNaN(h)) continue;
      sizesArr.push({
        apartmentTemplateOpeningId: openingId,
        floor: parseInt(floor),
        apartmentIndex: parseInt(aptIndex),
        width: convertToMM(w),
        height: convertToMM(h),
      });
    }
    await saveMutation.mutateAsync({ projectId, buildingId: building.id, sizes: sizesArr });
  };

  const isLoadingOpenings = templateQueries.some((q) => q.isLoading);

  if (usedTemplateIds.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        No apartment types assigned yet. Go to Floor Assignments first.
      </div>
    );
  }

  if (isLoadingOpenings || allGroups.length === 0) {
    return (
      <LoadingState label={isLoadingOpenings ? "Loading openings..." : "No openings found on assigned templates. Add openings to your apartment types first."} />
    );
  }

  const activeGroup = allGroups.find((g) => g.pieceTemplateId === activeGroupId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={onPrev} disabled={!hasPrev}>
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Button>
          <Button variant="outline" size="icon" onClick={onNext} disabled={!hasNext}>
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        </div>
        <span className="text-sm font-medium">{building.name}</span>
        <span className="text-xs text-muted-foreground">
          {building.floors} floors × {building.apartmentsPerFloor} apts · {building.floors * building.apartmentsPerFloor} total
        </span>
      </div>

      {activeGroup && (
        <OpeningSizeGrid
          groupPieceTemplateId={activeGroup.pieceTemplateId}
          groupLabel={activeGroup.pieceTemplateName}
          groupOpenings={activeGroup.openings}
          floors={floors}
          apartmentsPerFloor={apartmentsPerFloor}
          floorLabels={floorLabels}
          assignmentMap={assignmentMap}
          templateOpeningsMap={templateOpeningsMap}
          sizes={sizes}
          onCellChange={handleCellChange}
          onFillAll={handleFillAll}
          onFillBucket={handleFillBucket}
          onClearAll={handleClearAll}
          groupChips={
            <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5">
              {allGroups.map((g) => (
                <button
                  key={g.pieceTemplateId}
                  type="button"
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    activeGroupId === g.pieceTemplateId
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveGroupId(g.pieceTemplateId)}
                >
                  {g.pieceTemplateName}
                </button>
              ))}
            </div>
          }
        />
      )}
      <div className="sticky bottom-0 flex flex-col gap-2 py-2 bg-background/80 backdrop-blur-sm">
        <Separator />
        <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button className="gap-1.5" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Spinner className="size-4" /> : <HugeiconsIcon icon={SaveIcon} size={14} />}
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
      </div>
    </div>
  );
}

function OpeningSizeGrid({
  groupPieceTemplateId, groupLabel, groupOpenings, floors, apartmentsPerFloor, floorLabels,
  assignmentMap, templateOpeningsMap, sizes, onCellChange, onFillAll, onFillBucket, onClearAll, groupChips,
}: {
  groupPieceTemplateId: string;
  groupLabel: string;
  groupOpenings: { id: string; label: string; aptTemplateName: string }[];
  floors: number;
  apartmentsPerFloor: number;
  floorLabels: string[];
  assignmentMap: Record<string, string | null>;
  templateOpeningsMap: Record<string, { id: string; label: string; pieceTemplateId: string; templateName: string }[]>;
  sizes: SizeGrid;
  onCellChange: (openingId: string, floor: number, aptIndex: number, field: "width" | "height", value: string) => void;
  onFillAll: (groupPieceTemplateId: string, width: string, height: string) => void;
  onFillBucket: (groupPieceTemplateId: string, width: string, height: string, cells: { floor: number; aptIndex: number }[]) => void;
  onClearAll: (groupPieceTemplateId: string) => void;
  groupChips: ReactNode;
}) {
  const [bulkW, setBulkW] = useState("");
  const [bulkH, setBulkH] = useState("");
  const [thresholdInput, setThresholdInput] = useState("1.5");
  const { unitLabel, fromMM, toMM } = useSettings();

  // BUCKET_SIZE: convert threshold from display unit to mm
  const BUCKET_SIZE = toMM(parseFloat(thresholdInput) || 1.5);

  // Set of opening IDs in this group
  const groupOpeningIds = useMemo(() => new Set(groupOpenings.map((o) => o.id)), [groupOpenings]);

  // For a given cell, return the openings from this group that exist in that apartment template
  const cellOpenings = (floor: number, aptIndex: number) => {
    const aptTplId = assignmentMap[`${floor}_${aptIndex}`];
    if (!aptTplId) return [];
    const openings = templateOpeningsMap[aptTplId] ?? [];
    return openings.filter((o) => groupOpeningIds.has(o.id));
  };

  // Half-bucket overlap: assign each cell to two offset buckets per dimension,
  // then union all buckets a cell belongs to. Guarantees values within the threshold share a color.
  const CELL_TINTS = [
    "ring-blue-400/50",
    "ring-green-400/50",
    "ring-amber-400/50",
    "ring-purple-400/50",
    "ring-pink-400/50",
    "ring-cyan-400/50",
    "ring-orange-400/50",
    "ring-indigo-400/50",
  ];
  const CELL_DOT_COLORS = [
    "bg-blue-400",
    "bg-green-400",
    "bg-amber-400",
    "bg-purple-400",
    "bg-pink-400",
    "bg-cyan-400",
    "bg-orange-400",
    "bg-indigo-400",
  ];

  const { tintMap: cellTintMap, bucketGroups } = useMemo(() => {
    // Complete-linkage clustering: merge groups only if max distance between any pair ≤ BUCKET_SIZE.
    // This guarantees no transitive chaining — each group's diameter is always ≤ BUCKET_SIZE.

    // Collect all cells with their values (convert to mm for distance calculation)
    const cells: { key: string; floor: number; aptIndex: number; w: number; h: number }[] = [];
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < apartmentsPerFloor; i++) {
        for (const openingId of groupOpeningIds) {
          const key = `${openingId}_${f}_${i}`;
          const cell = sizes[key];
          if (!cell || !cell.width || !cell.height) continue;
          const w = toMM(parseFloat(cell.width));
          const h = toMM(parseFloat(cell.height));
          if (isNaN(w) || isNaN(h)) continue;
          cells.push({ key, floor: f, aptIndex: i, w, h });
        }
      }
    }

    if (cells.length === 0) {
      return { tintMap: {}, bucketGroups: [] };
    }

    // Initialize each cell as its own cluster
    const clusters: { key: string; floor: number; aptIndex: number; w: number; h: number }[][] = cells.map(c => [c]);

    // Max-norm distance: group if both width and height differences are within threshold
    const maxNormDist = (a: { w: number; h: number }, b: { w: number; h: number }) =>
      Math.max(Math.abs(a.w - b.w), Math.abs(a.h - b.h));

    // Euclidean distance for tie-breaking when max-norm distances are equal
    const euclideanDist = (a: { w: number; h: number }, b: { w: number; h: number }) =>
      Math.sqrt((a.w - b.w) ** 2 + (a.h - b.h) ** 2);

    // Complete-linkage distance between two clusters (max distance between any pair)
    const clusterDist = (c1: typeof cells, c2: typeof cells) => {
      let maxD = 0;
      for (const a of c1) {
        for (const b of c2) {
          const d = maxNormDist(a, b);
          if (d > maxD) maxD = d;
        }
      }
      return maxD;
    };

    // Greedy complete-linkage: repeatedly merge the closest pair
    let merged = true;
    while (merged && clusters.length > 1) {
      merged = false;
      let bestI = -1, bestJ = -1, bestDist = Infinity, bestEuclidean = Infinity;

      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const d = clusterDist(clusters[i], clusters[j]);
          // Tie-break with Euclidean distance between cluster centers
          const centerA = {
            w: clusters[i].reduce((s, c) => s + c.w, 0) / clusters[i].length,
            h: clusters[i].reduce((s, c) => s + c.h, 0) / clusters[i].length,
          };
          const centerB = {
            w: clusters[j].reduce((s, c) => s + c.w, 0) / clusters[j].length,
            h: clusters[j].reduce((s, c) => s + c.h, 0) / clusters[j].length,
          };
          const euc = euclideanDist(centerA, centerB);
          if (d < bestDist || (d === bestDist && euc < bestEuclidean)) {
            bestDist = d;
            bestEuclidean = euc;
            bestI = i;
            bestJ = j;
          }
        }
      }

      if (bestI >= 0 && bestDist <= BUCKET_SIZE) {
        // Merge clusters
        clusters[bestI] = [...clusters[bestI], ...clusters[bestJ]];
        clusters.splice(bestJ, 1);
        merged = true;
      }
    }

    // Assign colors to clusters
    const tintMap: Record<string, string> = {};
    const bucketGroups = clusters.map((cluster, idx) => {
      const colorIdx = idx % CELL_TINTS.length;
      const tint = CELL_TINTS[colorIdx];
      const avgW = (cluster.reduce((s, c) => s + c.w, 0) / cluster.length).toFixed(1);
      const avgH = (cluster.reduce((s, c) => s + c.h, 0) / cluster.length).toFixed(1);
      for (const c of cluster) {
        tintMap[c.key] = tint;
      }
      return {
        root: `cluster_${idx}`,
        color: tint,
        dotColor: CELL_DOT_COLORS[colorIdx],
        label: `${avgW} × ${avgH}`,
        cells: cluster.map((c) => ({ floor: c.floor, aptIndex: c.aptIndex })),
      };
    });

    return { tintMap, bucketGroups };
  }, [sizes, floors, apartmentsPerFloor, groupOpeningIds, BUCKET_SIZE, toMM]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {groupChips}
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder={`W (${unitLabel})`}
            value={bulkW}
            onChange={(e) => setBulkW(e.target.value)}
            className="w-20 h-7 text-xs"
          />
          <span className="text-xs text-muted-foreground">×</span>
          <Input
            type="number"
            placeholder={`H (${unitLabel})`}
            value={bulkH}
            onChange={(e) => setBulkH(e.target.value)}
            className="w-20 h-7 text-xs"
          />
          <Select onValueChange={(v: string | null) => {
            if (!v) return;
            if (v === "all") {
              if (bulkW && bulkH) onFillAll(groupPieceTemplateId, bulkW, bulkH);
            } else {
              const group = bucketGroups.find((g) => g.root === v);
              if (group && bulkW && bulkH) onFillBucket(groupPieceTemplateId, bulkW, bulkH, group.cells);
            }
          }}>
            <SelectTrigger className="w-40 h-7 text-xs">
              <span className="text-muted-foreground">Fill all...</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cells</SelectItem>
              {bucketGroups.map((g) => (
                <SelectItem key={g.root} value={g.root}>
                  <span className="flex items-center gap-1.5">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${g.dotColor}`} />
                    {g.label} ({g.cells.length})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onClearAll(groupPieceTemplateId)}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
            <TableRow className="border-b hover:bg-transparent">
              <TableHead className="h-9 text-xs w-24 font-semibold">{groupLabel}</TableHead>
              {Array.from({ length: apartmentsPerFloor }, (_, i) => (
                <TableHead key={i} className="h-9 text-xs text-center font-semibold">
                  Apartment {i + 1}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: floors }, (_, f) => (
              <TableRow key={f} className="group">
                <TableCell className="text-xs font-medium py-1.5 text-muted-foreground group-hover:text-foreground">Floor {floorLabels[f] ?? String.fromCharCode(65 + f)}</TableCell>
                {Array.from({ length: apartmentsPerFloor }, (_, i) => {
                  const openings = cellOpenings(f, i);
                  const hasOpenings = openings.length > 0;
                  return (
                    <TableCell key={i} className="py-1.5 px-4 text-center">
                      {hasOpenings ? (
                        <div className="flex flex-col items-center gap-1">
                          {openings.map((o) => {
                            const key = `${o.id}_${f}_${i}`;
                            const cellSize = sizes[key] ?? { width: "", height: "" };
                            const tint = cellTintMap[key];
                            return (
                              <div key={o.id} className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  placeholder={`W (${unitLabel})`}
                                  value={cellSize.width}
                                  onChange={(e) => onCellChange(o.id, f, i, "width", e.target.value)}
                                  className={`w-20 h-6 text-xs ${tint ? `ring-1 ${tint}` : ""}`}
                                />
                                <span className="text-xs text-muted-foreground">×</span>
                                <Input
                                  type="number"
                                  placeholder={`H (${unitLabel})`}
                                  value={cellSize.height}
                                  onChange={(e) => onCellChange(o.id, f, i, "height", e.target.value)}
                                  className={`w-20 h-6 text-xs ${tint ? `ring-1 ${tint}` : ""}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <HugeiconsIcon icon={InformationSquareIcon} size={14} />
        <span>Cells with similar W×H values (within</span>
        <Input
          type="number"
          step="0.1"
          min="0.1"
          value={thresholdInput}
          onChange={(e) => setThresholdInput(e.target.value)}
          className="w-12 h-5 text-xs rounded-sm text-center"
        />
        <span>{unitLabel}) share the same ring color.</span>
      </div>
    </div>
  );
}

// ─── Piece Pools Tab ──────────────────────────────────────────────────────────

function PiecePools({
  projectId, building, existingAssignments, existingSizes, aptTemplateNames, onPrev, onNext, hasPrev, hasNext,
}: {
  projectId: string;
  building: BuildingLike;
  existingAssignments: { floor: number; apartmentIndex: number; apartmentTemplateId: string | null }[];
  existingSizes: { apartmentTemplateOpeningId: string; floor: number; apartmentIndex: number; width: number; height: number }[];
  aptTemplateNames: Record<string, string>;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const { fromMM: convertFromMM, toMM: convertToMM, unitLabel, formatLength,
          kerfWidth: globalKerfWidth, optimizationStrategy: globalStrategy } = useSettings();
  const profileTypeLabel = useProfileTypeLabel();
  const floors = building.floors;
  const apartmentsPerFloor = building.apartmentsPerFloor;
  let floorLabels: string[] = [];
  try { floorLabels = JSON.parse(building.floorLabels); } catch { floorLabels = []; }

  // Build sizes map from existing sizes (read-only, no state needed)
  const sizes = useMemo(() => {
    const g: SizeGrid = {};
    for (const s of existingSizes) {
      g[`${s.apartmentTemplateOpeningId}_${s.floor}_${s.apartmentIndex}`] = {
        width: String(convertFromMM(s.width)),
        height: String(convertFromMM(s.height)),
      };
    }
    return g;
  }, [existingSizes, convertFromMM]);

  // Assignment map: floor_aptIndex → templateId
  const assignmentMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const a of existingAssignments) {
      m[`${a.floor}_${a.apartmentIndex}`] = a.apartmentTemplateId;
    }
    return m;
  }, [existingAssignments]);

  // Collect all unique apartment template IDs used in assignments
  const usedTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of existingAssignments) {
      if (a.apartmentTemplateId) ids.add(a.apartmentTemplateId);
    }
    return Array.from(ids);
  }, [existingAssignments]);

  // Fetch openings for each used template (with piece template info)
  const templateQueries = useQueries({
    queries: usedTemplateIds.map((tplId) => ({
      queryKey: ["apartment-template", tplId],
      queryFn: () => apiFetch<{ openings: { id: string; label: string; pieceTemplateId: string; templateName: string }[] }>(`/api/apartment-templates/${tplId}`),
      enabled: !!tplId,
    })),
  });

  const templateOpeningsMap = useMemo(() => {
    const m: Record<string, { id: string; label: string; pieceTemplateId: string; templateName: string }[]> = {};
    usedTemplateIds.forEach((tplId, i) => {
      const q = templateQueries[i];
      if (q?.data?.openings) {
        m[tplId] = q.data.openings.map((o) => ({ id: o.id, label: o.label, pieceTemplateId: o.pieceTemplateId, templateName: o.templateName }));
      }
    });
    return m;
  }, [templateQueries, usedTemplateIds]);

  // Group openings by pieceTemplateId
  const allGroups = useMemo(() => {
    const groupMap = new Map<string, { pieceTemplateId: string; pieceTemplateName: string; openings: { id: string; label: string }[] }>();
    for (const [, openings] of Object.entries(templateOpeningsMap)) {
      for (const o of openings) {
        if (!groupMap.has(o.pieceTemplateId)) {
          groupMap.set(o.pieceTemplateId, { pieceTemplateId: o.pieceTemplateId, pieceTemplateName: o.templateName, openings: [] });
        }
        groupMap.get(o.pieceTemplateId)!.openings.push({ id: o.id, label: o.label });
      }
    }
    return Array.from(groupMap.values());
  }, [templateOpeningsMap]);

  // For each piece template group, collect all size groups across all openings
  const groupSizeData = useMemo(() => {
    return allGroups.map((group) => {
      const openingIds = new Set(group.openings.map((o) => o.id));

      // Collect all cells for this group
      const cells: { floor: number; aptIndex: number; w: number; h: number; openingId: string }[] = [];
      for (let f = 0; f < floors; f++) {
        for (let i = 0; i < apartmentsPerFloor; i++) {
          const aptTplId = assignmentMap[`${f}_${i}`];
          if (!aptTplId) continue;
          const openings = templateOpeningsMap[aptTplId] ?? [];
          for (const o of openings) {
            if (!openingIds.has(o.id)) continue;
            const key = `${o.id}_${f}_${i}`;
            const cell = sizes[key];
            if (!cell || !cell.width || !cell.height) continue;
            const w = parseFloat(cell.width);
            const h = parseFloat(cell.height);
            if (isNaN(w) || isNaN(h)) continue;
            cells.push({ floor: f, aptIndex: i, w, h, openingId: o.id });
          }
        }
      }

      // Group cells by exact W×H (across all openings in this piece template)
      const sizeKeyMap = new Map<string, { w: number; h: number; locations: Map<string, number>; count: number }>();
      for (const cell of cells) {
        const sizeKey = `${cell.w}_${cell.h}`;
        if (!sizeKeyMap.has(sizeKey)) {
          sizeKeyMap.set(sizeKey, { w: cell.w, h: cell.h, locations: new Map(), count: 0 });
        }
        const entry = sizeKeyMap.get(sizeKey)!;
        const loc = `${floorLabels[cell.floor] ?? String.fromCharCode(65 + cell.floor)}${cell.aptIndex + 1}`;
        entry.locations.set(loc, (entry.locations.get(loc) ?? 0) + 1);
        entry.count++;
      }

      const sizeGroups = Array.from(sizeKeyMap.values()).map((g) => ({
        avgW: String(g.w),
        avgH: String(g.h),
        locations: Array.from(g.locations.entries()).map(([loc, n]) =>
          n > 1 ? `${loc}×${n}` : loc
        ),
        count: g.count,
      }));

      return { group, sizeGroups };
    });
  }, [allGroups, sizes, floors, apartmentsPerFloor, assignmentMap, templateOpeningsMap, floorLabels]);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Auto-select first group
  useEffect(() => {
    if (!activeGroupId && allGroups.length > 0) {
      setActiveGroupId(allGroups[0].pieceTemplateId);
    }
  }, [allGroups, activeGroupId]);

  const activeData = groupSizeData.find((d) => d.group.pieceTemplateId === activeGroupId);

  // Fetch the piece template detail (pieces + variables) for the active group
  const { data: templateDetail } = useTemplate(activeGroupId);
  const { data: profileSystemsList } = useProfileSystems();

  // Resolve profile system constants for the active template
  const systemConstants = useMemo((): SystemConstant[] => {
    if (!templateDetail?.profileSystemId || !profileSystemsList) return [];
    const sys = profileSystemsList.find((s) => s.id === templateDetail.profileSystemId);
    if (!sys?.constants) return [];
    try {
      return JSON.parse(sys.constants) as SystemConstant[];
    } catch {
      return [];
    }
  }, [templateDetail?.profileSystemId, profileSystemsList]);

  // Evaluate piece formulas for each size group
  const piecesBySize = useMemo(() => {
    if (!templateDetail?.pieces || !activeData) return null;
    const variables: TemplateVariable[] = [
      ...systemConstants.map((c) => ({ name: c.name, defaultValue: c.defaultValue })),
      ...(templateDetail.variables ?? []).map((v) => ({
        name: v.name,
        defaultValue: v.defaultValue,
      })),
    ];

    return activeData.sizeGroups.map((sg) => {
      const wMm = convertToMM(parseFloat(sg.avgW));
      const hMm = convertToMM(parseFloat(sg.avgH));
      const result = generatePieces(
        templateDetail.pieces.map((p) => ({
          id: p.id,
          label: p.label,
          profileType: p.profileType,
          lengthFormula: p.lengthFormula,
          quantity: p.quantity,
        })),
        variables,
        wMm,
        hMm,
      );
      return { pieces: result.pieces, errors: result.errors };
    });
  }, [templateDetail, activeData, convertToMM, systemConstants]);

  // Group pieces by profileType for grouped column headers
  const pieceGroups = useMemo(() => {
    const pieces = piecesBySize?.[0]?.pieces;
    if (!pieces) return [];
    const groups: { profileType: string; label: string; count: number; indices: number[] }[] = [];
    const seen = new Map<string, number>();
    for (let i = 0; i < pieces.length; i++) {
      const pt = pieces[i].profileType;
      if (seen.has(pt)) {
        const gi = seen.get(pt)!;
        groups[gi].count++;
        groups[gi].indices.push(i);
      } else {
        seen.set(pt, groups.length);
        groups.push({ profileType: pt, label: profileTypeLabel(pt), count: 1, indices: [i] });
      }
    }
    return groups;
  }, [piecesBySize, profileTypeLabel]);

  const isLoading = templateQueries.some((q) => q.isLoading);
  const isLoadingTemplate = !!activeGroupId && !templateDetail;

  if (isLoading || isLoadingTemplate) {
    return <LoadingState label="Loading openings..." />;
  }

  if (allGroups.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        No openings found. Make sure floor assignments are set.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={onPrev} disabled={!hasPrev}>
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Button>
          <Button variant="outline" size="icon" onClick={onNext} disabled={!hasNext}>
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        </div>
        <span className="text-sm font-medium">{building.name}</span>
        <span className="text-xs text-muted-foreground">
          {building.floors} floors × {building.apartmentsPerFloor} apts · {building.floors * building.apartmentsPerFloor} total
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5">
          {allGroups.map((g) => (
            <button
              key={g.pieceTemplateId}
              type="button"
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeGroupId === g.pieceTemplateId
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveGroupId(g.pieceTemplateId)}
            >
              {g.pieceTemplateName}
            </button>
          ))}
        </div>
        {activeData && (
          <Badge variant="secondary" className="text-[10px]">{activeData.sizeGroups.length} sizes</Badge>
        )}
      </div>

      {activeData && (
        <div className="flex flex-col gap-2">
          {activeData.sizeGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sizes entered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
                  <TableRow className="border-b hover:bg-transparent">
                    <TableHead rowSpan={2} className="h-9 text-xs w-24 font-semibold align-middle">{activeData.group.pieceTemplateName}</TableHead>
                    <TableHead rowSpan={2} className="h-9 text-xs text-center font-semibold align-middle">Qty</TableHead>
                    <TableHead rowSpan={2} className="h-9 text-xs text-center font-semibold align-middle">Locations</TableHead>
                    <TableHead rowSpan={2} className="h-9 text-xs text-center font-semibold align-middle">Width ({unitLabel})</TableHead>
                    <TableHead rowSpan={2} className="h-9 text-xs text-center font-semibold align-middle">Height ({unitLabel})</TableHead>
                    {pieceGroups.map((g) => (
                      <TableHead key={g.profileType} colSpan={g.count} className="h-6 text-xs text-center font-semibold border-l border-border/40">
                        {g.label}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="border-b hover:bg-transparent">
                    {piecesBySize && piecesBySize[0]?.pieces.map((p, i) => (
                      <TableHead key={i} className="h-6 text-[10px] text-center font-normal whitespace-nowrap border-l border-border/20">
                        {p.label}
                        <span className="text-muted-foreground ml-1">×{p.quantity}</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeData.sizeGroups.map((group, idx) => (
                    <Fragment key={idx}>
                      <TableRow className="group">
                        <TableCell className="text-xs font-medium py-1.5 text-muted-foreground group-hover:text-foreground">
                          Size {idx + 1}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-center">
                          <span className="text-xs">{group.count}</span>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-center">
                          <div className="grid grid-cols-3 gap-0.5 w-fit mx-auto">
                            {group.locations.map((loc, i) => {
                              const m = loc.match(/^(.+)×(\d+)$/);
                              return (
                                <span key={i} className="text-xs text-muted-foreground text-center leading-tight py-0.5 px-0.5 rounded border border-border/60 w-12">
                                  {m ? <>{m[1]}<span className="text-[10px]"> ×{m[2]}</span></> : loc}
                                </span>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-center">
                          <span className="text-xs font-mono">{group.avgW}</span>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-center">
                          <span className="text-xs font-mono">{group.avgH}</span>
                        </TableCell>
                        {piecesBySize?.[idx]?.pieces.map((p, i) => (
                          <TableCell key={i} className="py-3 px-4 text-center">
                            <span className="text-xs font-mono">{formatLength(p.length, false)}</span>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow key={`sub-${idx}`} className="border-b bg-muted/30">
                        <TableCell colSpan={3} className="py-1 px-4" />
                        <TableCell className="py-1 px-4 text-[12px] text-muted-foreground text-center">
                          —
                        </TableCell>
                        <TableCell className="py-1 px-4 text-[12px] text-muted-foreground text-center">
                          —
                        </TableCell>
                        {piecesBySize?.[idx]?.pieces.map((p, i) => (
                          <TableCell key={i} className="py-1 px-4 text-center">
                            <span className="text-[12px] font-mono text-muted-foreground">{group.count * p.quantity}</span>
                          </TableCell>
                        ))}
                      </TableRow>
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
