import React, { useState, useMemo } from "react";
import {
  useTemplates,
  useTemplate,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
  type TemplateDetail,
} from "../hooks/useTemplates";
import { Button } from "../components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
import { ScrollArea } from "../components/ui/scroll-area";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { evaluateFormula, type FormulaContext } from "../engine/formula";
import { generatePieces } from "../engine/pieceGenerator";
import { useProfileSystems, type SystemConstant, type DefaultPiece } from "../hooks/useProfileSystems";
import {
  Add01Icon,
  AddSquareIcon,
  Copy01Icon,
  LockIcon,
  AlertCircleIcon,
  Delete02Icon,
  PencilEdit01Icon,
  CheckmarkCircle01Icon,
  Search01Icon,
  FilterIcon,
  Grid02Icon,
  Download04Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface PieceRow {
  id: string;
  label: string;
  profileType: "frame" | "sash" | "mullion" | "bead" | "custom";
  lengthFormula: string;
  quantity: number;
}

function emptyTemplate(): {
  name: string;
  type: "window" | "door";
  profileSystemId: string | null;
  variables: never[];
  pieces: PieceRow[];
} {
  return {
    name: "",
    type: "window",
    profileSystemId: null,
    variables: [],
    pieces: [],
  };
}

function templateFromDetail(detail: TemplateDetail): {
  name: string;
  type: "window" | "door";
  profileSystemId: string | null;
  variables: never[];
  pieces: PieceRow[];
} {
  return {
    name: detail.name,
    type: detail.type,
    profileSystemId: detail.profileSystemId ?? null,
    variables: [],
    pieces: detail.pieces
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({
        id: p.id,
        label: p.label,
        profileType: p.profileType,
        lengthFormula: p.lengthFormula,
        quantity: p.quantity,
      })),
  };
}

export default function TemplateManager() {
  const { data: templates, isLoading } = useTemplates();
  const { data: profileSystemsList } = useProfileSystems();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const { data: editingDetail } = useTemplate(editingId);

  const filtered = useMemo(() => {
    const list = templates ?? [];
    let result = list;
    if (filterType !== "all") {
      result = result.filter((t) => t.type === filterType);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.profileSystemId && profileSystemsList?.find((s) => s.id === t.profileSystemId)?.name.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [templates, search, filterType]);

  const handleEdit = (id: string) => {
    setEditingId(id);
    setIsCreating(false);
  };

  const handleNew = () => {
    setIsCreating(true);
    setEditingId(null);
  };

  const handleClose = () => {
    setEditingId(null);
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Piece Templates</h1>
          {templates && templates.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {templates.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-48 pl-7 text-xs"
            />
          </div>
          <Select
            value={filterType}
            onValueChange={(v) => setFilterType(v ?? "all")}
          >
            <SelectTrigger className="w-32 h-8 text-xs gap-1.5">
              <HugeiconsIcon icon={FilterIcon} size={14} className="text-muted-foreground" />
              <SelectValue>
                {filterType === "all" ? "All Types" : filterType === "window" ? "Windows" : "Doors"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="window">Windows</SelectItem>
              <SelectItem value="door">Doors</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Loading templates...
            </div>
          ) : filtered.length === 0 ? (
            search.trim() || filterType !== "all" ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={FilterIcon} />
                  </EmptyMedia>
                  <EmptyTitle>No templates match your filters</EmptyTitle>
                  <EmptyDescription>
                    {search.trim()
                      ? `No results for "${search.trim()}".`
                      : `No ${filterType} templates found.`}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilterType("all"); }}>
                    Clear filters
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={Grid02Icon} />
                  </EmptyMedia>
                  <EmptyTitle>No piece templates yet</EmptyTitle>
                  <EmptyDescription>
                    Define reusable piece templates with variables and formulas. Apartment types reference these when creating openings.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button className="gap-2" size="lg" onClick={handleNew}>
                    <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
                    New Template
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
                  <span className="text-sm text-muted-foreground">New Template</span>
                </div>
              </Card>
              {filtered.map((tpl) => (
                <Card
                  key={tpl.id}
                  size="sm"
                  className="pb-0 cursor-pointer hover:border-primary/40 transition-colors group"
                  onClick={() => handleEdit(tpl.id)}
                >
                  <CardHeader className="pb-1">
                    <CardAction>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); handleEdit(tpl.id); }}
                        >
                          <HugeiconsIcon icon={PencilEdit01Icon} size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(tpl.id); }}
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={13} />
                        </Button>
                      </div>
                    </CardAction>
                    <CardTitle className="text-sm truncate flex items-center gap-1.5">
                      {tpl.name}
                      {tpl.isBuiltin && (
                        <HugeiconsIcon icon={LockIcon} size={11} className="text-muted-foreground shrink-0" />
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs truncate">
                      {(() => {
                        const sys = tpl.profileSystemId ? profileSystemsList?.find((s) => s.id === tpl.profileSystemId) : null;
                        return sys ? sys.name : "No profile system";
                      })()}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="bg-muted/50 py-2.5">
                    <div className="flex items-center justify-between w-full gap-2 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 capitalize">
                          {tpl.type}
                        </Badge>
                        {tpl.profileSystemId && profileSystemsList && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            {profileSystemsList.find((s) => s.id === tpl.profileSystemId)?.name ?? "Unknown"}
                          </Badge>
                        )}
                        {tpl.isBuiltin && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5">
                            <HugeiconsIcon icon={LockIcon} size={8} />
                            Built-in
                          </Badge>
                        )}
                        <Separator orientation="vertical" className="my-0.5" />
                        <span>Created {new Date(tpl.createdAt).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {(editingId || isCreating) && (
        <TemplateEditor
          templateId={editingId}
          detail={editingDetail ?? null}
          isCreating={isCreating}
          onClose={handleClose}
        />
      )}

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The template and all its variables
              and pieces will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <DeleteConfirmAction deleteId={deleteId} onDone={() => setDeleteId(null)} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeleteConfirmAction({
  deleteId,
  onDone,
}: {
  deleteId: string | null;
  onDone: () => void;
}) {
  const deleteMutation = useDeleteTemplate();
  return (
    <AlertDialogAction
      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      onClick={async () => {
        if (!deleteId) return;
        try {
          await deleteMutation.mutateAsync(deleteId);
          onDone();
        } catch {
          // error handled by mutation
        }
      }}
    >
      Delete
    </AlertDialogAction>
  );
}

interface TemplateEditorProps {
  templateId: string | null;
  detail: TemplateDetail | null;
  isCreating: boolean;
  onClose: () => void;
}

function TemplateEditor({
  templateId,
  detail,
  isCreating,
  onClose,
}: TemplateEditorProps) {
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const duplicateMutation = useDuplicateTemplate();
  const { data: profileSystemsList } = useProfileSystems();

  const [form, setForm] = useState(() => {
    if (detail) return templateFromDetail(detail);
    return emptyTemplate();
  });

  const [previewW, setPreviewW] = useState(120);
  const [previewH, setPreviewH] = useState(140);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isBuiltin = detail?.isBuiltin ?? false;
  const isLoadingDetail = !!templateId && !detail;

  // Resolve system constants for the selected profile system
  const systemConstants = useMemo((): SystemConstant[] => {
    if (!form.profileSystemId || !profileSystemsList) return [];
    const sys = profileSystemsList.find((s) => s.id === form.profileSystemId);
    if (!sys) return [];
    try {
      return JSON.parse(sys.constants) as SystemConstant[];
    } catch {
      return [];
    }
  }, [form.profileSystemId, profileSystemsList]);

  // Build formula context with system constants
  const formulaCtx = useMemo((): FormulaContext => {
    const ctx: FormulaContext = { W: previewW * 100, H: previewH * 100 };
    for (const c of systemConstants) {
      ctx[c.name] = c.defaultValue;
    }
    return ctx;
  }, [previewW, previewH, systemConstants]);

  const previewPieces = useMemo(() => {
    const piecesWithIds = form.pieces.map((p) => ({
      ...p,
      id: p.id || crypto.randomUUID(),
    }));
    return generatePieces(piecesWithIds, systemConstants, previewW * 100, previewH * 100);
  }, [form.pieces, systemConstants, previewW, previewH]);

  const formulaErrors = useMemo(() => {
    const errors: Record<number, string | null> = {};
    form.pieces.forEach((p, i) => {
      const result = evaluateFormula(p.lengthFormula, formulaCtx);
      errors[i] = result.error;
    });
    return errors;
  }, [form.pieces, formulaCtx]);

  const hasErrors = Object.values(formulaErrors).some((e) => e !== null);

  const handleSave = async () => {
    setSaveError(null);
    if (!form.name.trim()) {
      setSaveError("Name is required");
      return;
    }
    if (hasErrors) {
      setSaveError("Fix formula errors before saving");
      return;
    }
    try {
      if (isCreating || !templateId) {
        await createMutation.mutateAsync(form);
      } else {
        await updateMutation.mutateAsync({ id: templateId, data: form });
      }
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleDuplicate = async () => {
    if (!templateId) return;
    try {
      await duplicateMutation.mutateAsync(templateId);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Duplicate failed");
    }
  };

  const addPiece = () => {
    setForm((f) => ({
      ...f,
      pieces: [
        ...f.pieces,
        {
          id: crypto.randomUUID(),
          label: "",
          profileType: "frame",
          lengthFormula: "W",
          quantity: 1,
        },
      ],
    }));
  };

  const updatePiece = (index: number, field: keyof PieceRow, value: string | number) => {
    setForm((f) => ({
      ...f,
      pieces: f.pieces.map((p, i) =>
        i === index ? { ...p, [field]: value } : p,
      ),
    }));
  };

  const removePiece = (index: number) => {
    setForm((f) => ({
      ...f,
      pieces: f.pieces.filter((_, i) => i !== index),
    }));
  };

  if (isLoadingDetail) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl">
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading template...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreating ? "New Template" : form.name}
            {isBuiltin && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <HugeiconsIcon icon={LockIcon} size={10} />
                Built-in (read-only)
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Fixed top fields */}
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="tpl-name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={isBuiltin}
                placeholder="e.g. Casement Window 2-Panel"
              />
            </div>
            <div className="flex flex-col gap-1.5 w-32 shrink-0">
              <Label htmlFor="tpl-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v: "window" | "door" | null) => setForm((f) => ({ ...f, type: v ?? "window" }))}
                disabled={isBuiltin}
              >
                <SelectTrigger id="tpl-type" className="w-full">
                  <SelectValue>
                    {form.type === "window" ? "Window" : "Door"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="window">Window</SelectItem>
                  <SelectItem value="door">Door</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="tpl-profile-system">Profile System</Label>
              <Select
                value={form.profileSystemId ?? "none"}
                onValueChange={(v: string | null) => setForm((f) => ({ ...f, profileSystemId: v === "none" ? null : v }))}
                disabled={isBuiltin}
              >
                <SelectTrigger id="tpl-profile-system" className="w-full">
                  <SelectValue>
                    {form.profileSystemId
                      ? profileSystemsList?.find((s) => s.id === form.profileSystemId)?.name ?? "Unknown"
                      : "Select..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {profileSystemsList?.map((sys) => (
                    <SelectItem key={sys.id} value={sys.id}>
                      {sys.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {systemConstants.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {systemConstants.map((c) => (
                <Badge key={c.name} variant="secondary" className="text-[9px] h-4 px-1.5 font-mono">
                  {c.name}={c.defaultValue}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator className="shrink-0" />

        {/* Scrollable content: pieces + preview */}
        <div className="flex flex-col gap-3 overflow-y-auto pr-1">

          {/* Pieces */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Cutting Pieces</h3>
                {form.pieces.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {form.pieces.length}
                  </Badge>
                )}
              </div>
              {!isBuiltin && (
                <div className="flex items-center gap-1.5">
                  {form.profileSystemId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        const sys = profileSystemsList?.find((s) => s.id === form.profileSystemId);
                        if (!sys?.defaultPieces) return;
                        try {
                          const pieces = JSON.parse(sys.defaultPieces) as DefaultPiece[];
                          if (pieces.length === 0) return;
                          const replace = form.pieces.length === 0 || window.confirm(
                            `Replace existing ${form.pieces.length} piece(s) with ${pieces.length} default piece(s) from ${sys.name}?`
                          );
                          if (!replace) return;
                          setForm((f) => ({
                            ...f,
                            pieces: pieces.map((p) => ({
                              id: crypto.randomUUID(),
                              label: p.label,
                              profileType: p.profileType as PieceRow["profileType"],
                              lengthFormula: p.lengthFormula,
                              quantity: p.quantity,
                            })),
                          }));
                        } catch {
                          // ignore parse errors
                        }
                      }}
                    >
                      <HugeiconsIcon icon={Download04Icon} size={12} />
                      Load from System
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addPiece}>
                    <HugeiconsIcon icon={Add01Icon} size={12} />
                    Add Piece
                  </Button>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Use <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted">W</code> for opening width and <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted">H</code> for opening height (in cm).
              {systemConstants.length > 0 && (
                <> System constants: {systemConstants.map((c) => (
                  <code key={c.name} className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted">{c.name}</code>
                )).reduce<React.ReactNode[]>((acc, el, i) => {
                  if (i > 0) acc.push(", ");
                  acc.push(el);
                  return acc;
                }, [])}.</>
              )}
            </p>
            <div className="flex flex-col gap-1.5">
              {form.pieces.map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                  <span className="text-[10px] text-muted-foreground w-4 shrink-0 text-center font-medium">{i + 1}</span>
                  <Input
                    value={p.label}
                    onChange={(e) => updatePiece(i, "label", e.target.value)}
                    disabled={isBuiltin}
                    placeholder="Frame Width"
                    className="text-xs h-7 border-0 bg-background w-28 shrink-0"
                  />
                  <Select
                    value={p.profileType}
                    onValueChange={(v: PieceRow["profileType"] | null) => updatePiece(i, "profileType", v ?? "frame")}
                    disabled={isBuiltin}
                  >
                    <SelectTrigger className="text-xs h-7 w-24 border-0 bg-background shrink-0 capitalize">
                      <SelectValue>
                        {p.profileType}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frame">Frame</SelectItem>
                      <SelectItem value="sash">Sash</SelectItem>
                      <SelectItem value="mullion">Mullion</SelectItem>
                      <SelectItem value="bead">Bead</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={p.lengthFormula}
                    onChange={(e) => updatePiece(i, "lengthFormula", e.target.value)}
                    disabled={isBuiltin}
                    placeholder="W + 6"
                    className={`font-mono text-xs h-7 border-0 bg-background flex-1 ${formulaErrors[i] ? "ring-1 ring-destructive" : ""}`}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <Label className="text-[10px] text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      value={p.quantity}
                      onChange={(e) => updatePiece(i, "quantity", parseInt(e.target.value) || 1)}
                      disabled={isBuiltin}
                      className="text-xs h-7 w-14 border-0 bg-background"
                    />
                  </div>
                  {!isBuiltin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removePiece(i)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={12} />
                    </Button>
                  )}
                </div>
              ))}
              {form.pieces.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-1.5 py-5 text-center rounded-md border border-dashed border-muted-foreground/20">
                  <HugeiconsIcon icon={AddSquareIcon} size={20} className="text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">
                    {form.profileSystemId
                      ? "No pieces yet. Click \"Load from System\" to auto-generate, or \"Add Piece\" manually."
                      : "No pieces defined. Select a profile system to auto-generate, or add manually."}
                  </p>
                </div>
              )}
            </div>
            {hasErrors && (
              <p className="text-[11px] text-destructive">Fix formula errors before saving.</p>
            )}
          </div>

          <Separator className="shrink-0" />

          {/* Live Preview */}
          <div className="flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Cut Preview</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Opening W</Label>
                  <Input
                    type="number"
                    value={previewW}
                    onChange={(e) => setPreviewW(parseFloat(e.target.value) || 0)}
                    className="w-20 text-xs h-7"
                  />
                  <span className="text-[10px] text-muted-foreground">cm</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">H</Label>
                  <Input
                    type="number"
                    value={previewH}
                    onChange={(e) => setPreviewH(parseFloat(e.target.value) || 0)}
                    className="w-20 text-xs h-7"
                  />
                  <span className="text-[10px] text-muted-foreground">cm</span>
                </div>
              </div>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-7 text-xs">Label</TableHead>
                    <TableHead className="h-7 text-xs">Profile</TableHead>
                    <TableHead className="h-7 text-xs text-right">Length (cm)</TableHead>
                    <TableHead className="h-7 text-xs text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewPieces.pieces.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs py-1.5">{p.label}</TableCell>
                      <TableCell className="text-xs py-1.5 capitalize">{p.profileType}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-mono">{(p.length / 100).toFixed(1)}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right">{p.quantity}</TableCell>
                    </TableRow>
                  ))}
                  {previewPieces.errors.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs py-1.5 text-destructive">
                        {previewPieces.errors.join(", ")}
                      </TableCell>
                    </TableRow>
                  )}
                  {previewPieces.pieces.length === 0 && previewPieces.errors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs py-1.5 text-muted-foreground text-center">
                        No pieces to preview
                      </TableCell>
                    </TableRow>
                  )}
                  {previewPieces.pieces.length > 0 && (
                    <TableRow className="border-t-2 font-medium bg-muted/30">
                      <TableCell className="text-xs py-1.5">Total</TableCell>
                      <TableCell className="text-xs py-1.5 text-muted-foreground">{previewPieces.pieces.reduce((s, p) => s + p.quantity, 0)} cuts</TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-mono">{(previewPieces.pieces.reduce((s, p) => s + p.length * p.quantity, 0) / 100).toFixed(1)}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right">—</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 text-xs text-destructive shrink-0">
              <HugeiconsIcon icon={AlertCircleIcon} size={13} />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 shrink-0">
          {isBuiltin ? (
            <>
              <Button variant="outline" onClick={handleDuplicate} disabled={duplicateMutation.isPending} className="gap-1.5">
                <HugeiconsIcon icon={Copy01Icon} size={14} />
                Duplicate
              </Button>
              <Button variant="ghost" onClick={onClose}>Close</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending || hasErrors}
                className="gap-1.5"
              >
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} />
                {isCreating ? "Create" : "Save"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
