import { useState, useMemo, useEffect, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  useProject,
  useUpdateProject,
  useCreateBuilding,
  useSaveAssignments,
  useSaveOpeningSizes,
  useDeleteProject,
  useProjectPieces,
  type Project,
} from "../hooks/useProjects";
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
  PencilRulerIcon,
  BuildingIcon,
  AssignmentsIcon,
  RulerIcon,
  PuzzleIcon,
  Settings01Icon,
  InformationSquareIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArchiveArrowDownIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
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
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const createBuildingMutation = useCreateBuilding();

  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [status, setStatus] = useState<Project["status"]>("draft");
  const [activeTab, setActiveTab] = useState("buildings");

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
      data: { name, client },
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
  name, client, status, onNameChange, onClientChange, onSave, isSaving, onDelete, onArchive,
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
}) {
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
          <div className="flex justify-end">
            <Button onClick={onSave} disabled={isSaving} className="gap-1.5 w-36 justify-center">
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
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium">Archive this project</span>
                <span className="text-xs text-muted-foreground">Mark all buildings as archived and hide from active lists.</span>
              </div>
              <Button variant="outline" className="gap-1.5 shrink-0 w-36 justify-center" onClick={onArchive} disabled={status === "archived"}>
                <HugeiconsIcon icon={ArchiveArrowDownIcon} size={14} />
                Archive Project
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium">Delete this project</span>
                <span className="text-xs text-muted-foreground">All buildings, assignments, and piece pools will be lost.</span>
              </div>
              <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 shrink-0 w-36 justify-center" onClick={onDelete}>
                <HugeiconsIcon icon={Delete02Icon} size={14} />
                Delete Project
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Building Detail View ─────────────────────────────────────────────────────

export function BuildingDetail({
  building, projectId, aptTemplates, existingAssignments, existingSizes, aptTemplateNames, onNext, onPrev, hasNext, hasPrev, onUpdateBuilding, onDeleteBuilding, canDelete,
}: {
  building: BuildingLike;
  projectId: string;
  aptTemplates: { id: string; name: string }[];
  existingAssignments: { floor: number; apartmentIndex: number; apartmentTemplateId: string | null }[];
  existingSizes: { apartmentTemplateOpeningId: string; floor: number; apartmentIndex: number; width: number; height: number }[];
  aptTemplateNames: Record<string, string>;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  onUpdateBuilding: (args: { projectId: string; buildingId: string; data: { name?: string; floors?: number; apartmentsPerFloor?: number; apartmentLabels?: string[]; status?: BuildingLike["status"] } }) => Promise<any>;
  onDeleteBuilding: (args: { projectId: string; buildingId: string }) => Promise<any>;
  canDelete: boolean;
}) {
  const [subTab, setSubTab] = useState("assignments");

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={subTab} onValueChange={setSubTab}>
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
            </TabsList>
            <TabsList>
              <TabsTrigger value="settings">
                <HugeiconsIcon icon={Settings01Icon} size={14} />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>
          <span className="text-xs text-muted-foreground">
            Created {new Date(building.createdAt).toLocaleDateString("en-GB")}
          </span>
        </div>
        <TabsContent value="assignments" className="mt-3">
          <FloorAssignments
            projectId={projectId}
            building={building}
            aptTemplates={aptTemplates}
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
        <TabsContent value="settings" className="mt-3">
          <BuildingSettings
            building={building}
            projectId={projectId}
            onUpdateBuilding={onUpdateBuilding}
            onDeleteBuilding={onDeleteBuilding}
            canDelete={canDelete}
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
  building, projectId, onUpdateBuilding, onDeleteBuilding, canDelete,
}: {
  building: BuildingLike;
  projectId: string;
  onUpdateBuilding: (args: { projectId: string; buildingId: string; data: { name?: string; floors?: number; apartmentsPerFloor?: number; apartmentLabels?: string[]; status?: BuildingLike["status"] } }) => Promise<any>;
  onDeleteBuilding: (args: { projectId: string; buildingId: string }) => Promise<any>;
  canDelete: boolean;
}) {
  const [name, setName] = useState(building.name);
  const [floors, setFloors] = useState(building.floors);
  const [apts, setApts] = useState(building.apartmentsPerFloor);
  const [status, setStatus] = useState<BuildingLike["status"]>(building.status);
  let initLabels: string[] = [];
  try { initLabels = JSON.parse(building.apartmentLabels); } catch { initLabels = []; }
  const [labels, setLabels] = useState<string[]>(initLabels);
  const [saving, setSaving] = useState(false);

  const updateLabel = (i: number, v: string) => {
    const arr = [...labels];
    arr[i] = v;
    setLabels(arr);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateBuilding({ projectId, buildingId: building.id, data: { name, floors, apartmentsPerFloor: apts, apartmentLabels: labels, status } });
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
            <Label className="text-xs text-muted-foreground pt-1.5">Apt Labels</Label>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: apts }, (_, i) => (
                <Input key={i} value={labels[i] ?? String.fromCharCode(65 + i)} onChange={(e) => updateLabel(i, e.target.value)} className="w-14 h-8 text-center text-xs" />
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
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-1.5 w-36 justify-center">
              <HugeiconsIcon icon={SaveIcon} size={14} />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
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
              <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 shrink-0 w-36 justify-center" onClick={() => onDeleteBuilding({ projectId, buildingId: building.id })}>
                <HugeiconsIcon icon={Delete02Icon} size={14} />
                Delete Building
              </Button>
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
  name: string;
  floors: number;
  apartmentsPerFloor: number;
  apartmentLabels: string;
  sortOrder: number;
  status: "draft" | "active" | "completed" | "archived";
  createdAt: number;
}

function BuildingsManager({
  projectId, buildings, onCreateBuilding,
}: {
  projectId: string;
  buildings: BuildingLike[];
  onCreateBuilding: (args: { projectId: string; data: { name: string; floors?: number; apartmentsPerFloor?: number; apartmentLabels?: string[] } }) => Promise<any>;
}) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFloors, setNewFloors] = useState(6);
  const [newApts, setNewApts] = useState(4);
  const [newLabels, setNewLabels] = useState<string[]>(["A", "B", "C", "D"]);

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
            return (
              <Card key={b.id} size="sm" className={`pb-0 cursor-pointer hover:border-primary/40 transition-colors${b.status === "archived" ? " opacity-50" : ""}`} onClick={() => navigate(`/projects/${projectId}/buildings/${b.id}`)}>
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
    </div>
  );
}

// ─── Floor Assignments Tab ─────────────────────────────────────────────────────────

function FloorAssignments({
  projectId, building, aptTemplates, existingAssignments, onPrev, onNext, hasPrev, hasNext,
}: {
  projectId: string;
  building: BuildingLike;
  aptTemplates: { id: string; name: string }[];
  existingAssignments: { floor: number; apartmentIndex: number; apartmentTemplateId: string | null }[];
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
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
                  Apartment {apartmentLabels[i] ?? String.fromCharCode(65 + i)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: floors }, (_, f) => (
              <TableRow key={f} className="group">
                <TableCell className="text-xs font-medium py-1.5 text-muted-foreground group-hover:text-foreground">Floor {f + 1}</TableCell>
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
                        {aptTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              <HugeiconsIcon icon={SaveIcon} size={14} />
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

  const handleFillBucket = (openingId: string, width: string, height: string, cells: { floor: number; aptIndex: number }[]) => {
    setSizes((s) => {
      const newS = { ...s };
      for (const { floor, aptIndex } of cells) {
        newS[`${openingId}_${floor}_${aptIndex}`] = { width, height };
      }
      return newS;
    });
  };

  const handleClearAll = (openingId: string) => {
    setSizes((s) => {
      const newS = { ...s };
      for (const key of Object.keys(newS)) {
        if (key.startsWith(`${openingId}_`)) {
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
        width: String(s.width),
        height: String(s.height),
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
        No apartment types assigned yet. Go to Floor Assignments first.
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
          onFillBucket={handleFillBucket}
          onClearAll={handleClearAll}
          openingChips={
            <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5">
              {allOpenings.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    activeOpeningId === o.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveOpeningId(o.id)}
                >
                  {o.label}
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
              <HugeiconsIcon icon={SaveIcon} size={14} />
              {saveMutation.isPending ? "Saving..." : "Save Sizes"}
            </Button>
          </div>
      </div>
    </div>
  );
}

function OpeningSizeGrid({
  openingId, openingLabel, floors, apartmentsPerFloor, apartmentLabels,
  assignmentMap, templateOpeningsMap, sizes, onCellChange, onFillAll, onFillBucket, onClearAll, openingChips,
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
  onFillBucket: (openingId: string, width: string, height: string, cells: { floor: number; aptIndex: number }[]) => void;
  onClearAll: (openingId: string) => void;
  openingChips: ReactNode;
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

  // Half-bucket overlap: assign each cell to two offset buckets per dimension,
  // then union all buckets a cell belongs to. Guarantees values within 1.5cm share a color.
  const BUCKET_SIZE = 1.5;
  const HALF_BUCKET = BUCKET_SIZE / 2;
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
    // Union-find structure
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      let root = x;
      while (parent.get(root) !== root) root = parent.get(root)!;
      // Path compression
      let curr = x;
      while (parent.get(curr) !== root) {
        const next = parent.get(curr)!;
        parent.set(curr, root);
        curr = next;
      }
      return root;
    };
    const union = (a: string, b: string) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    // For each cell, compute 4 bucket keys (2 per dimension: floor and floor+half offset)
    // and union them together
    const cellBuckets: Record<string, string[]> = {};
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < apartmentsPerFloor; i++) {
        const key = `${openingId}_${f}_${i}`;
        const cell = sizes[key];
        if (!cell || !cell.width || !cell.height) continue;
        const w = parseFloat(cell.width);
        const h = parseFloat(cell.height);
        if (isNaN(w) || isNaN(h)) continue;
        const wB1 = Math.floor(w / BUCKET_SIZE);
        const wB2 = Math.floor((w + HALF_BUCKET) / BUCKET_SIZE);
        const hB1 = Math.floor(h / BUCKET_SIZE);
        const hB2 = Math.floor((h + HALF_BUCKET) / BUCKET_SIZE);
        const buckets = [
          `${wB1}_${hB1}`, `${wB1}_${hB2}`,
          `${wB2}_${hB1}`, `${wB2}_${hB2}`,
        ];
        cellBuckets[key] = buckets;
        for (let b = 1; b < buckets.length; b++) union(buckets[0], buckets[b]);
      }
    }

    // Union cells that share any bucket
    const bucketToCells = new Map<string, string[]>();
    for (const [cellKey, buckets] of Object.entries(cellBuckets)) {
      for (const b of buckets) {
        if (!bucketToCells.has(b)) bucketToCells.set(b, []);
        bucketToCells.get(b)!.push(cellKey);
      }
    }
    for (const cells of bucketToCells.values()) {
      for (let c = 1; c < cells.length; c++) {
        union(cellBuckets[cells[0]][0], cellBuckets[cells[c]][0]);
      }
    }

    // Assign colors by root and collect bucket groups
    const rootColorMap = new Map<string, number>();
    const rootCellsMap = new Map<string, { floor: number; aptIndex: number; w: number; h: number }[]>();
    let colorIdx = 0;
    const tintMap: Record<string, string> = {};
    for (const [cellKey, buckets] of Object.entries(cellBuckets)) {
      const root = find(buckets[0]);
      if (!rootColorMap.has(root)) {
        rootColorMap.set(root, colorIdx % CELL_TINTS.length);
        colorIdx++;
      }
      tintMap[cellKey] = CELL_TINTS[rootColorMap.get(root)!];
      const parts = cellKey.split("_");
      const f = parseInt(parts[1]);
      const i = parseInt(parts[2]);
      const cell = sizes[cellKey]!;
      if (!rootCellsMap.has(root)) rootCellsMap.set(root, []);
      rootCellsMap.get(root)!.push({ floor: f, aptIndex: i, w: parseFloat(cell.width), h: parseFloat(cell.height) });
    }
    // Build bucket groups with representative W×H (average) and color
    const bucketGroups = Array.from(rootColorMap.entries()).map(([root, colorIdx]) => {
      const cells = rootCellsMap.get(root) ?? [];
      const avgW = cells.length > 0 ? (cells.reduce((s, c) => s + c.w, 0) / cells.length).toFixed(1) : "";
      const avgH = cells.length > 0 ? (cells.reduce((s, c) => s + c.h, 0) / cells.length).toFixed(1) : "";
      return {
        root,
        color: CELL_TINTS[colorIdx],
        dotColor: CELL_DOT_COLORS[colorIdx],
        label: `${avgW} × ${avgH}`,
        cells: cells.map((c) => ({ floor: c.floor, aptIndex: c.aptIndex })),
      };
    });
    return { tintMap, bucketGroups };
  }, [sizes, floors, apartmentsPerFloor, openingId]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {openingChips}
        <div className="flex items-center gap-1">
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
          <Select onValueChange={(v: string | null) => {
            if (!v) return;
            if (v === "all") {
              if (bulkW && bulkH) onFillAll(openingId, bulkW, bulkH);
            } else {
              const group = bucketGroups.find((g) => g.root === v);
              if (group && bulkW && bulkH) onFillBucket(openingId, bulkW, bulkH, group.cells);
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
            onClick={() => onClearAll(openingId)}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
            <TableRow className="border-b hover:bg-transparent">
              <TableHead className="h-9 text-xs w-24 font-semibold">{openingLabel}</TableHead>
              {Array.from({ length: apartmentsPerFloor }, (_, i) => (
                <TableHead key={i} className="h-9 text-xs text-center font-semibold">
                  Apartment {apartmentLabels[i] ?? String.fromCharCode(65 + i)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: floors }, (_, f) => (
              <TableRow key={f} className="group">
                <TableCell className="text-xs font-medium py-1.5 text-muted-foreground group-hover:text-foreground">Floor {f + 1}</TableCell>
                {Array.from({ length: apartmentsPerFloor }, (_, i) => {
                  const hasOpening = cellHasOpening(f, i);
                  const key = `${openingId}_${f}_${i}`;
                  const cellSize = sizes[key] ?? { width: "", height: "" };
                  const tint = cellTintMap[key];
                  return (
                    <TableCell key={i} className="py-3 px-4 text-center">
                      {hasOpening ? (
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            placeholder="W"
                            value={cellSize.width}
                            onChange={(e) => onCellChange(openingId, f, i, "width", e.target.value)}
                            className={`w-24 h-6 text-xs ${tint ? `ring-1 ${tint}` : ""}`}
                          />
                          <span className="text-xs text-muted-foreground">×</span>
                          <Input
                            type="number"
                            placeholder="H"
                            value={cellSize.height}
                            onChange={(e) => onCellChange(openingId, f, i, "height", e.target.value)}
                            className={`w-24 h-6 text-xs ${tint ? `ring-1 ${tint}` : ""}`}
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
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <HugeiconsIcon icon={InformationSquareIcon} size={14} />
        Cells with similar W×H values (within 1.5cm) share the same ring color.
      </p>
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
  const floors = building.floors;
  const apartmentsPerFloor = building.apartmentsPerFloor;
  let apartmentLabels: string[] = [];
  try { apartmentLabels = JSON.parse(building.apartmentLabels); } catch { apartmentLabels = []; }

  // Build sizes map from existing sizes (read-only, no state needed)
  const sizes = useMemo(() => {
    const g: SizeGrid = {};
    for (const s of existingSizes) {
      g[`${s.apartmentTemplateOpeningId}_${s.floor}_${s.apartmentIndex}`] = {
        width: String(s.width),
        height: String(s.height),
      };
    }
    return g;
  }, [existingSizes]);

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

  // Fetch openings for each used template
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

  // All unique openings across all used templates
  const allOpenings = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; label: string }[] = [];
    for (const openings of Object.values(templateOpeningsMap)) {
      for (const o of openings) {
        if (!seen.has(o.id)) {
          seen.add(o.id);
          list.push(o);
        }
      }
    }
    return list;
  }, [templateOpeningsMap]);

  // For each opening, group cells by exact W×H and collect floor/apt assignments
  const openingGroups = useMemo(() => {
    return allOpenings.map((opening) => {
      // Collect all cells for this opening that have sizes
      const cells: { floor: number; aptIndex: number; w: number; h: number }[] = [];
      for (let f = 0; f < floors; f++) {
        for (let i = 0; i < apartmentsPerFloor; i++) {
          const aptTplId = assignmentMap[`${f}_${i}`];
          if (!aptTplId) continue;
          const openings = templateOpeningsMap[aptTplId] ?? [];
          if (!openings.some((o) => o.id === opening.id)) continue;
          const key = `${opening.id}_${f}_${i}`;
          const cell = sizes[key];
          if (!cell || !cell.width || !cell.height) continue;
          const w = parseFloat(cell.width);
          const h = parseFloat(cell.height);
          if (isNaN(w) || isNaN(h)) continue;
          cells.push({ floor: f, aptIndex: i, w, h });
        }
      }

      // Group cells by exact W×H
      const sizeKeyMap = new Map<string, { floor: number; aptIndex: number; w: number; h: number }[]>();
      for (const cell of cells) {
        const sizeKey = `${cell.w}_${cell.h}`;
        if (!sizeKeyMap.has(sizeKey)) sizeKeyMap.set(sizeKey, []);
        sizeKeyMap.get(sizeKey)!.push(cell);
      }

      const sizeGroups = Array.from(sizeKeyMap.entries()).map(([sizeKey, groupCells]) => ({
        root: sizeKey,
        avgW: String(groupCells[0].w),
        avgH: String(groupCells[0].h),
        locations: groupCells.map((c) =>
          `${apartmentLabels[c.aptIndex] ?? String.fromCharCode(65 + c.aptIndex)}${c.floor + 1}`
        ),
        count: groupCells.length,
      }));

      return { opening, sizeGroups };
    });
  }, [allOpenings, sizes, floors, apartmentsPerFloor, assignmentMap, templateOpeningsMap, apartmentLabels]);

  const [activeOpeningId, setActiveOpeningId] = useState<string | null>(null);

  // Auto-select first opening
  useEffect(() => {
    if (!activeOpeningId && allOpenings.length > 0) {
      setActiveOpeningId(allOpenings[0].id);
    }
  }, [allOpenings, activeOpeningId]);

  const activeGroup = openingGroups.find((g) => g.opening.id === activeOpeningId);

  const isLoading = templateQueries.some((q) => q.isLoading);

  if (isLoading) {
    return <div className="text-center text-sm text-muted-foreground py-8">Loading openings...</div>;
  }

  if (allOpenings.length === 0) {
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
          {allOpenings.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeOpeningId === o.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveOpeningId(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {activeGroup && (
          <Badge variant="secondary" className="text-[10px]">{activeGroup.sizeGroups.length} sizes</Badge>
        )}
      </div>

      {activeGroup && (
        <div className="flex flex-col gap-2">
          {activeGroup.sizeGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sizes entered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
                  <TableRow className="border-b hover:bg-transparent">
                    <TableHead className="h-9 text-xs w-24 font-semibold">{activeGroup.opening.label}</TableHead>
                    <TableHead className="h-9 text-xs text-center font-semibold">Qty</TableHead>
                    <TableHead className="h-9 text-xs text-start font-semibold">Locations</TableHead>
                    <TableHead className="h-9 text-xs text-center font-semibold">Width</TableHead>
                    <TableHead className="h-9 text-xs text-center font-semibold">Height</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeGroup.sizeGroups.map((group, idx) => (
                    <TableRow key={group.root} className="group">
                      <TableCell className="text-xs font-medium py-1.5 text-muted-foreground group-hover:text-foreground">
                        Size {idx + 1}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-center">
                        <span className="text-xs">{group.count}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="grid grid-cols-3 gap-0.5 w-fit">
                          {group.locations.map((loc, i) => (
                            <span key={i} className="text-[10px] text-muted-foreground text-center leading-tight py-0.5 px-1 rounded border border-border/60 w-12">{loc}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-center">
                        <span className="text-xs font-mono">{group.avgW}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-center">
                        <span className="text-xs font-mono">{group.avgH}</span>
                      </TableCell>
                    </TableRow>
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
