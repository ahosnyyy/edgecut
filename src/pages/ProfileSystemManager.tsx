import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useProfileSystems,
  useCreateProfileSystem,
  useUpdateProfileSystem,
  useDeleteProfileSystem,
  type ProfileSystem,
  type SystemConstant,
  type DefaultPiece,
} from "../hooks/useProfileSystems";
import {
  useProfileTypes,
  useCreateProfileType,
  useUpdateProfileType,
  useDeleteProfileType,
  type ProfileType,
} from "../hooks/useProfileTypes";
import TemplateManager from "./TemplateManager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";
import { LoadingState, CardSkeletonGrid, DialogLoadingState } from "../components/ui/loading-states";
import { SaveButton, DeleteGuardDialog } from "../components/ui/action-buttons";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  AddSquareIcon,
  Delete02Icon,
  PencilEdit01Icon,
  SlidersVerticalIcon,
  Search01Icon,
  FilterIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { useSettings } from "../hooks/useSettings";

interface ConstantRow {
  name: string;
  label: string;
  defaultValue: number;
}

interface PieceRow {
  label: string;
  profileType: string;
  lengthFormula: string;
  quantity: number;
}

interface EditorProps {
  systemId: string | null;
  detail: ProfileSystem | null;
  isCreating: boolean;
  onClose: () => void;
}

interface SystemForm {
  name: string;
  key: string;
  constants: ConstantRow[];
  defaultPieces: PieceRow[];
}

function emptySystem(unitLabel: string): SystemForm {
  return {
    name: "",
    key: "",
    constants: [
      { name: "weldingAllowance", label: `Welding Allowance (${unitLabel}/end)`, defaultValue: 3 },
      { name: "frameDepth", label: `Frame Depth (${unitLabel})`, defaultValue: 60 },
      { name: "sashDepth", label: `Sash Depth (${unitLabel})`, defaultValue: 70 },
      { name: "sashOverlap", label: `Sash Overlap (${unitLabel})`, defaultValue: 8 },
      { name: "mullionDepth", label: `Mullion Depth (${unitLabel})`, defaultValue: 60 },
    ],
    defaultPieces: [],
  };
}

function systemFromDetail(detail: ProfileSystem, fromMM: (mm: number) => number): SystemForm {
  let pieces: PieceRow[] = [];
  if (detail.defaultPieces) {
    try {
      pieces = JSON.parse(detail.defaultPieces) as PieceRow[];
    } catch {
      pieces = [];
    }
  }
  const rawConstants = JSON.parse(detail.constants) as ConstantRow[];
  const constants = rawConstants.map((c) => ({
    ...c,
    defaultValue: fromMM(c.defaultValue),
  }));
  return {
    name: detail.name,
    key: detail.key,
    constants,
    defaultPieces: pieces,
  };
}

function ProfileSystemEditor({ systemId, detail, isCreating, onClose }: EditorProps) {
  const createMutation = useCreateProfileSystem();
  const updateMutation = useUpdateProfileSystem();
  const { fromMM, toMM, unitLabel } = useSettings();
  const { data: profileTypes } = useProfileTypes();

  const [form, setForm] = useState(() => {
    if (detail) return systemFromDetail(detail, fromMM);
    return emptySystem(unitLabel);
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  const isLoadingDetail = !!systemId && !detail;

  if (isLoadingDetail) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogLoadingState label="Loading profile system..." />
        </DialogContent>
      </Dialog>
    );
  }

  const handleSave = async () => {
    setSaveError(null);
    if (!form.name.trim()) {
      setSaveError("Name is required");
      return;
    }
    if (!form.key.trim()) {
      setSaveError("Key is required");
      return;
    }
    try {
      const saveData: SystemForm = {
        ...form,
        constants: form.constants.map((c) => ({
          ...c,
          defaultValue: toMM(c.defaultValue),
        })),
      };
      if (isCreating || !systemId) {
        await createMutation.mutateAsync(saveData);
      } else {
        await updateMutation.mutateAsync({ id: systemId, data: saveData });
      }
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const addConstant = () => {
    setForm((f) => ({
      ...f,
      constants: [...f.constants, { name: "", label: "", defaultValue: 0 }],
    }));
  };

  const updateConstant = (index: number, field: keyof ConstantRow, value: string | number) => {
    setForm((f) => ({
      ...f,
      constants: f.constants.map((c, i) =>
        i === index ? { ...c, [field]: value } : c,
      ),
    }));
  };

  const removeConstant = (index: number) => {
    setForm((f) => ({
      ...f,
      constants: f.constants.filter((_, i) => i !== index),
    }));
  };

  const addPiece = () => {
    setForm((f) => ({
      ...f,
      defaultPieces: [...f.defaultPieces, { label: "", profileType: "frame", lengthFormula: "", quantity: 1 }],
    }));
  };

  const updatePiece = (index: number, field: keyof PieceRow, value: string | number) => {
    setForm((f) => ({
      ...f,
      defaultPieces: f.defaultPieces.map((p, i) =>
        i === index ? { ...p, [field]: value } : p,
      ),
    }));
  };

  const removePiece = (index: number) => {
    setForm((f) => ({
      ...f,
      defaultPieces: f.defaultPieces.filter((_, i) => i !== index),
    }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreating ? "New Profile System" : form.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ps-name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="ps-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Manazil 60 Series"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ps-key">Key <span className="text-red-500">*</span></Label>
              <Input
                id="ps-key"
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="e.g. manazil_60"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <Separator />

          {/* Constants header + button + description (fixed) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Cutting Constants</h3>
              {form.constants.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {form.constants.length}
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addConstant}>
              <HugeiconsIcon icon={Add01Icon} size={12} />
              Add Constant
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">
            These constants are available as variables in piece template formulas. Values are in {unitLabel}.
          </p>
        </div>

        {/* Scrollable: constants list */}
        <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
          {form.constants.map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
              <span className="text-[10px] text-muted-foreground w-4 shrink-0 text-center font-medium">{i + 1}</span>
              <Input
                value={c.name}
                onChange={(e) => updateConstant(i, "name", e.target.value)}
                placeholder="weldingAllowance"
                className="font-mono text-xs h-7 border-0 bg-background w-36 shrink-0"
              />
              <Input
                value={c.label}
                onChange={(e) => updateConstant(i, "label", e.target.value)}
                placeholder="Welding Allowance"
                className="text-xs h-7 border-0 bg-background flex-1"
              />
              <div className="flex items-center gap-1 shrink-0">
                <Label className="text-[10px] text-muted-foreground">Default</Label>
                <Input
                  type="number"
                  value={c.defaultValue}
                  onChange={(e) => updateConstant(i, "defaultValue", parseFloat(e.target.value) || 0)}
                  className="text-xs h-7 w-20 border-0 bg-background"
                />
                <span className="text-[10px] text-muted-foreground shrink-0">{unitLabel}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeConstant(i)}
              >
                <HugeiconsIcon icon={Delete02Icon} size={12} />
              </Button>
            </div>
          ))}
          {form.constants.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-center">
              <HugeiconsIcon icon={AddSquareIcon} size={18} className="text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">No constants defined.</p>
            </div>
          )}
        </div>

        {/* Fixed: Default Pieces header + button + description */}
        <div className="flex flex-col gap-2 shrink-0">
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Default Pieces</h3>
              {form.defaultPieces.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {form.defaultPieces.length}
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addPiece}>
              <HugeiconsIcon icon={Add01Icon} size={12} />
              Add Piece
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">
            These pieces are loaded into templates that use this profile system. Formulas can use <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted">W</code>, <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted">H</code>, and the constants above.
          </p>
        </div>

        {/* Scrollable: default pieces list */}
        <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
          {form.defaultPieces.map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
              <span className="text-[10px] text-muted-foreground w-4 shrink-0 text-center font-medium">{i + 1}</span>
              <Input
                value={p.label}
                onChange={(e) => updatePiece(i, "label", e.target.value)}
                placeholder="Frame Top"
                className="text-xs h-7 border-0 bg-background w-28 shrink-0"
              />
              <select
                value={p.profileType}
                onChange={(e) => updatePiece(i, "profileType", e.target.value)}
                className="text-xs h-7 border-0 bg-background rounded-md px-2 w-24 shrink-0"
              >
                {(profileTypes ?? []).map((pt) => (
                  <option key={pt.key} value={pt.key}>{pt.label}</option>
                ))}
              </select>
              <Input
                value={p.lengthFormula}
                onChange={(e) => updatePiece(i, "lengthFormula", e.target.value)}
                placeholder="W - 2 * weldingAllowance"
                className="font-mono text-xs h-7 border-0 bg-background flex-1"
              />
              <div className="flex items-center gap-1 shrink-0">
                <Label className="text-[10px] text-muted-foreground">Qty</Label>
                <Input
                  type="number"
                  value={p.quantity}
                  onChange={(e) => updatePiece(i, "quantity", parseInt(e.target.value) || 1)}
                  className="text-xs h-7 w-14 border-0 bg-background"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removePiece(i)}
              >
                <HugeiconsIcon icon={Delete02Icon} size={12} />
              </Button>
            </div>
          ))}
          {form.defaultPieces.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-center">
              <HugeiconsIcon icon={AddSquareIcon} size={18} className="text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">No default pieces defined.</p>
            </div>
          )}
        </div>

        {saveError && (
          <div className="flex items-center gap-2 text-xs text-destructive shrink-0">
            <HugeiconsIcon icon={AlertCircleIcon} size={13} />
            <span>{saveError}</span>
          </div>
        )}

        <DialogFooter className="gap-2 shrink-0">
          <SaveButton
            onClick={handleSave}
            isPending={createMutation.isPending || updateMutation.isPending}
            isCreate={isCreating}
            onCancel={onClose}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileTypeEditor({
  type,
  onClose,
  onSave,
  isSaving,
}: {
  type: ProfileType | null;
  onClose: () => void;
  onSave: (data: { key: string; label: string }) => void;
  isSaving: boolean;
}) {
  const [key, setKey] = useState(type?.key ?? "");
  const [label, setLabel] = useState(type?.label ?? "");
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!type;
  const isReserved = type?.isReserved ?? false;

  const handleSave = () => {
    setError(null);
    if (!key.trim() || !label.trim()) {
      setError("Key and label are required");
      return;
    }
    onSave({ key: key.trim(), label: label.trim() });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Profile Type" : "New Profile Type"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <HugeiconsIcon icon={AlertCircleIcon} size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pt-key">Key</Label>
            <Input
              id="pt-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. reinforcement"
              disabled={isEditing || isReserved}
              className="font-mono text-sm"
            />
            {isReserved && (
              <p className="text-xs text-muted-foreground">Reserved keys cannot be changed.</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pt-label">Label</Label>
            <Input
              id="pt-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Reinforcement"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="gap-2 shrink-0">
          <SaveButton
            onClick={handleSave}
            isPending={isSaving}
            isCreate={!isEditing}
            onCancel={onClose}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileTypesTab({ search, setSearch }: { search: string; setSearch: (v: string) => void }) {
  const { data: types, isLoading } = useProfileTypes();
  const createMutation = useCreateProfileType();
  const updateMutation = useUpdateProfileType();
  const deleteMutation = useDeleteProfileType();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingType = editingId ? (types?.find((t) => t.id === editingId) ?? null) : null;

  const filtered = useMemo(() => {
    const list = types ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      return list.filter((t) =>
        t.key.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q),
      );
    }
    return list;
  }, [types, search]);

  const handleEdit = (id: string) => {
    setEditingId(id);
    setShowCreate(false);
  };

  const handleNew = () => {
    setShowCreate(true);
    setEditingId(null);
  };

  const handleClose = () => {
    setEditingId(null);
    setShowCreate(false);
  };

  const handleSave = async (data: { key: string; label: string }) => {
    if (editingId && editingType) {
      await updateMutation.mutateAsync({ id: editingId, label: data.label });
    } else {
      await createMutation.mutateAsync(data);
    }
    handleClose();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="px-4 py-2">
          {isLoading ? (
            <LoadingState label="Loading profile types..." />
          ) : filtered.length === 0 ? (
            search.trim() ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={Search01Icon} />
                  </EmptyMedia>
                  <EmptyTitle>No profile types match your search</EmptyTitle>
                  <EmptyDescription>
                    No results for "{search.trim()}".
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={SlidersVerticalIcon} />
                  </EmptyMedia>
                  <EmptyTitle>No profile types yet</EmptyTitle>
                  <EmptyDescription>
                    Define profile types like Frame, Sash, Mullion to categorize template pieces and stock items.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button className="gap-2" size="lg" onClick={handleNew}>
                    <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
                    New Profile Type
                  </Button>
                </EmptyContent>
              </Empty>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <Card
                size="sm"
                className="cursor-pointer border border-dashed border-muted-foreground/30 ring-0 bg-muted/10 hover:border-primary/40 hover:bg-muted/20 transition-colors"
                onClick={handleNew}
              >
                <div className="flex flex-col items-center justify-center gap-1.5 py-3">
                  <HugeiconsIcon icon={AddSquareIcon} size={20} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">New Type</span>
                </div>
              </Card>
              {filtered.map((pt) => (
                <Card
                  key={pt.id}
                  size="sm"
                  className="pb-0 cursor-pointer hover:border-primary/40 transition-colors group"
                  onClick={() => handleEdit(pt.id)}
                >
                  <CardHeader className="pb-1">
                    <CardAction>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); handleEdit(pt.id); }}
                        >
                          <HugeiconsIcon icon={PencilEdit01Icon} size={13} />
                        </Button>
                        {!pt.isReserved && (
                          <span onClick={(e) => e.stopPropagation()}>
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
                              usageCheckUrl={`/api/profile-types/${pt.id}/usage`}
                              title="Delete this profile type?"
                              description="This will permanently remove the profile type."
                              entityName={pt.label}
                              onConfirm={async () => {
                                await handleDelete(pt.id);
                              }}
                              isPending={deleteMutation.isPending}
                            />
                          </span>
                        )}
                      </div>
                    </CardAction>
                    <CardTitle className="text-sm truncate flex items-center gap-1.5">
                      {pt.label}
                    </CardTitle>
                    <CardDescription className="text-xs truncate font-mono">
                      {pt.key}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="bg-muted/50 py-2.5">
                    <div className="flex items-center justify-between w-full gap-2 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {pt.isReserved ? (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Reserved</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">Custom</Badge>
                        )}
                        <Separator orientation="vertical" className="my-0.5" />
                        <span>Created {new Date(pt.createdAt).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {(showCreate || editingId) && (
        <ProfileTypeEditor
          type={editingType}
          onClose={handleClose}
          onSave={handleSave}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}

export default function ProfileSystemManager() {
  const { data: systems, isLoading } = useProfileSystems();
  const { data: types } = useProfileTypes();

  const deleteMutation = useDeleteProfileSystem();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typesSearch, setTypesSearch] = useState("");
  const [templatesSearch, setTemplatesSearch] = useState("");
  const [templatesFilterType, setTemplatesFilterType] = useState<string>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "systems";
  const setActiveTab = (v: string) => {
    setSearchParams(v === "systems" ? {} : { tab: v }, { replace: true });
  };

  const editingSystem = editingId ? (systems?.find((s) => s.id === editingId) ?? null) : null;

  const filtered = useMemo(() => {
    const list = systems ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      return list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q),
      );
    }
    return list;
  }, [systems, search]);

  const handleEdit = (id: string) => {
    setEditingId(id);
    setShowCreate(false);
  };

  const handleNew = () => {
    setShowCreate(true);
    setEditingId(null);
  };

  const handleClose = () => {
    setEditingId(null);
    setShowCreate(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">
            {activeTab === "types" ? "Profile Types" : activeTab === "systems" ? "Profile Systems" : "Piece Templates"}
          </h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
          <TabsList>
            <TabsTrigger value="systems" className="px-4">Systems</TabsTrigger>
            <TabsTrigger value="types" className="px-4">Types</TabsTrigger>
            <TabsTrigger value="templates" className="px-4">Templates</TabsTrigger>
          </TabsList>
          <TabsContent value="systems" className="flex-1">
            <div className="flex items-center justify-end gap-2">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or key..."
                  className="w-48 pl-7 text-xs"
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="types" className="flex-1">
            <div className="flex items-center justify-end gap-2">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  value={typesSearch}
                  onChange={(e) => setTypesSearch(e.target.value)}
                  placeholder="Search by key or label..."
                  className="w-48 pl-7 text-xs"
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="templates" className="flex-1">
            <div className="flex items-center justify-end gap-2">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  value={templatesSearch}
                  onChange={(e) => setTemplatesSearch(e.target.value)}
                  placeholder="Search by name..."
                  className="w-48 pl-7 text-xs"
                />
              </div>
              <Select
                value={templatesFilterType}
                onValueChange={(v) => setTemplatesFilterType(v ?? "all")}
              >
                <SelectTrigger className="w-32 h-8 text-xs gap-1.5">
                  <HugeiconsIcon icon={FilterIcon} size={14} className="text-muted-foreground" />
                  <SelectValue>
                    {templatesFilterType === "all" ? "All Types" : templatesFilterType === "window" ? "Windows" : "Doors"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="window">Windows</SelectItem>
                  <SelectItem value="door">Doors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </div>

        <TabsContent value="types" className="flex-1 overflow-hidden">
          <ProfileTypesTab search={typesSearch} setSearch={setTypesSearch} />
        </TabsContent>

        <TabsContent value="templates" className="flex-1 overflow-hidden">
          <TemplateManager
            search={templatesSearch}
            setSearch={setTemplatesSearch}
            filterType={templatesFilterType}
            setFilterType={setTemplatesFilterType}
          />
        </TabsContent>

        <TabsContent value="systems" className="flex-1 overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="px-4 py-2">
                {isLoading ? (
                  <LoadingState label="Loading profile systems..." />
                ) : filtered.length === 0 ? (
                  search.trim() ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <HugeiconsIcon icon={Search01Icon} />
                        </EmptyMedia>
                        <EmptyTitle>No profile systems match your search</EmptyTitle>
                        <EmptyDescription>
                          No results for "{search.trim()}".
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                          Clear search
                        </Button>
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <HugeiconsIcon icon={SlidersVerticalIcon} />
                        </EmptyMedia>
                        <EmptyTitle>No profile systems yet</EmptyTitle>
                        <EmptyDescription>
                          Define profile systems with cutting constants that piece templates can reference in their formulas.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button className="gap-2" size="lg" onClick={handleNew}>
                          <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
                          New Profile System
                        </Button>
                      </EmptyContent>
                    </Empty>
                  )
                ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <Card
                size="sm"
                className="cursor-pointer border border-dashed border-muted-foreground/30 ring-0 bg-muted/10 hover:border-primary/40 hover:bg-muted/20 transition-colors"
                onClick={handleNew}
              >
                <div className="flex flex-col items-center justify-center gap-1.5 py-3">
                  <HugeiconsIcon icon={AddSquareIcon} size={20} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">New System</span>
                </div>
              </Card>
              {filtered.map((sys) => {
                const constants = (() => {
                  try {
                    return JSON.parse(sys.constants) as SystemConstant[];
                  } catch {
                    return [];
                  }
                })();
                const pieces = (() => {
                  if (!sys.defaultPieces) return [];
                  try {
                    return JSON.parse(sys.defaultPieces) as DefaultPiece[];
                  } catch {
                    return [];
                  }
                })();
                return (
                  <Card
                    key={sys.id}
                    size="sm"
                    className="pb-0 cursor-pointer hover:border-primary/40 transition-colors group"
                    onClick={() => handleEdit(sys.id)}
                  >
                    <CardHeader className="pb-1">
                      <CardAction>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); handleEdit(sys.id); }}
                          >
                            <HugeiconsIcon icon={PencilEdit01Icon} size={13} />
                          </Button>
                        <span onClick={(e) => e.stopPropagation()}>
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
                          usageCheckUrl={`/api/profile-systems/${sys.id}/usage`}
                          title="Delete this profile system?"
                          description="This will permanently remove the profile system and its constants."
                          entityName={sys.name}
                          onConfirm={async () => {
                            await deleteMutation.mutateAsync(sys.id);
                          }}
                          isPending={deleteMutation.isPending}
                        />
                        </span>
                        </div>
                      </CardAction>
                      <CardTitle className="text-sm truncate flex items-center gap-1.5">
                        {sys.name}
                      </CardTitle>
                      <CardDescription className="text-xs truncate font-mono">
                        {sys.key}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="bg-muted/50 py-2.5">
                      <div className="flex items-center justify-between w-full gap-2 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                            {constants.length} {constants.length === 1 ? "constant" : "constants"}
                          </Badge>
                          {pieces.length > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                              {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
                            </Badge>
                          )}
                          <Separator orientation="vertical" className="my-0.5" />
                          <span>Created {new Date(sys.createdAt).toLocaleDateString("en-GB")}</span>
                        </div>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
        </TabsContent>
        </Tabs>

      {(showCreate || editingId) && (
        <ProfileSystemEditor
          systemId={editingId}
          detail={editingSystem}
          isCreating={showCreate}
          onClose={handleClose}
        />
      )}

    </div>
  );
}
