import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, MapPinned, Pin, Eye, Edit3, Save, X } from "lucide-react";
import { Button } from "@/features/ui/primitives";
import { Badge } from "@/features/ui/primitives/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/features/ui/primitives/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/ui/primitives/select";
import type { HierarchyViewMode } from "../hooks/useHierarchyData";
import type { HierarchyTreeNode } from "../../services/hierarchyService";
import { dependencyService } from "../../dependencies/services/dependencyService";
import type { Dependency } from "../../dependencies/types";
import { cn } from "@/lib/utils";
import { NodeDetailsModal } from "./NodeDetailsModal";
import { useUpdateTask } from "../../tasks/hooks/useTaskQueries";
import { useUpdateStory } from "../../stories/hooks/useStoryQueries";
import { useUpdateEpic } from "../../epics/hooks/useEpicQueries";
// import { toast } from "sonner"; // Temporarily disabled

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

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUS_OPTIONS = [
  { value: "todo", label: "Todo" },
  { value: "doing", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
];

const ASSIGNEE_OPTIONS = [
  { value: "User", label: "User" },
  { value: "Archon", label: "Archon" },
  { value: "AI IDE Agent", label: "AI IDE Agent" },
];

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  // Initialize editing fields based on current node
  const [editingFields, setEditingFields] = useState(() => ({
    status: node?.status || "todo",
    priority: node?.priority || "medium",
    assignee: (node as any)?.assignee || "User",
  }));

  // Update hooks for different node types
  const updateTaskMutation = useUpdateTask(projectId);
  const updateStoryMutation = useUpdateStory("");
  const updateEpicMutation = useUpdateEpic(projectId);

  // Update editing fields when node changes, but only if not currently editing
  React.useEffect(() => {
    if (node && !isEditingInline) {
      setEditingFields({
        status: node.status || "todo",
        priority: node.priority || "medium",
        assignee: (node as any)?.assignee || "User",
      });
    }
  }, [node, isEditingInline]);

  const handleInlineUpdate = React.useCallback(async (field: string, value: string) => {
    if (!node) return;

    const updates: any = {
      [field]: value,
    };

    try {
      if (node.type === "task" || node.type === "subtask") {
        await updateTaskMutation.mutateAsync({
          taskId: node.id,
          updates,
        });
        console.log(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`);
      } else if (node.type === "story") {
        await updateStoryMutation.mutateAsync({
          storyId: node.id,
          updates,
        });
        console.log(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`);
      } else if (node.type === "epic") {
        await updateEpicMutation.mutateAsync({
          epicId: node.id,
          updates,
        });
        console.log(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`);
      }
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
      console.error(`Failed to update ${field}`);
      // Reset to original value on error
      setEditingFields(prev => ({
        ...prev,
        [field]: node[field as keyof typeof node] || prev[field as keyof typeof prev],
      }));
    }
  }, [node, updateTaskMutation, updateStoryMutation, updateEpicMutation]);

  // Use ref to store timeout IDs for debouncing
  const timeoutRefs = React.useRef<Record<string, NodeJS.Timeout>>({});

  // Handle field changes with immediate UI update and debounced backend update
  const handleFieldChange = React.useCallback((field: string, value: string) => {
    // Immediately update the UI state
    setEditingFields(prev => ({ ...prev, [field]: value }));

    // Clear any existing timeout for this field
    if (timeoutRefs.current[field]) {
      clearTimeout(timeoutRefs.current[field]);
    }

    // Debounce the backend update to prevent rapid-fire API calls
    timeoutRefs.current[field] = setTimeout(() => {
      handleInlineUpdate(field, value);
      delete timeoutRefs.current[field];
    }, 500);
  }, [handleInlineUpdate]);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout);
    };
  }, []);

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
    <>
      <Card className="h-full border-slate-200/70 bg-white/80 shadow-md backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">{node.title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge className="uppercase text-[10px] tracking-wide text-slate-500">{TYPE_LABEL[node.type]}</Badge>
              {!isEditingInline && node.type !== "project" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingInline(true)}
                  className="h-6 w-6 p-0"
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
              )}
              {isEditingInline && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingInline(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {/* Status field - editable inline */}
            {node.status && !isEditingInline && (
              <Badge className={cn("capitalize", statusBadge ?? "bg-slate-100 text-slate-600")}>
                {node.status}
              </Badge>
            )}
            {node.status && isEditingInline && (
              <Select
                value={editingFields.status}
                onValueChange={(value) => handleFieldChange("status", value)}
              >
                <SelectTrigger className="h-6 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Priority field - editable inline */}
            {node.priority && !isEditingInline && (
              <Badge className={cn("capitalize", priorityBadge ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>
                {node.priority}
              </Badge>
            )}
            {node.priority && isEditingInline && (
              <Select
                value={editingFields.priority}
                onValueChange={(value) => handleFieldChange("priority", value)}
              >
                <SelectTrigger className="h-6 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Assignee field - editable inline for tasks/subtasks */}
            {(node.type === "task" || node.type === "subtask") && !isEditingInline && (node as any).assignee && (
              <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {(node as any).assignee}
              </Badge>
            )}
            {(node.type === "task" || node.type === "subtask") && isEditingInline && (
              <Select
                value={editingFields.assignee}
                onValueChange={(value) => handleFieldChange("assignee", value)}
              >
                <SelectTrigger className="h-6 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNEE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Non-editable fields */}
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
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Description</h4>
            <div className="mt-1 p-3 text-sm bg-slate-50 dark:bg-slate-800 rounded-md min-h-[60px] whitespace-pre-wrap">
              {node.description || "Aucune description"}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Voir les détails
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {node && (
        <NodeDetailsModal
          node={node}
          projectId={projectId}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          mode="view"
        />
      )}
    </>
  );
};
