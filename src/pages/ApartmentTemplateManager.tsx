import { useState, useMemo, useEffect } from "react";
import {
  useApartmentTemplates,
  useApartmentTemplate,
  useCreateApartmentTemplate,
  useUpdateApartmentTemplate,
  useDeleteApartmentTemplate,
  type ApartmentTemplateDetail,
} from "../hooks/useApartmentTemplates";
import { useTemplates } from "../hooks/useTemplates";
import { useProfileSystems } from "../hooks/useProfileSystems";
import { Button } from "../components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { ScrollArea } from "../components/ui/scroll-area";
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";
import { LoadingState, CardSkeletonGrid, DialogLoadingState } from "../components/ui/loading-states";
import { SaveButton, DeleteGuardDialog } from "../components/ui/action-buttons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  HousePlusIcon,
  Delete02Icon,
  PencilEdit01Icon,
  Search01Icon,
  FilterIcon,
  Home13Icon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";

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
  const { data: pieceTemplates } = useTemplates();
  const { data: profileSystemsList } = useProfileSystems();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const deleteMutation = useDeleteApartmentTemplate();
  const [search, setSearch] = useState("");
  const [filterOpenings, setFilterOpenings] = useState<string>("all");

  const { data: editingDetail } = useApartmentTemplate(editingId);

  // Map piece template id → profile system name for card badges
  const templateSystemMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of pieceTemplates ?? []) {
      if (t.profileSystemId) {
        const sys = profileSystemsList?.find((s) => s.id === t.profileSystemId);
        if (sys) map[t.id] = sys.name;
      }
    }
    return map;
  }, [pieceTemplates, profileSystemsList]);

  const openingFilterOptions = useMemo(() => {
    const counts = (templates ?? []).map((t) => t.openingCount);
    return [...new Set(counts)].sort((a, b) => a - b);
  }, [templates]);

  const filtered = useMemo(() => {
    const list = templates ?? [];
    let result = list;
    if (filterOpenings !== "all") {
      const min = parseInt(filterOpenings, 10);
      result = result.filter((t) => t.openingCount >= min);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }
    return result;
  }, [templates, search, filterOpenings]);

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <h1 className="text-lg font-semibold">Apartment Types</h1>
          {templates && templates.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {templates.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 md:flex-none md:w-48 min-w-[140px]">
            <HugeiconsIcon
              icon={Search01Icon}
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full pl-7 h-8 text-xs"
            />
          </div>
          <Select
            value={filterOpenings}
            onValueChange={(v) => setFilterOpenings(v ?? "all")}
          >
            <SelectTrigger className="w-36 h-8 text-xs gap-1.5 shrink-0">
              <HugeiconsIcon icon={FilterIcon} size={14} className="text-muted-foreground" />
              <SelectValue>
                {filterOpenings === "all"
                  ? "All Openings"
                  : `${filterOpenings} ${filterOpenings === "1" ? "opening" : "openings"}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {openingFilterOptions.map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count} {count === 1 ? "opening" : "openings"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <LoadingState label="Loading apartment types..." />
          ) : filtered.length === 0 ? (
            search.trim() || filterOpenings !== "all" ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={FilterIcon} />
                  </EmptyMedia>
                  <EmptyTitle>No apartment types match your filters</EmptyTitle>
                  <EmptyDescription>
                    {search.trim()
                      ? `No results for "${search.trim()}".`
                      : `No types with ${filterOpenings} ${filterOpenings === "1" ? "opening" : "openings"}.`}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilterOpenings("all"); }}>
                    Clear filters
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={Home13Icon} />
                  </EmptyMedia>
                  <EmptyTitle>No apartment types yet</EmptyTitle>
                  <EmptyDescription>
                    Define reusable apartment layouts with opening instances. Projects can assign these to floors and apartments.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button className="gap-2" size="lg" onClick={handleNew}>
                    <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
                    New Apartment Type
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
                  <HugeiconsIcon icon={HousePlusIcon} size={20} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">New Type</span>
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
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); handleEdit(tpl.id); }}
                        >
                          <HugeiconsIcon icon={PencilEdit01Icon} size={13} />
                        </Button>
                        <span onClick={(e) => e.stopPropagation()}>
                        <DeleteGuardDialog
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            >
                              <HugeiconsIcon icon={Delete02Icon} size={13} />
                            </Button>
                          }
                          usageCheckUrl={`/api/apartment-templates/${tpl.id}/usage`}
                          title="Delete this apartment template?"
                          description="This will permanently remove the apartment template and all its opening definitions."
                          entityName={tpl.name}
                          onConfirm={async () => {
                            await deleteMutation.mutateAsync(tpl.id);
                          }}
                          isPending={deleteMutation.isPending}
                        />
                        </span>
                      </div>
                    </CardAction>
                    <CardTitle className="text-sm truncate flex items-center gap-1.5">
                      {tpl.name}
                    </CardTitle>
                    <CardDescription className="text-xs truncate">
                      {tpl.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="bg-muted/50 py-2.5">
                    <div className="flex items-center justify-between w-full gap-2 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>{tpl.openingCount} {tpl.openingCount === 1 ? "opening" : "openings"}</span>
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
        <ApartmentTemplateEditor
          templateId={editingId}
          detail={editingDetail ?? null}
          isCreating={isCreating}
          onClose={handleClose}
        />
      )}

    </div>
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
  const { data: profileSystemsList } = useProfileSystems();

  const [form, setForm] = useState(() => {
    if (detail) return templateFromDetail(detail);
    return emptyApartmentTemplate();
  });

  useEffect(() => {
    if (detail) {
      setForm(templateFromDetail(detail));
    }
  }, [detail]);
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
        <DialogContent className="sm:max-w-xl">
          <DialogLoadingState label="Loading apartment type..." />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[75vh] min-h-[75vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreating ? "New Apartment Type" : form.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apt-name">Name <span className="text-red-500">*</span></Label>
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

          <Separator className="shrink-0" />

          <div className="flex flex-col gap-2 min-h-0 flex-1">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Openings</h3>
                {form.openings.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {form.openings.length}
                  </Badge>
                )}
              </div>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addOpening}>
                <HugeiconsIcon icon={Add01Icon} size={12} />
                Add
              </Button>
            </div>

            <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
              {form.openings.map((o, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground w-4 shrink-0 text-center font-medium">{i + 1}</span>
                    <Input
                      value={o.label}
                      onChange={(e) => updateOpening(i, "label", e.target.value)}
                      placeholder="Opening label"
                      className="text-xs h-7 border-0 bg-background flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={o.pieceTemplateId}
                      onValueChange={(v: string | null) => updateOpening(i, "pieceTemplateId", v ?? "")}
                    >
                      <SelectTrigger className="text-xs h-7 w-full sm:w-56 border-0 bg-background shrink-0">
                        <SelectValue placeholder="Template...">
                          {pieceTemplates?.find((t) => t.id === o.pieceTemplateId)?.name ?? "Template..."}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {pieceTemplates?.map((t) => {
                          const sysName = t.profileSystemId
                            ? profileSystemsList?.find((s) => s.id === t.profileSystemId)?.name
                            : null;
                          return (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="flex items-center gap-2">
                                {t.name}
                                {sysName && (
                                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0">
                                    {sysName}
                                  </Badge>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeOpening(i)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={12} />
                    </Button>
                  </div>
                </div>
              ))}
              {form.openings.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center">
                  <HugeiconsIcon icon={HousePlusIcon} size={20} className="text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">
                    No openings yet. Click "Add" to define one.
                  </p>
                </div>
              )}
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <HugeiconsIcon icon={AlertCircleIcon} size={13} />
              <span>{saveError}</span>
            </div>
          )}
        </div>

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
