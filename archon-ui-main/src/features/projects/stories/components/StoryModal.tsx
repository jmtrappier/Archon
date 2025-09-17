import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/features/ui/primitives/dialog";
import { Button, Input } from "@/features/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/features/ui/primitives/select";
import { useCreateStory, useUpdateStory } from "../hooks/useStoryQueries";
import { useProjectEpics } from "../../epics/hooks/useEpicQueries";
import { useToast } from "@/features/ui/hooks";
import type { Story, HierarchyStatus } from "../types";

interface StoryModalProps {
  isOpen: boolean;
  epicId?: string;
  projectId?: string;
  editingStory?: Story;
  onClose: () => void;
  onSaved: () => void;
}

// Priority mapping: string to integer for API
const PRIORITY_MAP = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const;

// Reverse mapping: integer to string for display
const PRIORITY_REVERSE_MAP = {
  1: "low",
  2: "medium",
  3: "high",
  4: "critical",
} as const;

export const StoryModal: React.FC<StoryModalProps> = ({
  isOpen,
  epicId,
  projectId,
  editingStory,
  onClose,
  onSaved,
}) => {
  const { showToast } = useToast();
  const [selectedEpicId, setSelectedEpicId] = useState(epicId || "");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "todo" as HierarchyStatus,
    priority: "medium" as const,
    mvp_flag: false,
  });

  // Fetch epics if we need epic selection
  const { data: epics = [] } = useProjectEpics(projectId || "", {
    enabled: !epicId && !!projectId
  });

  const createStoryMutation = useCreateStory(selectedEpicId || epicId || "");
  const updateStoryMutation = useUpdateStory(selectedEpicId || epicId || "");

  const isEditing = !!editingStory;
  const isSaving = createStoryMutation.isPending || updateStoryMutation.isPending;

  // Initialize form data when editing
  useEffect(() => {
    if (editingStory) {
      setSelectedEpicId(editingStory.epic_id || "");
      setFormData({
        title: editingStory.title || "",
        description: editingStory.description || "",
        status: editingStory.status || "todo",
        priority: typeof editingStory.priority === "number"
          ? PRIORITY_REVERSE_MAP[editingStory.priority as keyof typeof PRIORITY_REVERSE_MAP] || "medium"
          : editingStory.priority || "medium",
        mvp_flag: editingStory.mvp_flag || false,
      });
    } else {
      setSelectedEpicId(epicId || "");
      setFormData({
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        mvp_flag: false,
      });
    }
  }, [editingStory, epicId]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showToast("Story title is required", "error");
      return;
    }

    if (!epicId && !selectedEpicId) {
      showToast("Please select an EPIC", "error");
      return;
    }

    try {
      // Send priority as string - backend has conflicting validation rules
      // TODO: Backend needs to fix Pydantic schema vs custom validation mismatch
      if (isEditing && editingStory) {
        await updateStoryMutation.mutateAsync({
          storyId: editingStory.id,
          updates: formData,
        });
        showToast("Story updated successfully!", "success");
      } else {
        await createStoryMutation.mutateAsync(formData);
        showToast("Story created successfully!", "success");
      }

      onSaved();
    } catch (error) {
      showToast(
        `Failed to ${isEditing ? "update" : "create"} story. Please try again.`,
        "error"
      );
    }
  }, [formData, isEditing, editingStory, updateStoryMutation, createStoryMutation, showToast, onSaved, epicId, selectedEpicId]);

  const handleClose = useCallback(() => {
    if (!isSaving) {
      onClose();
    }
  }, [onClose, isSaving]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Story" : "Create New Story"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="story-title" className="block text-sm font-medium mb-1">
              Title *
            </label>
            <Input
              id="story-title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter story title"
              required
              disabled={isSaving}
            />
          </div>

          {/* Epic Selection - Only show if not provided via props */}
          {!epicId && projectId && (
            <div>
              <label htmlFor="story-epic" className="block text-sm font-medium mb-1">
                EPIC *
              </label>
              <Select
                value={selectedEpicId}
                onValueChange={(value) => setSelectedEpicId(value)}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an EPIC" />
                </SelectTrigger>
                <SelectContent>
                  {epics.map((epic: any) => (
                    <SelectItem key={epic.id} value={epic.id}>
                      {epic.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div>
            <label htmlFor="story-description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="story-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter story description"
              rows={3}
              disabled={isSaving}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="story-priority" className="block text-sm font-medium mb-1">
              Priority
            </label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as any }))}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div>
            <label htmlFor="story-status" className="block text-sm font-medium mb-1">
              Status
            </label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as HierarchyStatus }))}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="doing">Doing</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* MVP Flag */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="story-mvp"
              checked={formData.mvp_flag}
              onChange={(e) => setFormData(prev => ({ ...prev, mvp_flag: e.target.checked }))}
              disabled={isSaving}
              className="h-4 w-4"
            />
            <label htmlFor="story-mvp" className="text-sm font-medium">
              MVP Story
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update Story" : "Create Story")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};