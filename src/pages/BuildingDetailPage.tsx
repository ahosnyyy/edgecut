import { useParams, useNavigate } from "react-router-dom";
import { useProject, useUpdateBuilding, useDeleteBuilding } from "../hooks/useProjects";
import { useApartmentTemplates } from "../hooks/useApartmentTemplates";
import { BuildingDetail, type BuildingLike } from "./ProjectBuilder";
import { ScrollArea } from "../components/ui/scroll-area";
import { LoadingState } from "../components/ui/loading-states";

export default function BuildingDetailPage() {
  const { id, buildingId } = useParams<{ id: string; buildingId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id ?? null);
  const { data: aptTemplates, isLoading: aptTemplatesLoading } = useApartmentTemplates();
  const updateBuildingMutation = useUpdateBuilding();
  const deleteBuildingMutation = useDeleteBuilding();

  if (isLoading || aptTemplatesLoading) {
    return (
      <LoadingState label="Loading building..." className="h-full" />
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
  const buildingIndex = buildings.findIndex((b) => b.id === buildingId);
  const building = buildings[buildingIndex] ?? null;

  if (!building) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Building not found</p>
      </div>
    );
  }

  const aptTemplateNames =
    aptTemplates?.reduce((acc, t) => {
      acc[t.id] = t.name;
      return acc;
    }, {} as Record<string, string>) ?? {};

  const goNext = () => {
    const next = buildings[buildingIndex + 1];
    if (next) navigate(`/projects/${id}/buildings/${next.id}`);
  };

  const goPrev = () => {
    const prev = buildings[buildingIndex - 1];
    if (prev) navigate(`/projects/${id}/buildings/${prev.id}`);
  };

  return (
    <ScrollArea className="h-full">
      <div className="px-4 py-3">
        <BuildingDetail
          building={building as BuildingLike}
          projectId={id!}
          aptTemplates={aptTemplates ?? []}
          projectProfileSystems={project.profileSystem ?? []}
          existingAssignments={project.assignments.filter((a) => a.buildingId === building.id)}
          existingSizes={project.openingSizes.filter((s) => s.buildingId === building.id)}
          aptTemplateNames={aptTemplateNames}
          onNext={goNext}
          onPrev={goPrev}
          hasNext={buildingIndex < buildings.length - 1}
          hasPrev={buildingIndex > 0}
          onUpdateBuilding={updateBuildingMutation.mutateAsync}
          onDeleteBuilding={async (args) => {
            await deleteBuildingMutation.mutateAsync(args);
            navigate(`/projects/${id}`);
          }}
          canDelete={buildings.length > 1}
          isDeletingBuilding={deleteBuildingMutation.isPending}
        />
      </div>
    </ScrollArea>
  );
}
