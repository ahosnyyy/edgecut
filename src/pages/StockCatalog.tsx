import { useState, useMemo } from "react";
import {
  useStockCatalog,
  useAddStockCatalogEntry,
  useUpdateStockCatalogEntry,
  useDeleteStockCatalogEntry,
  type StockCatalogEntry,
} from "../hooks/useProjects";
import { Button } from "../components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  AddSquareIcon,
  Delete02Icon,
  PencilEdit01Icon,
  PackageIcon,
  Search01Icon,
  FilterIcon,
} from "@hugeicons/core-free-icons";

const PROFILE_TYPE_LABELS: Record<string, string> = {
  frame: "Frame",
  sash: "Sash",
  mullion: "Mullion",
  bead: "Bead",
  custom: "Custom",
};

function profileTypeLabel(id: string): string {
  return PROFILE_TYPE_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export default function StockCatalog() {
  const { data: entries, isLoading } = useStockCatalog();
  const addMutation = useAddStockCatalogEntry();
  const updateMutation = useUpdateStockCatalogEntry();
  const deleteMutation = useDeleteStockCatalogEntry();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<StockCatalogEntry | null>(null);
  const [search, setSearch] = useState("");
  const [filterSystem, setFilterSystem] = useState<"all" | "manazil" | "premier">("all");

  const filtered = useMemo(() => {
    const list = entries ?? [];
    let result = list;
    if (filterSystem !== "all") {
      result = result.filter((d) => d.profileSystem === filterSystem);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          (d.label ?? "").toLowerCase().includes(q) ||
          d.profileType.toLowerCase().includes(q),
      );
    }
    return result;
  }, [entries, search, filterSystem]);

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Stock Catalog</h1>
          {entries && entries.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {entries.length}
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
              placeholder="Search catalog..."
              className="w-48 pl-7 text-xs"
            />
          </div>
          <Select
            value={filterSystem}
            onValueChange={(v) => setFilterSystem((v ?? "all") as "all" | "manazil" | "premier")}
          >
            <SelectTrigger className="w-32 h-8 text-xs gap-1.5">
              <HugeiconsIcon icon={FilterIcon} size={14} className="text-muted-foreground" />
              <SelectValue>
                {filterSystem === "all" ? "All" : filterSystem === "manazil" ? "Manazil" : "Premier"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Systems</SelectItem>
              <SelectItem value="manazil">Manazil</SelectItem>
              <SelectItem value="premier">Premier</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Loading stock catalog...
            </div>
          ) : filtered.length === 0 ? (
            search.trim() || filterSystem !== "all" ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={FilterIcon} />
                  </EmptyMedia>
                  <EmptyTitle>No catalog entries match your filters</EmptyTitle>
                  <EmptyDescription>
                    {search.trim()
                      ? `No results for "${search.trim()}".`
                      : `No entries with system "${filterSystem}".`}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilterSystem("all"); }}>
                    Clear filters
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={PackageIcon} />
                  </EmptyMedia>
                  <EmptyTitle>No stock catalog yet</EmptyTitle>
                  <EmptyDescription>
                    Define reusable stock entries for Manazil and Premier profile systems. Projects can pick from these when adding stock.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button className="gap-2" size="lg" onClick={() => setShowCreate(true)}>
                    <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
                    New Catalog Entry
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
                  <HugeiconsIcon icon={AddSquareIcon} size={20} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">New Entry</span>
                </div>
              </Card>
              {filtered.map((entry) => (
                <Card
                  key={entry.id}
                  size="sm"
                  className={`pb-0 transition-colors group`}
                >
                  <CardHeader className="pb-1">
                    <CardAction>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                          onClick={() => setEditing(entry)}
                        >
                          <HugeiconsIcon icon={PencilEdit01Icon} size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={13} />
                        </Button>
                      </div>
                    </CardAction>
                    <CardTitle className="text-sm truncate">
                      {entry.label || "Unnamed"}
                    </CardTitle>
                    <CardDescription className="text-xs truncate flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className={
                          "text-[9px] px-1 py-0 h-4 capitalize shrink-0 " +
                          (entry.profileSystem === "manazil"
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                            : "bg-orange-500/15 text-orange-700 dark:text-orange-400")
                        }
                      >
                        {entry.profileSystem}
                      </Badge>
                      <span className="truncate"> · {profileTypeLabel(entry.profileType)} · {entry.length} mm</span>
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="bg-muted/50 py-2.5">
                    <div className="flex items-center justify-between w-full gap-2 text-[10px] text-muted-foreground">
                      {entry.quantity === -1 ? (
                        <span>∞ unlimited</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const available = entry.quantity - entry.reservedQty - entry.usedQty;
                            const colorClass =
                              available <= 0
                                ? "text-red-600 dark:text-red-400"
                                : available <= Math.max(5, entry.quantity * 0.15)
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-emerald-600 dark:text-emerald-400";
                            return (
                              <>
                                <span className={colorClass + " font-medium"}>
                                  {available} avail
                                </span>
                                <Separator orientation="vertical" className="my-0.5" />
                                <span className="text-amber-600 dark:text-amber-400">
                                  {entry.reservedQty} reserved
                                </span>
                                <Separator orientation="vertical" className="my-0.5" />
                                <span className="text-blue-600 dark:text-blue-400">
                                  {entry.usedQty} used
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
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
                                    updateMutation.mutate({
                                      id: entry.id,
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
                                const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                const val = parseInt(input.value, 10);
                                if (!isNaN(val) && val !== 0) {
                                  updateMutation.mutate({
                                    id: entry.id,
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
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {(showCreate || editing) && (
        <StockCatalogDialog
          entry={editing}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          onSave={(data) => {
            if (editing) {
              updateMutation.mutate({ id: editing.id, data });
            } else {
              addMutation.mutate(data);
            }
            setShowCreate(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function StockCatalogDialog({
  entry,
  onClose,
  onSave,
}: {
  entry: StockCatalogEntry | null;
  onClose: () => void;
  onSave: (data: Omit<StockCatalogEntry, "id" | "reservedQty" | "usedQty">) => void;
}) {
  const [profileSystem, setProfileSystem] = useState<"manazil" | "premier">(entry?.profileSystem ?? "manazil");
  const [profileType, setProfileType] = useState(entry?.profileType ?? "");
  const [label, setLabel] = useState(entry?.label ?? "");
  const [length, setLength] = useState(entry?.length ?? 6000);
  const [quantity, setQuantity] = useState(entry?.quantity ?? -1);

  const handleSave = () => {
    onSave({
      profileSystem,
      profileType: profileType || "frame",
      color: "#000000",
      length,
      quantity,
      label: label.trim() || null,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Catalog Entry" : "New Catalog Entry"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Profile System</Label>
              <Select
                value={profileSystem}
                onValueChange={(v) => setProfileSystem((v ?? "manazil") as "manazil" | "premier")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {profileSystem === "manazil" ? "Manazil" : "Premier"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manazil">Manazil</SelectItem>
                  <SelectItem value="premier">Premier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Profile Type</Label>
              <Select value={profileType} onValueChange={(v) => setProfileType(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {profileType ? profileTypeLabel(profileType) : "Select..."}
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
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sd-label">Label</Label>
            <Input
              id="sd-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Standard 6m White"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sd-length">Length (mm)</Label>
              <Input
                id="sd-length"
                type="number"
                min={1}
                value={length}
                onChange={(e) => setLength(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sd-qty">Default Quantity</Label>
              <Input
                id="sd-qty"
                type="text"
                value={quantity === -1 ? "∞" : String(quantity)}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === "∞" || raw === "" || raw.toLowerCase() === "inf") {
                    setQuantity(-1);
                  } else {
                    const val = parseInt(raw, 10);
                    if (!isNaN(val) && val >= 0) setQuantity(val);
                  }
                }}
                placeholder="∞"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!label.trim()}>
            {entry ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
