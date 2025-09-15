/**
 * SubtaskEditModal - Specialized modal for creating and editing subtasks
 *
 * Features:
 * - Dedicated subtask creation/editing with parent_task_id handling
 * - Clean form validation and error handling
 * - Integration with useCreateSubtask and useUpdateTask hooks
 * - Simplified interface focused on subtask-specific needs
 */

import { memo, useCallback, useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../../../ui/primitives";
import { useToast } from "../../../ui/hooks/useToast";

// Note: Using plain textarea as we need to import it separately
const Textarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={`flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);
import { useCreateSubtask, useUpdateTask } from "../hooks";
import type { Assignee, Task } from "../types";

export interface SubtaskEditModalProps {
  isOpen: boolean;
  parentTaskId: string;
  projectId: string;
  editingSubtask?: Task | null;
  onClose: () => void;
  onSaved?: () => void;
}

// Assignee options for subtasks
const ASSIGNEE_OPTIONS: Assignee[] = ["User", "Archon", "AI IDE Agent"];

export const SubtaskEditModal = memo<SubtaskEditModalProps>(
  ({ isOpen, parentTaskId, projectId, editingSubtask, onClose, onSaved }) => {
    const { showToast } = useToast();
    const [localSubtask, setLocalSubtask] = useState<Partial<Task> | null>(null);

    // Hooks for subtask operations
    const createSubtaskMutation = useCreateSubtask(parentTaskId);
    const updateTaskMutation = useUpdateTask(projectId);

    const isEditing = !!editingSubtask?.id;
    const isSaving = createSubtaskMutation.isPending || updateTaskMutation.isPending;

    // Sync local state with editingSubtask when it changes
    useEffect(() => {
      if (editingSubtask) {
        setLocalSubtask(editingSubtask);
      } else {
        // Reset for new subtask
        setLocalSubtask({
          title: "",
          description: "",
          status: "todo",
          assignee: "User" as Assignee,
          feature: "",
        });
      }
    }, [editingSubtask]);

    // Input change handlers
    const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalSubtask((prev) => (prev ? { ...prev, title: value } : null));
    }, []);

    const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setLocalSubtask((prev) => (prev ? { ...prev, description: value } : null));
    }, []);

    const handleStatusChange = useCallback((value: string) => {
      setLocalSubtask((prev) => (prev ? { ...prev, status: value as Task["status"] } : null));
    }, []);

    const handleAssigneeChange = useCallback((value: string) => {
      setLocalSubtask((prev) => (prev ? { ...prev, assignee: value as Assignee } : null));
    }, []);

    const handleFeatureChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalSubtask((prev) => (prev ? { ...prev, feature: value } : null));
    }, []);

    // Save handler
    const handleSave = useCallback(async () => {
      if (!localSubtask) {
        showToast("No subtask data provided", "error");
        return;
      }

      if (!localSubtask.title?.trim()) {
        showToast("Subtask title is required", "error");
        return;
      }

      try {
        if (isEditing && editingSubtask?.id) {
          // Update existing subtask
          await updateTaskMutation.mutateAsync({
            taskId: editingSubtask.id,
            updates: {
              title: localSubtask.title,
              description: localSubtask.description || "",
              status: localSubtask.status || "todo",
              assignee: localSubtask.assignee || "User",
              feature: localSubtask.feature || "",
            },
          });
        } else {
          // Create new subtask
          await createSubtaskMutation.mutateAsync({
            project_id: projectId,
            title: localSubtask.title,
            description: localSubtask.description || "",
            status: localSubtask.status || "todo",
            assignee: localSubtask.assignee || "User",
            feature: localSubtask.feature || "",
            task_order: 100, // Default order for new subtasks
          });
        }

        onSaved?.();
        onClose();
      } catch (error) {
        console.error("Failed to save subtask:", error);
        // Error toast is handled by the mutation hooks
      }
    }, [
      localSubtask,
      isEditing,
      editingSubtask?.id,
      projectId,
      createSubtaskMutation,
      updateTaskMutation,
      onSaved,
      onClose,
      showToast,
    ]);

    const handleClose = useCallback(() => {
      onClose();
    }, [onClose]);

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Subtask" : "Add Subtask"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title Field */}
            <FormField>
              <Label required>Title</Label>
              <Input
                value={localSubtask?.title || ""}
                onChange={handleTitleChange}
                placeholder="Enter subtask title..."
                disabled={isSaving}
                autoFocus
              />
            </FormField>

            {/* Description Field */}
            <FormField>
              <Label>Description</Label>
              <Textarea
                value={localSubtask?.description || ""}
                onChange={handleDescriptionChange}
                placeholder="Enter subtask description..."
                disabled={isSaving}
                rows={3}
              />
            </FormField>

            {/* Status Field */}
            <FormField>
              <Label>Status</Label>
              <Select value={localSubtask?.status || "todo"} onValueChange={handleStatusChange}>
                <SelectTrigger disabled={isSaving}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="doing">Doing</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {/* Assignee Field */}
            <FormField>
              <Label>Assignee</Label>
              <Select value={localSubtask?.assignee || "User"} onValueChange={handleAssigneeChange}>
                <SelectTrigger disabled={isSaving}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNEE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Feature Field */}
            <FormField>
              <Label>Feature Tag</Label>
              <Input
                value={localSubtask?.feature || ""}
                onChange={handleFeatureChange}
                placeholder="Enter feature tag (optional)..."
                disabled={isSaving}
              />
            </FormField>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : isEditing ? "Update Subtask" : "Create Subtask"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  },
);

SubtaskEditModal.displayName = "SubtaskEditModal";