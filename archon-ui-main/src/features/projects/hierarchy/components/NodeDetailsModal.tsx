import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Save, Edit3, Eye } from "lucide-react";
import { Button, Badge, Card, CardContent, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, Input, Label } from "@/features/ui/primitives";
import type { HierarchyTreeNode } from "../../services/hierarchyService";
import type { Priority, Assignee, HierarchyStatus } from "../../shared/types";
import { useUpdateTask } from "../../tasks/hooks/useTaskQueries";
import { useUpdateStory } from "../../stories/hooks/useStoryQueries";
import { useUpdateEpic } from "../../epics/hooks/useEpicQueries";
import { hierarchyQueryKeys } from "../hooks/useHierarchyData";
import { cn } from "@/lib/utils";

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

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({
  node,
  projectId,
  isOpen,
  onClose,
  mode: initialMode = "view",
}) => {
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [formData, setFormData] = useState({
    title: node.title || "",
    description: node.description || "",
    status: node.status || "todo",
    priority: node.priority || "medium",
    assignee: node.assignee || "",
  });

  const queryClient = useQueryClient();

  // Mutations for different node types
  const updateTaskMutation = useUpdateTask(projectId);
  const updateStoryMutation = useUpdateStory("");
  const updateEpicMutation = useUpdateEpic(projectId);

  // Reset form data when node changes
  useEffect(() => {
    setFormData({
      title: node.title || "",
      description: node.description || "",
      status: node.status || "todo",
      priority: node.priority || "medium",
      assignee: node.assignee || "",
    });
  }, [node]);

  // Helper to invalidate hierarchy cache
  const invalidateHierarchy = () => {
    queryClient.invalidateQueries({ queryKey: hierarchyQueryKeys.all });
    queryClient.invalidateQueries({ queryKey: hierarchyQueryKeys.detail(projectId, false, true) });
    queryClient.invalidateQueries({ queryKey: hierarchyQueryKeys.tree(projectId) });
  };

  const handleSave = async () => {
    if (!node) return;

    const updates = {
      title: formData.title,
      description: formData.description,
      status: formData.status,
      priority: formData.priority,
      assignee: formData.assignee,
    };

    try {
      switch (node.type) {
        case "task":
        case "subtask":
          await updateTaskMutation.mutateAsync({
            taskId: node.id,
            updates,
          });
          break;
        case "story":
          await updateStoryMutation.mutateAsync({
            storyId: node.id,
            updates,
          });
          break;
        case "epic":
          // Only update description and title for epics (API limitation)
          await updateEpicMutation.mutateAsync({
            epicId: node.id,
            updates: {
              title: formData.title,
              description: formData.description,
            },
          });
          break;
      }

      invalidateHierarchy();
      setMode("view");
      console.log("✅ Node updated successfully:", updates);
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("edit")}
                className="flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Éditer
              </Button>
            )}
            {mode === "edit" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMode("view")}
                  disabled={isUpdating}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isUpdating ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Titre
            </Label>
            {mode === "edit" ? (
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full"
                disabled={isUpdating}
              />
            ) : (
              <p className="text-sm p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                {formData.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            {mode === "edit" ? (
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as HierarchyStatus }))}
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
                {STATUS_OPTIONS.find(opt => opt.value === formData.status)?.label || formData.status}
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
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as Priority }))}
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
                {PRIORITY_OPTIONS.find(opt => opt.value === formData.priority)?.label || formData.priority}
                {isEpic && " (lecture seule)"}
              </p>
            )}
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label htmlFor="assignee" className="text-sm font-medium">
              Assigné à
            </Label>
            {mode === "edit" && !isEpic ? (
              <Input
                id="assignee"
                value={formData.assignee}
                onChange={(e) => setFormData(prev => ({ ...prev, assignee: e.target.value }))}
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
                <strong>Note:</strong> L'édition des épics est limitée (titre et description seulement) en raison des limitations de l'API.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};