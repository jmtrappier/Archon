import { Flag, Loader2, Save, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../ui/primitives/dialog";
import { Input } from "../../../ui/primitives/input";
// Note: Using plain label as Label component doesn't exist
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/primitives/select";
// Note: Using plain textarea as Textarea component doesn't exist
import { useToast } from "../../../ui/hooks/useToast";
import { useCreateStory, useUpdateStory } from "../hooks/useStoryQueries";
import { useEpic, useProjectEpics } from "../../epics/hooks/useEpicQueries";
import type { Story, StoryWithEpic, CreateStoryRequest, UpdateStoryRequest, Priority, HierarchyStatus } from "../types";

export interface StoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  epicId: string;
  projectId?: string;
  story?: Story | StoryWithEpic | null;
  mode: 'create' | 'edit';
}

interface StoryFormData {
  title: string;
  description: string;
  epic_id: string;
  priority: Priority;
  status: HierarchyStatus;
  mvp_flag: boolean;
}

const defaultFormData: StoryFormData = {
  title: "",
  description: "",
  epic_id: "",
  priority: "medium",
  status: "todo",
  mvp_flag: false,
};

export const StoryModal: React.FC<StoryModalProps> = ({
  isOpen,
  onClose,
  epicId,
  projectId,
  story,
  mode,
}) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<StoryFormData>(defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof StoryFormData, string>>>({});

  // Hooks
  const createStory = useCreateStory();
  const updateStory = useUpdateStory(epicId);
  const { data: epic } = useEpic(epicId);
  const { data: availableEpics = [] } = useProjectEpics(projectId);

  // Initialize form data
  useEffect(() => {
    if (mode === 'create') {
      setFormData({
        ...defaultFormData,
        epic_id: epicId,
      });
    } else if (mode === 'edit' && story) {
      setFormData({
        title: story.title,
        description: story.description || "",
        epic_id: story.epic_id,
        priority: story.priority || "medium",
        status: story.status,
        mvp_flag: story.mvp_flag,
      });
    }
    setErrors({});
  }, [mode, story, epicId, isOpen]);

  // Form handlers
  const handleInputChange = (field: keyof StoryFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof StoryFormData, string>> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Story title is required";
    } else if (formData.title.length > 255) {
      newErrors.title = "Story title must be less than 255 characters";
    }

    if (formData.description.length > 10000) {
      newErrors.description = "Story description must be less than 10000 characters";
    }

    if (!formData.epic_id) {
      newErrors.epic_id = "Epic selection is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (mode === 'create') {
        const createRequest: CreateStoryRequest = {
          epic_id: formData.epic_id,
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          priority: formData.priority,
          mvp_flag: formData.mvp_flag,
        };

        await createStory.mutateAsync(createRequest);
        showToast("Story created successfully", "success");
      } else if (mode === 'edit' && story) {
        const updateRequest: UpdateStoryRequest = {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          priority: formData.priority,
          status: formData.status,
          mvp_flag: formData.mvp_flag,
        };

        // Only include epic_id if it changed
        if (formData.epic_id !== story.epic_id) {
          updateRequest.epic_id = formData.epic_id;
        }

        await updateStory.mutateAsync({
          storyId: story.id,
          updates: updateRequest,
        });
        showToast("Story updated successfully", "success");
      }

      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      showToast(errorMessage, "error");
    }
  };

  const handleClose = () => {
    if (createStory.isPending || updateStory.isPending) {
      return; // Prevent closing while submitting
    }
    onClose();
  };

  const isSubmitting = createStory.isPending || updateStory.isPending;
  const canSubmit = formData.title.trim() && formData.epic_id && !isSubmitting;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'create' ? 'Create New Story' : 'Edit Story'}
            {formData.mvp_flag && (
              <Badge variant="destructive" className="text-xs gap-1">
                <Flag className="w-3 h-3" />
                MVP
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? `Create a new story for the "${epic?.title}" epic.`
              : `Edit the details of "${story?.title}".`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Epic Selection */}
          <div className="space-y-2">
            <label htmlFor="epic_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Epic</label>
            <Select
              value={formData.epic_id}
              onValueChange={(value) => handleInputChange('epic_id', value)}
            >
              <SelectTrigger id="epic_id" className={errors.epic_id ? "border-red-500" : ""}>
                <SelectValue placeholder="Select an epic" />
              </SelectTrigger>
              <SelectContent>
                {availableEpics.map((epic) => (
                  <SelectItem key={epic.id} value={epic.id}>
                    {epic.title}
                    {epic.mvp_flag && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        MVP
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.epic_id && (
              <p className="text-sm text-red-500">{errors.epic_id}</p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter story title..."
              className={errors.title ? "border-red-500" : ""}
              maxLength={255}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
            <p className="text-xs text-gray-500">
              {formData.title.length}/255 characters
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter story description..."
              className={`min-h-[120px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 ${errors.description ? "border-red-500" : ""}`}
              maxLength={10000}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
            <p className="text-xs text-gray-500">
              {formData.description.length}/10000 characters
            </p>
          </div>

          {/* Priority and Status Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-2">
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
              <Select
                value={formData.priority}
                onValueChange={(value: Priority) => handleInputChange('priority', value)}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      Low
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="critical">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      Critical
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status (only show in edit mode) */}
            {mode === 'edit' && (
              <div className="space-y-2">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <Select
                  value={formData.status}
                  onValueChange={(value: HierarchyStatus) => handleInputChange('status', value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                        Todo
                      </span>
                    </SelectItem>
                    <SelectItem value="doing">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        Doing
                      </span>
                    </SelectItem>
                    <SelectItem value="review">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        Review
                      </span>
                    </SelectItem>
                    <SelectItem value="waiting">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                        Waiting
                      </span>
                    </SelectItem>
                    <SelectItem value="done">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        Done
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* MVP Flag */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="mvp_flag"
              checked={formData.mvp_flag}
              onChange={(e) => handleInputChange('mvp_flag', e.target.checked)}
              className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
            />
            <label htmlFor="mvp_flag" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Flag className="w-4 h-4" />
              Mark as MVP (Minimum Viable Product)
            </label>
          </div>
          {formData.mvp_flag && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
              This story is critical for the minimum viable product and should be prioritized.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {mode === 'create' ? 'Create Story' : 'Update Story'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};