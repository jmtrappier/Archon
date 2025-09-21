import { useQueryClient } from "@tanstack/react-query";
import { Edit3, Save, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/features/ui/primitives";
import { useUpdateEpic } from "../../epics/hooks/useEpicQueries";
import type { HierarchyTreeNode } from "../../services/hierarchyService";
import { invalidateETagCache } from "../../shared/apiWithEtag";
import type { Assignee, HierarchyStatus, Priority } from "../../shared/types";
import type { UpdateEpicRequest, UpdateStoryRequest, UpdateTaskRequest } from "../../shared/types/hierarchy";
import { useUpdateStory } from "../../stories/hooks/useStoryQueries";
import { useUpdateTask } from "../../tasks/hooks/useTaskQueries";
import { hierarchyQueryKeys } from "../hooks/useHierarchyData";
import type { HierarchyUpdatePayload } from "../utils/updateHierarchyCache";
import { updateHierarchyQueryCache } from "../utils/updateHierarchyCache";

const TYPE_LABEL: Record<HierarchyTreeNode["type"], string> = {
  project: "Projet",
  epic: "Epic",
  story: "Story",
  task: "Tâche",
  subtask: "Sous-tâche",
};

const STATUS_OPTIONS: Array<{ value: HierarchyStatus; label: string }> = [
  { value: "todo", label: "À faire" },
  { value: "doing", label: "En cours" },
  { value: "review", label: "En révision" },
  { value: "waiting", label: "En attente" },
  { value: "done", label: "Terminé" },
];

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: "low", label: "Basse" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
  { value: "critical", label: "Critique" },
];

interface NodeDetailsModalProps {
  node: HierarchyTreeNode;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  mode?: "view" | "edit";
}

type NodeFormState = {
  title: string;
  description: string;
  status: HierarchyStatus;
  priority: Priority;
  assignee: Assignee | "";
};

const ALLOWED_ASSIGNEES: Assignee[] = ["User", "Archon", "AI IDE Agent"];

const normalizeAssignee = (value: string | undefined): Assignee | "" => {
  if (!value) {
    return "";
  }
  return ALLOWED_ASSIGNEES.includes(value as Assignee) ? (value as Assignee) : "";
};

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({
  node,
  projectId,
  isOpen,
  onClose,
  mode: initialMode = "view",
}) => {
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [formData, setFormData] = useState<NodeFormState>({
    title: node.title || "",
    description: node.description || "",
    status: (node.status as HierarchyStatus) || "todo",
    priority: (node.priority as Priority) || "medium",
    assignee: normalizeAssignee(node.assignee as string | undefined),
  });

  const queryClient = useQueryClient();
  const storyEpicId = node.type === "story" ? (node.parentId ?? "") : "";
  const isTaskLike = node.type === "task" || node.type === "subtask";
  const baseFieldId = useId();
  const titleFieldId = `${baseFieldId}-title`;
  const descriptionFieldId = `${baseFieldId}-description`;
  const assigneeFieldId = `${baseFieldId}-assignee`;

  // Mutations for different node types
  const updateTaskMutation = useUpdateTask(projectId);
  const updateStoryMutation = useUpdateStory(storyEpicId);
  const updateEpicMutation = useUpdateEpic(projectId);

  // Reset form data when node changes
  useEffect(() => {
    setMode(initialMode);
    setFormData({
      title: node.title || "",
      description: node.description || "",
      status: (node.status as HierarchyStatus) || "todo",
      priority: (node.priority as Priority) || "medium",
      assignee: normalizeAssignee(node.assignee as string | undefined),
    });
  }, [initialMode, node]);

  // Helper to invalidate hierarchy cache
  const invalidateHierarchy = () => {
    queryClient.invalidateQueries({ queryKey: hierarchyQueryKeys.all });
    invalidateETagCache(`/api/projects/${projectId}/hierarchy`);
    invalidateETagCache(`/api/projects/${projectId}/hierarchy?include_tasks=true`);
  };

  const handleSave = async () => {
    if (!node) return;

    const trimmedTitle = formData.title.trim();
    const trimmedDescription = formData.description.trim();
    const statusValue = mode === "edit" && node.type !== "epic" ? formData.status : undefined;
    const priorityValue = mode === "edit" && node.type !== "epic" ? formData.priority : undefined;
    const assigneeValue = isTaskLike && formData.assignee ? formData.assignee : undefined;

    try {
      switch (node.type) {
        case "task":
        case "subtask":
          {
            const taskUpdates: Partial<UpdateTaskRequest> = {};
            if (trimmedTitle && trimmedTitle !== node.title) {
              taskUpdates.title = trimmedTitle;
            }
            if (trimmedDescription !== (node.description ?? "")) {
              taskUpdates.description = trimmedDescription;
            }
            if (statusValue && statusValue !== node.status) {
              taskUpdates.status = statusValue;
            }
            if (priorityValue && priorityValue !== node.priority) {
              taskUpdates.priority = priorityValue;
            }
            if (assigneeValue && assigneeValue !== node.assignee) {
              taskUpdates.assignee = assigneeValue;
            }

            if (Object.keys(taskUpdates).length === 0) {
              setMode("view");
              return;
            }

            await updateTaskMutation.mutateAsync({
              taskId: node.id,
              updates: taskUpdates as UpdateTaskRequest,
            });
            updateHierarchyQueryCache(queryClient, projectId, node, taskUpdates as HierarchyUpdatePayload);
          }
          break;
        case "story":
          {
            const storyUpdates: Partial<UpdateStoryRequest> = {};
            if (trimmedTitle && trimmedTitle !== node.title) {
              storyUpdates.title = trimmedTitle;
            }
            if (trimmedDescription !== (node.description ?? "")) {
              storyUpdates.description = trimmedDescription;
            }
            if (statusValue && statusValue !== node.status) {
              storyUpdates.status = statusValue;
            }
            if (priorityValue && priorityValue !== node.priority) {
              storyUpdates.priority = priorityValue;
            }

            if (Object.keys(storyUpdates).length === 0) {
              setMode("view");
              return;
            }

            await updateStoryMutation.mutateAsync({
              storyId: node.id,
              updates: storyUpdates as UpdateStoryRequest,
            });
            updateHierarchyQueryCache(queryClient, projectId, node, storyUpdates as HierarchyUpdatePayload);
          }
          break;
        case "epic":
          // Only update description and title for epics (API limitation)
          {
            const epicUpdates: Partial<UpdateEpicRequest> = {};
            if (trimmedTitle && trimmedTitle !== node.title) {
              epicUpdates.title = trimmedTitle;
            }
            if (trimmedDescription !== (node.description ?? "")) {
              epicUpdates.description = trimmedDescription;
            }

            if (Object.keys(epicUpdates).length === 0) {
              setMode("view");
              return;
            }

            await updateEpicMutation.mutateAsync({
              epicId: node.id,
              updates: epicUpdates as UpdateEpicRequest,
            });
            updateHierarchyQueryCache(queryClient, projectId, node, epicUpdates as HierarchyUpdatePayload);
          }
          break;
      }

      invalidateHierarchy();
      setMode("view");
    } catch (error) {
      console.error("❌ Error updating node:", error);
    }
  };

  const isUpdating = updateTaskMutation.isPending || updateStoryMutation.isPending || updateEpicMutation.isPending;

  // Check if Epic (limited editing)
  const isEpic = node.type === "epic";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl font-semibold">{formData.title}</CardTitle>
            <Badge className="uppercase text-xs">{TYPE_LABEL[node.type]}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {mode === "view" && !isEpic && (
              <Button variant="outline" size="sm" onClick={() => setMode("edit")} className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                Éditer
              </Button>
            )}
            {mode === "edit" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setMode("view")} disabled={isUpdating}>
                  Annuler
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isUpdating} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {isUpdating ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="p-2">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor={titleFieldId} className="text-sm font-medium">
              Titre
            </Label>
            {mode === "edit" ? (
              <Input
                id={titleFieldId}
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full"
                disabled={isUpdating}
              />
            ) : (
              <p className="text-sm p-3 bg-slate-50 dark:bg-slate-800 rounded-md">{formData.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor={descriptionFieldId} className="text-sm font-medium">
              Description
            </Label>
            {mode === "edit" ? (
              <Textarea
                id={descriptionFieldId}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Ajouter une description..."
                className="w-full min-h-[120px] resize-y"
                disabled={isUpdating}
              />
            ) : (
              <div className="text-sm p-3 bg-slate-50 dark:bg-slate-800 rounded-md min-h-[120px] whitespace-pre-wrap">
                {formData.description || "Aucune description"}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium">
              Statut
            </Label>
            {mode === "edit" && !isEpic ? (
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as HierarchyStatus }))}
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                {STATUS_OPTIONS.find((opt) => opt.value === formData.status)?.label || formData.status}
                {isEpic && " (lecture seule)"}
              </p>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority" className="text-sm font-medium">
              Priorité
            </Label>
            {mode === "edit" && !isEpic ? (
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value as Priority }))}
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                {PRIORITY_OPTIONS.find((opt) => opt.value === formData.priority)?.label || formData.priority}
                {isEpic && " (lecture seule)"}
              </p>
            )}
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label htmlFor={assigneeFieldId} className="text-sm font-medium">
              Assigné à
            </Label>
            {mode === "edit" && !isEpic ? (
              <Input
                id={assigneeFieldId}
                value={formData.assignee}
                onChange={(e) => setFormData((prev) => ({ ...prev, assignee: e.target.value }))}
                placeholder="Nom de l'assigné"
                className="w-full"
                disabled={isUpdating}
              />
            ) : (
              <p className="text-sm p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                {formData.assignee || "Non assigné"}
                {isEpic && formData.assignee && " (lecture seule)"}
              </p>
            )}
          </div>

          {/* Additional Information */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Informations supplémentaires</Label>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                <span className="font-medium">Enfants:</span> {node.children?.length || 0}
              </div>
              {typeof node.progress === "number" && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                  <span className="font-medium">Progression:</span> {Math.round(node.progress)}%
                </div>
              )}
              {node.mvpFlag && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md text-amber-800 dark:text-amber-200">
                  <span className="font-medium">🎯 MVP</span>
                </div>
              )}
            </div>
          </div>

          {isEpic && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> L'édition des épics est limitée (titre et description seulement) en raison des
                limitations de l'API.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
