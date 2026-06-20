import { useState, useMemo } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
import {
  Add01Icon,
  Copy01Icon,
  LockIcon,
  AlertCircleIcon,
  Delete01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useHeaderAction } from "../components/layout/header-actions";

interface VariableRow {
  name: string;
  label: string;
  defaultValue: number;
}

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
  category: string;
  variables: VariableRow[];
  pieces: PieceRow[];
} {
  return {
    name: "",
    type: "window",
    category: "Custom",
    variables: [{ name: "frameDepth", label: "Frame Depth", defaultValue: 60 }],
    pieces: [],
  };
}

function templateFromDetail(detail: TemplateDetail): {
  name: string;
  type: "window" | "door";
  category: string;
  variables: VariableRow[];
  pieces: PieceRow[];
} {
  return {
    name: detail.name,
    type: detail.type,
    category: detail.category,
    variables: detail.variables
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((v) => ({
        name: v.name,
        label: v.label,
        defaultValue: v.defaultValue,
      })),
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: editingDetail } = useTemplate(editingId);

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

  useHeaderAction("template-new", (
    <Button className="gap-1.5" onClick={handleNew}>
      <HugeiconsIcon icon={Add01Icon} size={14} />
      New Template
    </Button>
  ));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Loading templates...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates?.map((tpl) => (
                <Card
                  key={tpl.id}
                  className="cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => handleEdit(tpl.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm truncate">
                          {tpl.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tpl.category}
                        </p>
                      </div>
                      {tpl.isBuiltin && (
                        <HugeiconsIcon
                          icon={LockIcon}
                          size={14}
                          className="text-muted-foreground shrink-0"
                        />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {tpl.type}
                      </Badge>
                      {tpl.isBuiltin ? (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <HugeiconsIcon icon={LockIcon} size={10} />
                          Built-in
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1 px-2 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(tpl.id);
                          }}
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={12} />
                          Delete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Editor Dialog */}
      {(editingId || isCreating) && (
        <TemplateEditor
          templateId={editingId}
          detail={editingDetail ?? null}
          isCreating={isCreating}
          onClose={handleClose}
        />
      )}

      {/* Delete Confirmation */}
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

  const [form, setForm] = useState(() => {
    if (detail) return templateFromDetail(detail);
    return emptyTemplate();
  });

  const [previewW, setPreviewW] = useState(1500);
  const [previewH, setPreviewH] = useState(1400);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isBuiltin = detail?.isBuiltin ?? false;
  const isLoadingDetail = !!templateId && !detail;

  const previewPieces = useMemo(() => {
    const piecesWithIds = form.pieces.map((p) => ({
      ...p,
      id: p.id || crypto.randomUUID(),
    }));
    return generatePieces(piecesWithIds, form.variables, previewW, previewH);
  }, [form.pieces, form.variables, previewW, previewH]);

  const formulaErrors = useMemo(() => {
    const errors: Record<number, string | null> = {};
    form.pieces.forEach((p, i) => {
      const ctx: FormulaContext = { W: previewW, H: previewH };
      for (const v of form.variables) {
        ctx[v.name] = v.defaultValue;
      }
      const result = evaluateFormula(p.lengthFormula, ctx);
      errors[i] = result.error;
    });
    return errors;
  }, [form.pieces, form.variables, previewW, previewH]);

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

  const addVariable = () => {
    setForm((f) => ({
      ...f,
      variables: [...f.variables, { name: "", label: "", defaultValue: 0 }],
    }));
  };

  const updateVariable = (index: number, field: keyof VariableRow, value: string | number) => {
    setForm((f) => ({
      ...f,
      variables: f.variables.map((v, i) =>
        i === index ? { ...v, [field]: value } : v,
      ),
    }));
  };

  const removeVariable = (index: number) => {
    setForm((f) => ({
      ...f,
      variables: f.variables.filter((_, i) => i !== index),
    }));
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
        <DialogContent className="max-w-2xl">
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading template...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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

        <div className="flex flex-col gap-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={isBuiltin}
                placeholder="e.g. Casement Window 2-Panel"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-category">Category</Label>
              <Input
                id="tpl-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                disabled={isBuiltin}
                placeholder="e.g. Casement"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-type">Type</Label>
            <Select
              value={form.type}
              onValueChange={(v: "window" | "door" | null) => setForm((f) => ({ ...f, type: v ?? "window" }))}
              disabled={isBuiltin}
            >
              <SelectTrigger id="tpl-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="window">Window</SelectItem>
                <SelectItem value="door">Door</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Variables */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Variables</h3>
              {!isBuiltin && (
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addVariable}>
                  <HugeiconsIcon icon={Add01Icon} size={12} />
                  Add Variable
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {form.variables.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_80px_28px] gap-2 items-end">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Name</Label>
                    <Input
                      value={v.name}
                      onChange={(e) => updateVariable(i, "name", e.target.value)}
                      disabled={isBuiltin}
                      placeholder="frameDepth"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Label</Label>
                    <Input
                      value={v.label}
                      onChange={(e) => updateVariable(i, "label", e.target.value)}
                      disabled={isBuiltin}
                      placeholder="Frame Depth"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Default</Label>
                    <Input
                      type="number"
                      value={v.defaultValue}
                      onChange={(e) => updateVariable(i, "defaultValue", parseFloat(e.target.value) || 0)}
                      disabled={isBuiltin}
                      className="text-xs"
                    />
                  </div>
                  {!isBuiltin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeVariable(i)}
                    >
                      <HugeiconsIcon icon={Delete01Icon} size={14} />
                    </Button>
                  )}
                </div>
              ))}
              {form.variables.length === 0 && (
                <p className="text-xs text-muted-foreground">No variables defined. W and H are always available.</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Pieces */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Pieces</h3>
              {!isBuiltin && (
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addPiece}>
                  <HugeiconsIcon icon={Add01Icon} size={12} />
                  Add Piece
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {form.pieces.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_1fr_60px_28px] gap-2 items-end">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Label</Label>
                    <Input
                      value={p.label}
                      onChange={(e) => updatePiece(i, "label", e.target.value)}
                      disabled={isBuiltin}
                      placeholder="Frame Top"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Profile</Label>
                    <Select
                      value={p.profileType}
                      onValueChange={(v: PieceRow["profileType"] | null) => updatePiece(i, "profileType", v ?? "frame")}
                      disabled={isBuiltin}
                    >
                      <SelectTrigger className="text-xs h-7">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="frame">Frame</SelectItem>
                        <SelectItem value="sash">Sash</SelectItem>
                        <SelectItem value="mullion">Mullion</SelectItem>
                        <SelectItem value="bead">Bead</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Formula</Label>
                    <Input
                      value={p.lengthFormula}
                      onChange={(e) => updatePiece(i, "lengthFormula", e.target.value)}
                      disabled={isBuiltin}
                      placeholder="W - 2*frameDepth"
                      className={`font-mono text-xs ${formulaErrors[i] ? "border-destructive" : ""}`}
                    />
                    {formulaErrors[i] && (
                      <p className="text-[10px] text-destructive mt-0.5">{formulaErrors[i]}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      value={p.quantity}
                      onChange={(e) => updatePiece(i, "quantity", parseInt(e.target.value) || 1)}
                      disabled={isBuiltin}
                      className="text-xs"
                    />
                  </div>
                  {!isBuiltin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removePiece(i)}
                    >
                      <HugeiconsIcon icon={Delete01Icon} size={14} />
                    </Button>
                  )}
                </div>
              ))}
              {form.pieces.length === 0 && (
                <p className="text-xs text-muted-foreground">No pieces defined.</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Live Preview */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Live Preview</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">W</Label>
                <Input
                  type="number"
                  value={previewW}
                  onChange={(e) => setPreviewW(parseFloat(e.target.value) || 0)}
                  className="w-24 text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">H</Label>
                <Input
                  type="number"
                  value={previewH}
                  onChange={(e) => setPreviewH(parseFloat(e.target.value) || 0)}
                  className="w-24 text-xs"
                />
              </div>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-7 text-xs">Label</TableHead>
                    <TableHead className="h-7 text-xs">Profile</TableHead>
                    <TableHead className="h-7 text-xs text-right">Length</TableHead>
                    <TableHead className="h-7 text-xs text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewPieces.pieces.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs py-1.5">{p.label}</TableCell>
                      <TableCell className="text-xs py-1.5">{p.profileType}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-mono">{p.length}</TableCell>
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
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Error */}
          {saveError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <HugeiconsIcon icon={AlertCircleIcon} size={14} />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isBuiltin ? (
            <>
              <Button variant="outline" onClick={handleDuplicate} disabled={duplicateMutation.isPending}>
                <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1.5" />
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
              >
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} className="mr-1.5" />
                {isCreating ? "Create" : "Save"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
