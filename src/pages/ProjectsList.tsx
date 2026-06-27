import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects, useCreateProject } from "../hooks/useProjects";
import { Button } from "../components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
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
import { Add01Icon, AddSquareIcon, FolderOffIcon, Search01Icon, FilterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";

export default function ProjectsList() {
  const { data: projects, isLoading } = useProjects();
  const createMutation = useCreateProject();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const handleCreate = async () => {
    if (!name.trim()) return;
    const result = await createMutation.mutateAsync({
      name,
      client,
    });
    setShowCreate(false);
    setName("");
    setClient("");
    navigate(`/projects/${result.id}`);
  };

  const filtered = useMemo(() => {
    const list = projects ?? [];
    let result = list;
    if (filterStatus !== "all") {
      result = result.filter((p) => p.status === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.client ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [projects, search, filterStatus]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">All Projects</h1>
          {projects && projects.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {projects.length}
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
              placeholder="Search projects..."
              className="w-48 pl-7 text-xs"
            />
          </div>
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v ?? "all")}
          >
            <SelectTrigger className="w-32 h-8 text-xs gap-1.5">
              <HugeiconsIcon icon={FilterIcon} size={14} className="text-muted-foreground" />
              <SelectValue>
                {filterStatus === "all" ? "All Status" : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Loading projects...
            </div>
          ) : filtered.length === 0 ? (
            (search.trim() || filterStatus !== "all") ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={FilterIcon} />
                  </EmptyMedia>
                  <EmptyTitle>No projects match your filters</EmptyTitle>
                  <EmptyDescription>
                    {search.trim() && filterStatus !== "all"
                      ? `No projects match "${search.trim()}" with status "${filterStatus}".`
                      : search.trim()
                        ? `No projects match "${search.trim()}".`
                        : `No projects with status "${filterStatus}".`}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilterStatus("all"); }}>
                    Clear filters
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={FolderOffIcon} />
                  </EmptyMedia>
                  <EmptyTitle>No projects yet</EmptyTitle>
                  <EmptyDescription>You haven't created any projects yet. Get started by creating your first project.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button className="gap-2" size="lg" onClick={() => setShowCreate(true)}>
                    <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
                    New Project
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
                  <HugeiconsIcon icon={AddSquareIcon} size={20} className="text-muted-foreground"/>
                  <span className="text-sm text-muted-foreground">New Project</span>
                </div>
              </Card>
              {filtered.map((p) => (
                <Card
                  key={p.id}
                  size="sm"
                  className="cursor-pointer hover:border-primary/40 transition-colors pb-0"
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <CardHeader className="pb-1">
                    <CardAction>
                      <Badge
                        variant="secondary"
                        className={
                          "text-[10px] " +
                          (p.status === "active"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : p.status === "completed"
                              ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                              : p.status === "archived"
                                ? "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-400")
                        }
                      >
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </Badge>
                    </CardAction>
                    <CardTitle className="text-sm truncate">{p.name}</CardTitle>
                    {p.client && (
                      <CardDescription className="text-xs truncate">{p.client}</CardDescription>
                    )}
                  </CardHeader>
                  <CardFooter className="bg-muted/50 py-2.5">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{p.completedBuildings}/{p.buildingCount} building{p.buildingCount !== 1 ? "s" : ""} completed</span>
                      <Separator orientation="vertical" className="my-0.5" />
                      <span>Created {new Date(p.createdAt).toLocaleDateString("en-GB")}</span>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-name">Name</Label>
              <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside Development" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-client">Client</Label>
              <Input id="np-client" value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. ABC Developments" />
            </div>
            <p className="text-xs text-muted-foreground">A default building will be created automatically. You can add more buildings later.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending || !name.trim()}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
