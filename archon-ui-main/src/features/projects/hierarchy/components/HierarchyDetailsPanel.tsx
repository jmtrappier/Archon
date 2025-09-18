import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, MapPinned, Pin } from "lucide-react";
import { Button } from "@/features/ui/primitives";
import { Badge } from "@/features/ui/primitives/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/features/ui/primitives/card";
import type { HierarchyViewMode } from "../hooks/useHierarchyData";
import type { HierarchyTreeNode } from "../../services/hierarchyService";
import { dependencyService } from "../../dependencies/services/dependencyService";
import type { Dependency } from "../../dependencies/types";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<HierarchyTreeNode["type"], string> = {
  project: "Project",
  epic: "Epic",
  story: "Story",
  task: "Task",
  subtask: "Subtask",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "Todo",
  doing: "In Progress",
  review: "In Review",
  waiting: "Waiting",
  done: "Done",
};

const STATUS_BADGE: Record<string, string> = {
  todo: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  doing: "bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  review: "bg-amber-200 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  waiting: "bg-rose-200 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  done: "bg-emerald-200 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  medium: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300",
  high: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
  critical: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
};

const mapNodeToDependencyType = (node: HierarchyTreeNode): "project" | "epic" | "story" | "task" | null => {
  if (node.type === "project") return "project";
  if (node.type === "epic") return "epic";
  if (node.type === "story") return "story";
  if (node.type === "task" || node.type === "subtask") return "task";
  return null;
};

interface HierarchyDetailsPanelProps {
  node?: HierarchyTreeNode;
  projectId: string;
  viewMode: HierarchyViewMode;
  onOpenKanban?: (node: HierarchyTreeNode) => void;
  onOpenDetails?: (node: HierarchyTreeNode) => void;
}

const useNodeDependencies = (node: HierarchyTreeNode | undefined, projectId: string) => {
  return useQuery({
    queryKey: node ? ["hierarchy", "dependencies", node.nodeId] : ["hierarchy", "dependencies", "none"],
    queryFn: async () => {
      if (!node) return [] as Dependency[];
      const type = mapNodeToDependencyType(node);
      if (!type) return [] as Dependency[];
      try {
        if (type === "project") {
          const { dependencies } = await dependencyService.getDependenciesByProject(projectId, {
            include_entities: true,
            limit: 10,
          });
          return dependencies;
        }
        const response = await dependencyService.getDependenciesForEntity(type, node.id, {
          include_entities: true,
          limit: 10,
        });
        return response.dependencies;
      } catch (err) {
        console.error(`Failed to load dependencies for ${type} ${node.id}:`, err);
        return [] as Dependency[];
      }
    },
    enabled: Boolean(node),
    staleTime: 15000,
    retry: false,
  });
};

export const HierarchyDetailsPanel: React.FC<HierarchyDetailsPanelProps> = ({
  node,
  projectId,
  viewMode,
  onOpenKanban,
  onOpenDetails,
}) => {
  const { data: dependencies = [], isLoading: isLoadingDependencies } = useNodeDependencies(node, projectId);

  const dependencySummary = useMemo(() => {
    const summary = { blocks: 0, depends_on: 0, related_to: 0 };
    dependencies.forEach((dependency) => {
      summary[dependency.dependency_type] = (summary[dependency.dependency_type] || 0) + 1;
    });
    return summary;
  }, [dependencies]);

  if (!node) {
    return (
      <Card className="border-dashed border-slate-200/70 bg-white/60 p-6 text-center text-sm text-slate-500 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-400">
        Select a node to view details
      </Card>
    );
  }

  const statusBadge = node.status ? STATUS_BADGE[node.status] ?? STATUS_BADGE.todo : undefined;
  const priorityBadge = node.priority ? PRIORITY_BADGE[node.priority] : undefined;

  return (
    <Card className="h-full border-slate-200/70 bg-white/80 shadow-md backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">{node.title}</CardTitle>
          <Badge className="uppercase text-[10px] tracking-wide text-slate-500">{TYPE_LABEL[node.type]}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {node.status && <Badge className={cn("capitalize", statusBadge)}>{STATUS_LABEL[node.status] ?? node.status}</Badge>}
          {node.priority && <Badge className={cn("capitalize", priorityBadge)}>{node.priority}</Badge>}
          {typeof node.progress === "number" && (
            <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Progress {Math.round(node.progress)}%
            </Badge>
          )}
          {node.mvpFlag && (
            <Badge className="bg-amber-200/60 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <Pin className="mr-1 h-3 w-3" /> MVP
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {node.description && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Description</h4>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{node.description}</p>
          </div>
        )}

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quick actions</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {onOpenDetails && (
              <Button variant="secondary" size="xs" onClick={() => onOpenDetails(node)}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> Open details
              </Button>
            )}
            {onOpenKanban && node.type !== "subtask" && (
              <Button size="xs" onClick={() => onOpenKanban(node)}>
                <MapPinned className="mr-2 h-3.5 w-3.5" />
                {node.type === "epic" ? "Kanban Stories" : node.type === "story" ? "Kanban Tasks" : "Open in Kanban"}
              </Button>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <li>Children: {node.children?.length ?? 0}</li>
            {node.assignee && <li>Assignee: {node.assignee}</li>}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dependencies</h4>
          {isLoadingDependencies ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading dependencies…
            </div>
          ) : dependencies.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No dependencies registered.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Badge className="bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">Blocks {dependencySummary.blocks ?? 0}</Badge>
                <Badge className="bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300">Depends on {dependencySummary.depends_on ?? 0}</Badge>
                <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Related {dependencySummary.related_to ?? 0}</Badge>
              </div>
              <ul className="space-y-2">
                {dependencies.slice(0, 5).map((dependency) => (
                  <li key={dependency.id} className="rounded-lg border border-slate-200/70 bg-white/80 p-2 text-xs text-slate-600 dark:border-slate-800/60 dark:bg-slate-900/50 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{dependency.dependency_type.replace("_", " ")}</span>
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">{dependency.status}</span>
                    </div>
                    {dependency.related_entity && (
                      <p className="mt-1 truncate text-slate-500">
                        {dependency.related_entity.title}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {viewMode === "dependencies" && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dependency view is in early access. Story 4.22 will enhance the visual graph and interactions.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
