import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Bot, CheckCircle, Loader2, Sparkles, User } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/features/ui/hooks";
import { Button, Input } from "@/features/ui/primitives";
import { Checkbox } from "@/features/ui/primitives/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/features/ui/primitives/dialog";
import { Label } from "@/features/ui/primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/features/ui/primitives/select";
import { Textarea } from "@/features/ui/primitives/textarea";
import { useProjectEpics } from "../../epics/hooks/useEpicQueries";
import type { Assignee } from "../../tasks/types";
import { useCreateStory, useUpdateStory } from "../hooks/useStoryQueries";
import { CreateStorySchema, HierarchyStatusSchema } from "../schemas";
import type { Priority, Story } from "../types";

interface StoryModalProps {
  isOpen: boolean;
  epicId?: string;
  projectId?: string;
  editingStory?: Story;
  onClose: () => void;
  onSaved: () => void;
}

// Enhanced form schema using existing schemas with better validation messages
const formSchema = CreateStorySchema.extend({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters")
    .refine((val) => val.trim().length > 0, "Title cannot be empty"),

  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description must be less than 1000 characters")
    .refine((val) => val.trim().length > 0, "Description cannot be empty"),

  status: HierarchyStatusSchema.default("todo"),

  epic_id: z.string().uuid("Please select a valid EPIC").optional(),
})
  .omit({ epic_id: true })
  .extend({
    epic_id: z.string().optional(),
  });

type FormData = z.infer<typeof formSchema>;

// Field validation component
const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="flex items-center gap-1 mt-1 text-sm text-red-600 dark:text-red-400">
      <AlertCircle className="h-3 w-3" />
      <span>{message}</span>
    </div>
  );
};

// Field success indicator
const FieldSuccess: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;

  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2">
      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
    </div>
  );
};

// Enhanced Input with validation styling
const ValidatedInput: React.FC<{
  error?: string;
  success?: boolean;
  children: React.ReactNode;
}> = ({ error, success, children }) => (
  <div className="relative">
    <div
      className={`
      ${error ? "ring-2 ring-red-500 ring-opacity-50" : ""}
      ${success && !error ? "ring-2 ring-green-500 ring-opacity-50" : ""}
    `}
    >
      {children}
    </div>
    <FieldSuccess show={success && !error} />
  </div>
);

export const StoryModal: React.FC<StoryModalProps> = ({
  isOpen,
  epicId,
  projectId,
  editingStory,
  onClose,
  onSaved,
}) => {
  const { showToast } = useToast();
  const formId = useId();
  const titleId = `${formId}-title`;
  const descriptionId = `${formId}-description`;
  const epicSelectId = `${formId}-epic`;
  const priorityId = `${formId}-priority`;
  const statusId = `${formId}-status`;
  const assigneeId = `${formId}-assignee`;
  const mvpId = `${formId}-mvp`;
  const formTitleId = `${formId}-form-title`;
  const formDescId = `${formId}-form-description`;

  // Fetch epics if we need epic selection
  const { data: epics = [] } = useProjectEpics(projectId || "", {
    enabled: !epicId && !!projectId,
  });

  const createStoryMutation = useCreateStory(epicId || "");
  const updateStoryMutation = useUpdateStory(epicId || "");

  const isEditing = !!editingStory;
  const isSaving = createStoryMutation.isPending || updateStoryMutation.isPending;

  // Form setup with react-hook-form + Zod
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "todo",
      mvp_flag: false,
      epic_id: epicId || "",
      assignee: undefined,
    },
    mode: "onChange", // Real-time validation
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, touchedFields },
    watch,
  } = form;

  // Watch form values for real-time feedback
  const watchedValues = watch();

  // Initialize form data when editing or epic changes
  useEffect(() => {
    if (editingStory) {
      reset({
        title: editingStory.title || "",
        description: editingStory.description || "",
        priority: (editingStory.priority as Priority) || "medium",
        status: editingStory.status || "todo",
        mvp_flag: editingStory.mvp_flag || false,
        epic_id: editingStory.epic_id || epicId || "",
        assignee: (editingStory.assignee as Assignee) || undefined,
      });
    } else {
      reset({
        title: "",
        description: "",
        priority: "medium",
        status: "todo",
        mvp_flag: false,
        epic_id: epicId || "",
        assignee: undefined,
      });
    }
  }, [editingStory, epicId, reset]);

  // Form submission handler
  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        const submitData = {
          ...data,
          epic_id: data.epic_id || epicId, // Ensure epic_id is set
        };

        if (isEditing && editingStory) {
          await updateStoryMutation.mutateAsync({
            storyId: editingStory.id,
            updates: submitData,
          });
          showToast("Story updated successfully!", "success");
        } else {
          await createStoryMutation.mutateAsync(submitData);
          showToast("Story created successfully!", "success");
        }

        onSaved();
      } catch (error) {
        console.error("Story submission error:", error);
        showToast(`Failed to ${isEditing ? "update" : "create"} story. Please try again.`, "error");
      }
    },
    [isEditing, editingStory, updateStoryMutation, createStoryMutation, showToast, onSaved, epicId],
  );

  // Enhanced close handler with confirmation if form is dirty
  const handleClose = useCallback(() => {
    if (!isSaving) {
      const hasChanges = Object.keys(touchedFields).length > 0;
      if (hasChanges) {
        if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
          reset();
          onClose();
        }
      } else {
        onClose();
      }
    }
  }, [onClose, isSaving, touchedFields, reset]);

  // Keyboard event handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) {
        handleClose();
      }
    },
    [handleClose, isSaving],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-lg w-full max-h-[90vh] overflow-y-auto sm:max-w-md sm:max-h-[85vh] md:max-h-[80vh]"
        onKeyDown={handleKeyDown}
        aria-describedby={formDescId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={formTitleId}
      >
        <DialogHeader>
          <DialogTitle id={formTitleId}>{isEditing ? "Edit Story" : "Create New Story"}</DialogTitle>
          <p id={formDescId} className="text-sm text-gray-600 dark:text-gray-400">
            {isEditing ? "Update story details" : "Fill in the details to create a new story"}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Title Field */}
          <div>
            <Label htmlFor={titleId} className="block text-sm font-medium mb-1">
              Title * <span className="text-xs text-gray-500">(3-100 characters)</span>
            </Label>
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <ValidatedInput error={errors.title?.message} success={touchedFields.title && !errors.title}>
                  <Input
                    {...field}
                    id={titleId}
                    placeholder="Enter a clear, descriptive title"
                    disabled={isSaving}
                    aria-invalid={!!errors.title}
                    aria-describedby={errors.title ? `${titleId}-error` : undefined}
                    autoFocus
                  />
                </ValidatedInput>
              )}
            />
            <FieldError message={errors.title?.message} />
          </div>

          {/* Epic Selection - Only show if not provided via props */}
          {!epicId && projectId && (
            <div>
              <Label htmlFor={epicSelectId} className="block text-sm font-medium mb-1">
                EPIC *
              </Label>
              <Controller
                name="epic_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ""} onValueChange={field.onChange} disabled={isSaving}>
                    <SelectTrigger aria-invalid={!!errors.epic_id}>
                      <SelectValue placeholder="Select an EPIC" />
                    </SelectTrigger>
                    <SelectContent>
                      {epics.map((epic) => (
                        <SelectItem key={epic.id} value={epic.id}>
                          {epic.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.epic_id?.message} />
            </div>
          )}

          {/* Description Field */}
          <div>
            <Label htmlFor={descriptionId} className="block text-sm font-medium mb-1">
              Description * <span className="text-xs text-gray-500">(10-1000 characters)</span>
            </Label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <ValidatedInput
                  error={errors.description?.message}
                  success={touchedFields.description && !errors.description}
                >
                  <Textarea
                    {...field}
                    id={descriptionId}
                    placeholder="Describe what this story accomplishes..."
                    rows={4}
                    disabled={isSaving}
                    aria-invalid={!!errors.description}
                    className="resize-none"
                  />
                </ValidatedInput>
              )}
            />
            <div className="flex justify-between items-center mt-1">
              <FieldError message={errors.description?.message} />
              <span className="text-xs text-gray-500">{watchedValues.description?.length || 0}/1000</span>
            </div>
          </div>

          {/* Priority and Status Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <Label htmlFor={priorityId} className="block text-sm font-medium mb-1">
                Priority *
              </Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                    <SelectTrigger aria-invalid={!!errors.priority}>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">🟢 Low</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="high">🟠 High</SelectItem>
                      <SelectItem value="critical">🔴 Critical</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.priority?.message} />
            </div>

            {/* Status */}
            <div>
              <Label htmlFor={statusId} className="block text-sm font-medium mb-1">
                Status *
              </Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                    <SelectTrigger aria-invalid={!!errors.status}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">📝 Todo</SelectItem>
                      <SelectItem value="doing">⚡ Doing</SelectItem>
                      <SelectItem value="review">👀 Review</SelectItem>
                      <SelectItem value="waiting">⏳ Waiting</SelectItem>
                      <SelectItem value="done">✅ Done</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.status?.message} />
            </div>
          </div>

          {/* Assignee */}
          <div>
            <Label htmlFor={assigneeId} className="block text-sm font-medium mb-1">
              Assignee
            </Label>
            <Controller
              name="assignee"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                  disabled={isSaving}
                >
                  <SelectTrigger aria-invalid={!!errors.assignee}>
                    <SelectValue placeholder="Select assignee (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    <SelectItem value="User">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-500" />
                        <span>User</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Archon">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-green-500" />
                        <span>Archon</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="AI IDE Agent">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        <span>AI IDE Agent</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.assignee?.message} />
          </div>

          {/* MVP Flag */}
          <div className="flex items-center space-x-2">
            <Controller
              name="mvp_flag"
              control={control}
              render={({ field }) => (
                <Checkbox id={mvpId} checked={field.value} onCheckedChange={field.onChange} disabled={isSaving} />
              )}
            />
            <Label htmlFor={mvpId} className="text-sm font-medium cursor-pointer">
              MVP Story
              <span className="text-xs text-gray-500 ml-1">(Minimum Viable Product - Critical for first release)</span>
            </Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-6 border-t">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !isValid} className="min-w-[120px]">
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </div>
              ) : isEditing ? (
                "Update Story"
              ) : (
                "Create Story"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StoryModal;
