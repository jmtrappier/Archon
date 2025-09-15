import { AlertTriangle, Flag, Loader2, Save, Trash2, X } from "lucide-react";
import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../../ui/primitives/alert-dialog";
import { Button } from "../../../ui/primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../ui/primitives/dialog";
import { Input } from "../../../ui/primitives/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/primitives/select";
import { useToast } from "../../../ui/hooks/useToast";
import { useCreateEpic, useUpdateEpic } from "../hooks/useEpicQueries";
import type { Epic, CreateEpicRequest, UpdateEpicRequest, HierarchyStatus, Priority } from "../types";
import { validateCreateEpic, validateUpdateEpic } from "../schemas";

type ModalMode = "create" | "edit" | "delete";

export interface EpicModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  mode: ModalMode;
  epic?: Epic;
  onSubmit?: (data: CreateEpicRequest | UpdateEpicRequest) => void;
  onDeleteConfirm?: () => void;
  isLoading?: boolean;
}

export const EpicModal: React.FC<EpicModalProps> = ({
  isOpen,
  onClose,
  projectId,
  mode,
  epic,
  onSubmit,
  onDeleteConfirm,
  isLoading = false,
}) => {
  // Form state
  const [formData, setFormData] = useState<CreateEpicRequest | UpdateEpicRequest>({
    project_id: projectId,
    title: "",
    description: "",
    status: "todo" as HierarchyStatus,
    priority: "medium" as Priority,
    mvp_flag: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // React Query hooks
  const createEpic = useCreateEpic();
  const updateEpic = useUpdateEpic(projectId);
  const { showToast } = useToast();

  // Initialize form data when epic changes
  useEffect(() => {
    if (mode === "edit" && epic) {
      setFormData({
        title: epic.title,
        description: epic.description || "",
        status: epic.status,
        priority: epic.priority || "medium",
        mvp_flag: epic.mvp_flag || false,
      });
    } else if (mode === "create") {
      setFormData({
        project_id: projectId,
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        mvp_flag: false,
      });
    }
    setErrors({});
  }, [mode, epic, projectId]);

  // Form handlers
  const handleInputChange = useCallback((field: keyof typeof formData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: "",
      }));
    }
  }, [errors]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate form data
      if (mode === "create") {
        const validation = validateCreateEpic(formData);
        if (!validation.success) {
          const newErrors: Record<string, string> = {};
          validation.error.errors.forEach((error) => {
            newErrors[error.path[0]] = error.message;
          });
          setErrors(newErrors);
          return;
        }

        await createEpic.mutateAsync(formData as CreateEpicRequest);
        showToast("Epic created successfully", "success");
        onClose();
      } else if (mode === "edit" && epic) {
        const validation = validateUpdateEpic(formData);
        if (!validation.success) {
          const newErrors: Record<string, string> = {};
          validation.error.errors.forEach((error) => {
            newErrors[error.path[0]] = error.message;
          });
          setErrors(newErrors);
          return;
        }

        await updateEpic.mutateAsync({
          epicId: epic.id,
          updates: formData as UpdateEpicRequest,
        });
        showToast("Epic updated successfully", "success");
        onClose();
      }

      if (onSubmit) {
        onSubmit(formData);
      }
    } catch (error) {
      console.error("Form submission error:", error);
      // Error handling is done by React Query mutation
    }
  }, [mode, formData, epic, createEpic, updateEpic, onSubmit, onClose, showToast]);

  const handleDelete = useCallback(() => {
    if (onDeleteConfirm) {
      onDeleteConfirm();
    }
  }, [onDeleteConfirm]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // Delete confirmation dialog
  if (mode === "delete" && epic) {
    return (
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Delete Epic
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete the epic <strong>"{epic.title}"</strong>?
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                <strong>Warning:</strong> This action will also delete all associated stories and tasks.
                This cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onClose} disabled={isLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Epic
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Create/Edit modal
  const isCreating = mode === "create";
  const modalTitle = isCreating ? "Create New Epic" : "Edit Epic";
  const submitText = isCreating ? "Create Epic" : "Update Epic";
  const isSubmitDisabled = isLoading || createEpic.isPending || updateEpic.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {modalTitle}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? "Create a new epic to organize your project's major features and initiatives."
              : "Update the epic details and settings."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter epic title..."
              className={errors.title ? "border-red-500 focus:border-red-500" : ""}
              maxLength={200}
            />
            {errors.title && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Describe this epic's goals and scope..."
              className={`w-full min-h-[100px] px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.description ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""
              }`}
              maxLength={1000}
            />
            {errors.description && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.description}</p>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              {formData.description.length}/1000 characters
            </div>
          </div>

          {/* Status and Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Status
              </label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange("status", value as HierarchyStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="doing">In Progress</SelectItem>
                  <SelectItem value="review">In Review</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Priority
              </label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleInputChange("priority", value as Priority)}
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
          </div>

          {/* MVP Flag */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="mvp_flag"
              checked={formData.mvp_flag}
              onChange={(e) => handleInputChange("mvp_flag", e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label
              htmlFor="mvp_flag"
              className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
            >
              Mark as MVP (Minimum Viable Product)
            </label>
          </div>

          {/* Form Actions */}
          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitDisabled}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitDisabled}
              className="gap-2"
            >
              {isSubmitDisabled ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isCreating ? "Creating..." : "Updating..."}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {submitText}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};