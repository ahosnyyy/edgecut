import { useState } from "react";
import {
  useApartmentTemplates,
  useApartmentTemplate,
  useCreateApartmentTemplate,
  useUpdateApartmentTemplate,
  useDeleteApartmentTemplate,
  type ApartmentTemplateDetail,
} from "../hooks/useApartmentTemplates";
import { useTemplates } from "../hooks/useTemplates";
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
  Add01Icon,
  Delete01Icon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  Home01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useHeaderAction } from "../components/layout/header-actions";

interface OpeningRow {
  id: string;
  label: string;
  pieceTemplateId: string;
}

function emptyApartmentTemplate() {
  return {
    name: "",
    description: "",
    openings: [] as OpeningRow[],
  };
}

function templateFromDetail(detail: ApartmentTemplateDetail) {
  return {
    name: detail.name,
    description: detail.description ?? "",
    openings: detail.openings
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((o) => ({
        id: o.id,
        label: o.label,
        pieceTemplateId: o.pieceTemplateId,
      })),
  };
}

export default function ApartmentTemplateManager() {
  const { data: templates, isLoading } = useApartmentTemplates();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: editingDetail } = useApartmentTemplate(editingId);

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

  useHeaderAction("apt-template-new", (
    <Button className="gap-1.5" onClick={handleNew}>
      <HugeiconsIcon icon={Add01Icon} size={14} />
      New Apartment Type
    </Button>
  ));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Loading apartment types...
            </div>
          ) : templates?.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No apartment types yet. Click "New Apartment Type" to create one.
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
                        {tpl.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {tpl.description}
                          </p>
                        )}
                      </div>
                      <HugeiconsIcon
                        icon={Home01Icon}
                        size={16}
                        className="text-muted-foreground shrink-0"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {(editingId || isCreating) && (
        <ApartmentTemplateEditor
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
            <AlertDialogTitle>Delete apartment type?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the apartment type and all its opening definitions.
              Projects using this type will lose their assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <DeleteAptAction deleteId={deleteId} onDone={() => setDeleteId(null)} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeleteAptAction({
  deleteId,
  onDone,
}: {
  deleteId: string | null;
  onDone: () => void;
}) {
  const deleteMutation = useDeleteApartmentTemplate();
  return (
    <AlertDialogAction
      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      onClick={async () => {
        if (!deleteId) return;
        try {
          await deleteMutation.mutateAsync(deleteId);
          onDone();
        } catch {
          // handled by mutation
        }
      }}
    >
      Delete
    </AlertDialogAction>
  );
}

interface EditorProps {
  templateId: string | null;
  detail: ApartmentTemplateDetail | null;
  isCreating: boolean;
  onClose: () => void;
}

function ApartmentTemplateEditor({
  templateId,
  detail,
  isCreating,
  onClose,
}: EditorProps) {
  const createMutation = useCreateApartmentTemplate();
  const updateMutation = useUpdateApartmentTemplate();
  const { data: pieceTemplates } = useTemplates();

  const [form, setForm] = useState(() => {
    if (detail) return templateFromDetail(detail);
    return emptyApartmentTemplate();
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  const isLoadingDetail = !!templateId && !detail;

  const handleSave = async () => {
    setSaveError(null);
    if (!form.name.trim()) {
      setSaveError("Name is required");
      return;
    }
    if (form.openings.some((o) => !o.label.trim() || !o.pieceTemplateId)) {
      setSaveError("All openings need a label and a piece template");
      return;
    }
    try {
      const payload = {
        name: form.name,
        description: form.description,
        openings: form.openings.map((o) => ({
          label: o.label,
          pieceTemplateId: o.pieceTemplateId,
        })),
      };
      if (isCreating || !templateId) {
        await createMutation.mutateAsync(payload);
      } else {
        await updateMutation.mutateAsync({ id: templateId, data: payload });
      }
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const addOpening = () => {
    setForm((f) => ({
      ...f,
      openings: [
        ...f.openings,
        { id: crypto.randomUUID(), label: "", pieceTemplateId: "" },
      ],
    }));
  };

  const updateOpening = (index: number, field: keyof OpeningRow, value: string) => {
    setForm((f) => ({
      ...f,
      openings: f.openings.map((o, i) =>
        i === index ? { ...o, [field]: value } : o,
      ),
    }));
  };

  const removeOpening = (index: number) => {
    setForm((f) => ({
      ...f,
      openings: f.openings.filter((_, i) => i !== index),
    }));
  };

  if (isLoadingDetail) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading apartment type...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? "New Apartment Type" : form.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apt-name">Name</Label>
              <Input
                id="apt-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 3BDR Standard"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apt-desc">Description</Label>
              <Input
                id="apt-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. 3 bedrooms, 1 bath, kitchen, balcony"
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Opening Instances</h3>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addOpening}>
                <HugeiconsIcon icon={Add01Icon} size={12} />
                Add Opening
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Each opening instance gets its own dimension grid in the project.
              Multiple instances can share the same piece template — they'll be
              optimized together automatically.
            </p>
            <div className="flex flex-col gap-2">
              {form.openings.map((o, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-end">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Label</Label>
                    <Input
                      value={o.label}
                      onChange={(e) => updateOpening(i, "label", e.target.value)}
                      placeholder="e.g. Master Bedroom Window"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Piece Template</Label>
                    <Select
                      value={o.pieceTemplateId}
                      onValueChange={(v: string | null) => updateOpening(i, "pieceTemplateId", v ?? "")}
                    >
                      <SelectTrigger className="text-xs h-7">
                        <SelectValue placeholder="Select template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pieceTemplates?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeOpening(i)}
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={14} />
                  </Button>
                </div>
              ))}
              {form.openings.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No openings defined. Click "Add Opening" to start.
                </p>
              )}
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <HugeiconsIcon icon={AlertCircleIcon} size={14} />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} className="mr-1.5" />
            {isCreating ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
