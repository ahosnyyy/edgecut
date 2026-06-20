import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  useProject,
  useUpdateProject,
  useCreateBuilding,
  useUpdateBuilding,
  useDeleteBuilding,
  useSaveAssignments,
  useSaveOpeningSizes,
  useDeleteProject,
  useProjectPieces,
  type Project,
} from "../hooks/useProjects";
import { useApartmentTemplates } from "../hooks/useApartmentTemplates";
import { apiFetch } from "../auth/apiClient";
import { Button } from "../components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
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
  ArrowDown01Icon,
  BuildingIcon,
  AssignmentsIcon,
  RulerIcon,
  PuzzleIcon,
  Settings01Icon,
  MoreHorizontalCircle01Icon,
  Edit02Icon,
  InformationSquareIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";

interface AssignmentGrid {
  [key: string]: string | null;
}

interface SizeGrid {
  [key: string]: { width: string; height: string };
}

export default function ProjectBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id ?? null);
  const { data: aptTemplates } = useApartmentTemplates();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const createBuildingMutation = useCreateBuilding();
  const updateBuildingMutation = useUpdateBuilding();
  const deleteBuildingMutation = useDeleteBuilding();

  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [status, setStatus] = useState<Project["status"]>("draft");
  const [activeTab, setActiveTab] = useState("buildings");
  const [activeBuildingId, setActiveBuildingId] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setClient(project.client ?? "");
      setStatus(project.status);
    }
  }, [project]);

  const handleSaveSettings = async () => {
    if (!id) return;
    await updateMutation.mutateAsync({
      id,
      data: { name, client, status },
    });
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteMutation.mutateAsync(id);
    navigate("/projects");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Loading project...</p>
      </div>
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
  const activeBuilding = buildings.find((b) => b.id === activeBuildingId) ?? buildings[0] ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="buildings">
                <HugeiconsIcon icon={BuildingIcon} size={14} />
                Buildings
              </TabsTrigger>
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
            </TabsList>
            <TabsList>
              <TabsTrigger value="settings">
                <HugeiconsIcon icon={Settings01Icon} size={14} />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            Created {new Date(project.createdAt).toLocaleDateString("en-GB")}
          </span>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 py-2">
            <TabsContent value="buildings">
              <BuildingsManager
                projectId={id!}
                buildings={buildings}
                onCreateBuilding={createBuildingMutation.mutateAsync}
                onUpdateBuilding={updateBuildingMutation.mutateAsync}
                onDeleteBuilding={deleteBuildingMutation.mutateAsync}
              />
            </TabsContent>
            {activeBuilding && (
              <>
                <TabsContent value="assignments">
                  <FloorAssignments
                    projectId={id!}
                    building={activeBuilding}
                    buildings={buildings}
                    activeBuildingId={activeBuilding?.id ?? null}
                    onBuildingChange={setActiveBuildingId}
                    aptTemplates={aptTemplates ?? []}
                    existingAssignments={project.assignments.filter((a) => a.buildingId === activeBuilding.id)}
                  />
                </TabsContent>
                <TabsContent value="sizes">
                  <OpeningSizes
                    projectId={id!}
                    building={activeBuilding}
                    buildings={buildings}
                    activeBuildingId={activeBuilding?.id ?? null}
                    onBuildingChange={setActiveBuildingId}
                    existingAssignments={project.assignments.filter((a) => a.buildingId === activeBuilding.id)}
                    existingSizes={project.openingSizes.filter((s) => s.buildingId === activeBuilding.id)}
                    aptTemplateNames={aptTemplates?.reduce((acc, t) => { acc[t.id] = t.name; return acc; }, {} as Record<string, string>) ?? {}}
                  />
                </TabsContent>
              </>
            )}
            <TabsContent value="pieces">
              <PiecePools projectId={id!} />
            </TabsContent>
            <TabsContent value="settings">
              <ProjectSettings
                name={name}
                client={client}
                status={status}
                onNameChange={setName}
                onClientChange={setClient}
                onStatusChange={setStatus}
                onSave={handleSaveSettings}
                isSaving={updateMutation.isPending}
                onDelete={handleDelete}
              />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function ProjectSettings({
  name, client, status, onNameChange, onClientChange, onStatusChange, onSave, isSaving, onDelete,
}: {
  name: string;
  client: string;
  status: Project["status"];
  onNameChange: (v: string) => void;
  onClientChange: (v: string) => void;
  onStatusChange: (v: Project["status"]) => void;
  onSave: () => void;
  isSaving: boolean;
  onDelete: () => void;
}) {
  const statusOptions: { value: Project["status"]; label: string }[] = [
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "archived", label: "Archived" },
  ];
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">General</CardTitle>
          <CardDescription className="text-xs">Basic project information and status.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <Label htmlFor="p-name" className="text-xs text-muted-foreground">Name</Label>
            <Input id="p-name" value={name} onChange={(e) => onNameChange(e.target.value)} className="h-8 text-xs" />
          </div>
          <Separator />
          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <Label htmlFor="p-client" className="text-xs text-muted-foreground">Client</Label>
            <Input id="p-client" value={client} onChange={(e) => onClientChange(e.target.value)} className="h-8 text-xs" />
          </div>
          <Separator />
          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <Label htmlFor="p-status" className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={(v) => onStatusChange(v as Project["status"])}>
              <SelectTrigger id="p-status" className="h-8 text-xs w-40">
                <SelectValue>
                  {(value: string) => statusOptions.find((o) => o.value === value)?.label ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button onClick={onSave} disabled={isSaving} className="gap-1.5">
              <HugeiconsIcon icon={SaveIcon} size={14} />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
          <CardDescription className="text-xs">Irreversible and destructive actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium">Delete this project</span>
              <span className="text-xs text-muted-foreground">All buildings, assignments, and piece pools will be lost.</span>
            </div>
            <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 shrink-0" onClick={onDelete}>
              <HugeiconsIcon icon={Delete02Icon} size={14} />
              Delete Project
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Buildings Manager Tab ────────────────────────────────────────────────────

interface BuildingLike {
  id: string;
  name: string;
  floors: number;
  apartmentsPerFloor: number;
  apartmentLabels: string;
  sortOrder: number;
  createdAt: number;
}

function BuildingsManager({
  projectId, buildings, onCreateBuilding, onUpdateBuilding, onDeleteBuilding,
}: {
  projectId: string;
  buildings: BuildingLike[];
  onCreateBuilding: (args: { projectId: string; data: { name: string; floors?: number; apartmentsPerFloor?: number; apartmentLabels?: string[] } }) => Promise<any>;
  onUpdateBuilding: (args: { projectId: string; buildingId: string; data: { name?: string; floors?: number; apartmentsPerFloor?: number; apartmentLabels?: string[] } }) => Promise<any>;
  onDeleteBuilding: (args: { projectId: string; buildingId: string }) => Promise<any>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFloors, setNewFloors] = useState(6);
  const [newApts, setNewApts] = useState(4);
  const [newLabels, setNewLabels] = useState<string[]>(["A", "B", "C", "D"]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateNewLabel = (i: number, v: string) => {
    const arr = [...newLabels];
    arr[i] = v;
    setNewLabels(arr);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const labels = Array.from({ length: newApts }, (_, i) => newLabels[i] ?? String.fromCharCode(65 + i));
    await onCreateBuilding({ projectId, data: { name: newName, floors: newFloors, apartmentsPerFloor: newApts, apartmentLabels: labels } });
    setShowCreate(false);
    setNewName("");
  };

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
          {buildings.map((b) => {
            let labels: string[] = [];
            try { labels = JSON.parse(b.apartmentLabels); } catch { labels = []; }
            return (
              <Card key={b.id} size="sm" className="pb-0">
                <CardHeader className="pb-1">
                  <CardAction>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="size-6" />
                      }>
                        <HugeiconsIcon icon={MoreHorizontalCircle01Icon} size={14} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingId(b.id)}>
                          <HugeiconsIcon icon={Edit02Icon} size={14} />
                          Edit
                        </DropdownMenuItem>
                        {buildings.length > 1 && (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={async () => { await onDeleteBuilding({ projectId, buildingId: b.id }); }}
                          >
                            <HugeiconsIcon icon={Delete02Icon} size={14} />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardAction>
                  <CardTitle className="text-sm truncate">{b.name}</CardTitle>
                  <CardDescription className="text-xs truncate">
                    {b.floors} floors × {b.apartmentsPerFloor} apts/floor
                  </CardDescription>
                </CardHeader>
                <CardFooter className="bg-muted/50 py-2.5">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Apts: {labels.join(", ")}</span>
                    <Separator orientation="vertical" className="my-0.5" />
                    <span>{new Date(b.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Dialog open={true} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-md">
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
                  <Label>Apartment Labels</Label>
                  <Tooltip>
                    <TooltipTrigger render={<span className="inline-flex items-center text-muted-foreground cursor-help" />}>
                      <HugeiconsIcon icon={InformationSquareIcon} size={14} />
                    </TooltipTrigger>
                    <TooltipContent>You can edit them after creating.</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: newApts }, (_, i) => (
                    <Input key={i} value={newLabels[i] ?? String.fromCharCode(65 + i)} onChange={(e) => updateNewLabel(i, e.target.value)} className="w-14 h-8 text-center text-xs" />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editingId && (
        <BuildingEditDialog
          building={buildings.find((b) => b.id === editingId)!}
          onSave={async (data) => { await onUpdateBuilding({ projectId, buildingId: editingId, data }); setEditingId(null); }}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function BuildingEditDialog({ building, onSave, onCancel }: {
  building: BuildingLike;
  onSave: (data: { name: string; floors: number; apartmentsPerFloor: number; apartmentLabels: string[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(building.name);
  const [floors, setFloors] = useState(building.floors);
  const [apts, setApts] = useState(building.apartmentsPerFloor);
  let initLabels: string[] = [];
  try { initLabels = JSON.parse(building.apartmentLabels); } catch { initLabels = []; }
  const [labels, setLabels] = useState<string[]>(initLabels);

  const updateLabel = (i: number, v: string) => {
    const arr = [...labels];
    arr[i] = v;
    setLabels(arr);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Building</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eb-name">Name</Label>
            <Input id="eb-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="eb-floors">Floors</Label>
              <Input id="eb-floors" type="number" min={1} value={floors}
                onChange={(e) => setFloors(parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="eb-apts">Apartments per Floor</Label>
              <Input id="eb-apts" type="number" min={1} value={apts}
                onChange={(e) => setApts(parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Apartment Labels</Label>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: apts }, (_, i) => (
                <Input key={i} value={labels[i] ?? String.fromCharCode(65 + i)} onChange={(e) => updateLabel(i, e.target.value)} className="w-14 h-8 text-center text-xs" />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSave({ name, floors, apartmentsPerFloor: apts, apartmentLabels: labels })} disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Building Selector ──────────────────────────────────────────────────────────

function BuildingSelector({ buildings, activeBuildingId, onBuildingChange }: {
  buildings: BuildingLike[];
  activeBuildingId: string | null;
  onBuildingChange: (id: string) => void;
}) {
  const activeBuilding = buildings.find((b) => b.id === activeBuildingId);
  if (buildings.length <= 1) return null;
  return (
    <Select value={activeBuildingId ?? ""} onValueChange={(v: string | null) => v && onBuildingChange(v)}>
      <SelectTrigger className="w-48 h-7 text-xs">
        <SelectValue placeholder="Select building...">
          {activeBuilding ? activeBuilding.name : "Select building..."}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {buildings.map((b) => (
          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Floor Assignments Tab ─────────────────────────────────────────────────────────

function FloorAssignments({
  projectId, building, buildings, activeBuildingId, onBuildingChange,
  aptTemplates, existingAssignments,
}: {
  projectId: string;
  building: BuildingLike;
  buildings: BuildingLike[];
  activeBuildingId: string | null;
  onBuildingChange: (id: string) => void;
  aptTemplates: { id: string; name: string }[];
  existingAssignments: { floor: number; apartmentIndex: number; apartmentTemplateId: string | null }[];
}) {
  const saveMutation = useSaveAssignments();
  const floors = building.floors;
  const apartmentsPerFloor = building.apartmentsPerFloor;
  let apartmentLabels: string[] = [];
  try { apartmentLabels = JSON.parse(building.apartmentLabels); } catch { apartmentLabels = []; }

  const templateNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of aptTemplates) m[t.id] = t.name;
    return m;
  }, [aptTemplates]);

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

  const handleFillFloor = (floor: number, templateId: string | null) => {
    setGrid((g) => {
      const newG = { ...g };
      for (let i = 0; i < apartmentsPerFloor; i++) {
        newG[`${floor}_${i}`] = templateId;
      }
      return newG;
    });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BuildingSelector buildings={buildings} activeBuildingId={activeBuildingId} onBuildingChange={onBuildingChange} />
          <span className="text-xs text-muted-foreground">
            {building.name}: {floors} floors × {apartmentsPerFloor} apts
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select onValueChange={(v: string | null) => v && handleFillAll(v)}>
            <SelectTrigger className="w-40 h-7 text-xs">
              <span className="text-muted-foreground">Fill all...</span>
            </SelectTrigger>
            <SelectContent>
              {aptTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button  className="gap-1.5" onClick={handleSave} disabled={saveMutation.isPending}>
            <HugeiconsIcon icon={SaveIcon} size={14} />
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 text-xs w-20">Floor</TableHead>
              {Array.from({ length: apartmentsPerFloor }, (_, i) => (
                <TableHead key={i} className="h-8 text-xs text-center">
                  Apt {apartmentLabels[i] ?? String.fromCharCode(65 + i)}
                </TableHead>
              ))}
              <TableHead className="h-8 text-xs w-24">Fill Floor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: floors }, (_, f) => (
              <TableRow key={f}>
                <TableCell className="text-xs font-medium py-1.5">F{f + 1}</TableCell>
                {Array.from({ length: apartmentsPerFloor }, (_, i) => (
                  <TableCell key={i} className="py-1.5">
                    <Select
                      value={grid[`${f}_${i}`] ?? ""}
                      onValueChange={(v: string | null) => handleCellChange(f, i, v || null)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="—">
                          {grid[`${f}_${i}`] ? templateNameMap[grid[`${f}_${i}`]!] ?? grid[`${f}_${i}`] : "—"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {aptTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                ))}
                <TableCell className="py-1.5">
                  <Select onValueChange={(v: string | null) => v && handleFillFloor(f, v)}>
                    <SelectTrigger className="h-7 text-xs">
                      <span className="text-muted-foreground">—</span>
                    </SelectTrigger>
                    <SelectContent>
                      {aptTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Opening Sizes Tab ────────────────────────────────────────────────────────

function OpeningSizes({
  projectId, building, buildings, activeBuildingId, onBuildingChange,
  existingAssignments, existingSizes, aptTemplateNames,
}: {
  projectId: string;
  building: BuildingLike;
  buildings: BuildingLike[];
  activeBuildingId: string | null;
  onBuildingChange: (id: string) => void;
  existingAssignments: { floor: number; apartmentIndex: number; apartmentTemplateId: string | null }[];
  existingSizes: { apartmentTemplateOpeningId: string; floor: number; apartmentIndex: number; width: number; height: number }[];
  aptTemplateNames: Record<string, string>;
}) {
  const saveMutation = useSaveOpeningSizes();
  const floors = building.floors;
  const apartmentsPerFloor = building.apartmentsPerFloor;
  let apartmentLabels: string[] = [];
  try { apartmentLabels = JSON.parse(building.apartmentLabels); } catch { apartmentLabels = []; }

  const [sizes, setSizes] = useState<SizeGrid>({});
  const [activeOpeningId, setActiveOpeningId] = useState<string | null>(null);

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
      queryFn: () => apiFetch<{ openings: { id: string; label: string }[] }>(`/api/apartment-templates/${tplId}`),
      enabled: !!tplId,
    })),
  });

  const templateOpeningsMap = useMemo(() => {
    const m: Record<string, { id: string; label: string }[]> = {};
    usedTemplateIds.forEach((tplId, i) => {
      const q = templateQueries[i];
      if (q?.data?.openings) {
        m[tplId] = q.data.openings.map((o) => ({ id: o.id, label: o.label }));
      }
    });
    return m;
  }, [templateQueries, usedTemplateIds]);

  // All opening instances across all used templates
  const allOpenings = useMemo(() => {
    const list: { id: string; label: string; templateName: string }[] = [];
    for (const [tplId, openings] of Object.entries(templateOpeningsMap)) {
      const tplName = aptTemplateNames[tplId] ?? "Unknown";
      for (const o of openings) {
        list.push({ id: o.id, label: o.label, templateName: tplName });
      }
    }
    return list;
  }, [templateOpeningsMap, aptTemplateNames]);

  // Load existing sizes into state
  useEffect(() => {
    const g: SizeGrid = {};
    for (const s of existingSizes) {
      g[`${s.apartmentTemplateOpeningId}_${s.floor}_${s.apartmentIndex}`] = {
        width: String(s.width),
        height: String(s.height),
      };
    }
    setSizes(g);
  }, [existingSizes]);

  // Auto-select first opening
  useEffect(() => {
    if (!activeOpeningId && allOpenings.length > 0) {
      setActiveOpeningId(allOpenings[0].id);
    }
  }, [allOpenings, activeOpeningId]);

  const handleCellChange = (openingId: string, floor: number, aptIndex: number, field: "width" | "height", value: string) => {
    const key = `${openingId}_${floor}_${aptIndex}`;
    setSizes((s) => ({
      ...s,
      [key]: { ...s[key], [field]: value },
    }));
  };

  const handleFillAll = (openingId: string, width: string, height: string) => {
    setSizes((s) => {
      const newS = { ...s };
      for (let f = 0; f < floors; f++) {
        for (let i = 0; i < apartmentsPerFloor; i++) {
          const aptTplId = assignmentMap[`${f}_${i}`];
          if (!aptTplId) continue;
          const openings = templateOpeningsMap[aptTplId] ?? [];
          if (openings.some((o) => o.id === openingId)) {
            newS[`${openingId}_${f}_${i}`] = { width, height };
          }
        }
      }
      return newS;
    });
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
        width: w,
        height: h,
      });
    }
    await saveMutation.mutateAsync({ projectId, buildingId: building.id, sizes: sizesArr });
  };

  const isLoadingOpenings = templateQueries.some((q) => q.isLoading);

  if (usedTemplateIds.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        No apartment types assigned yet. Go to Floor Assignments tab first.
      </div>
    );
  }

  if (isLoadingOpenings || allOpenings.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        {isLoadingOpenings ? "Loading openings..." : "No openings found on assigned templates. Add openings to your apartment types first."}
      </div>
    );
  }

  const activeOpening = allOpenings.find((o) => o.id === activeOpeningId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BuildingSelector buildings={buildings} activeBuildingId={activeBuildingId} onBuildingChange={onBuildingChange} />
          <p className="text-xs text-muted-foreground">
            {building.name}: Enter W×H per opening
          </p>
        </div>
        <Button  className="gap-1.5" onClick={handleSave} disabled={saveMutation.isPending}>
          <HugeiconsIcon icon={SaveIcon} size={14} />
          {saveMutation.isPending ? "Saving..." : "Save Sizes"}
        </Button>
      </div>

      {/* Opening selector */}
      <div className="flex flex-wrap gap-1.5">
        {allOpenings.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeOpeningId === o.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border"
            }`}
            onClick={() => setActiveOpeningId(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {activeOpening && (
        <OpeningSizeGrid
          openingId={activeOpening.id}
          openingLabel={activeOpening.label}
          floors={floors}
          apartmentsPerFloor={apartmentsPerFloor}
          apartmentLabels={apartmentLabels}
          assignmentMap={assignmentMap}
          templateOpeningsMap={templateOpeningsMap}
          sizes={sizes}
          onCellChange={handleCellChange}
          onFillAll={handleFillAll}
        />
      )}
    </div>
  );
}

function OpeningSizeGrid({
  openingId, openingLabel, floors, apartmentsPerFloor, apartmentLabels,
  assignmentMap, templateOpeningsMap, sizes, onCellChange, onFillAll,
}: {
  openingId: string;
  openingLabel: string;
  floors: number;
  apartmentsPerFloor: number;
  apartmentLabels: string[];
  assignmentMap: Record<string, string | null>;
  templateOpeningsMap: Record<string, { id: string; label: string }[]>;
  sizes: SizeGrid;
  onCellChange: (openingId: string, floor: number, aptIndex: number, field: "width" | "height", value: string) => void;
  onFillAll: (openingId: string, width: string, height: string) => void;
}) {
  const [bulkW, setBulkW] = useState("");
  const [bulkH, setBulkH] = useState("");

  // Determine which cells should show this opening
  const cellHasOpening = (floor: number, aptIndex: number) => {
    const aptTplId = assignmentMap[`${floor}_${aptIndex}`];
    if (!aptTplId) return false;
    const openings = templateOpeningsMap[aptTplId] ?? [];
    return openings.some((o) => o.id === openingId);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">{openingLabel}</span>
        <div className="flex items-center gap-1 ml-auto">
          <Input
            type="number"
            placeholder="W"
            value={bulkW}
            onChange={(e) => setBulkW(e.target.value)}
            className="w-20 h-7 text-xs"
          />
          <span className="text-xs text-muted-foreground">×</span>
          <Input
            type="number"
            placeholder="H"
            value={bulkH}
            onChange={(e) => setBulkH(e.target.value)}
            className="w-20 h-7 text-xs"
          />
          <Button
            variant="outline"
            
            className="h-7 text-xs gap-1"
            onClick={() => bulkW && bulkH && onFillAll(openingId, bulkW, bulkH)}
          >
            <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
            Fill All
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 text-xs w-16">Floor</TableHead>
              {Array.from({ length: apartmentsPerFloor }, (_, i) => (
                <TableHead key={i} className="h-8 text-xs">
                  Apt {apartmentLabels[i] ?? String.fromCharCode(65 + i)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: floors }, (_, f) => (
              <TableRow key={f}>
                <TableCell className="text-xs font-medium py-1.5">F{f + 1}</TableCell>
                {Array.from({ length: apartmentsPerFloor }, (_, i) => {
                  const hasOpening = cellHasOpening(f, i);
                  const key = `${openingId}_${f}_${i}`;
                  const cellSize = sizes[key] ?? { width: "", height: "" };
                  return (
                    <TableCell key={i} className="py-1.5">
                      {hasOpening ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            placeholder="W"
                            value={cellSize.width}
                            onChange={(e) => onCellChange(openingId, f, i, "width", e.target.value)}
                            className="w-16 h-6 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">×</span>
                          <Input
                            type="number"
                            placeholder="H"
                            value={cellSize.height}
                            onChange={(e) => onCellChange(openingId, f, i, "height", e.target.value)}
                            className="w-16 h-6 text-xs"
                          />
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
    </div>
  );
}

// ─── Piece Pools Tab ──────────────────────────────────────────────────────────

function PiecePools({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectPieces(projectId);

  if (isLoading) {
    return <div className="text-center text-sm text-muted-foreground py-8">Calculating pieces...</div>;
  }

  if (!data || data.pools.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        No pieces generated. Make sure floor assignments and opening sizes are filled.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Pieces are grouped by template + profile type for optimization. Each pool will be optimized separately.
      </p>
      {data.pools.map((pool, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">{pool.templateName}</CardTitle>
              <Badge variant="secondary" className="text-[10px]">{pool.profileType}</Badge>
              <Badge variant="outline" className="text-[10px]">{pool.pieces.length} pieces</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-7 text-xs">Label</TableHead>
                    <TableHead className="h-7 text-xs text-right">Length</TableHead>
                    <TableHead className="h-7 text-xs text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pool.pieces.map((p, j) => (
                    <TableRow key={j}>
                      <TableCell className="text-xs py-1.5">{p.label}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-mono">{p.length}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right">{p.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
