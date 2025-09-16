import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/features/ui/primitives/dialog";
import { Button, Input } from "@/features/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/features/ui/primitives/select";
import { useCreateEpic, useUpdateEpic } from "../hooks/useEpicQueries";
import { useToast } from "@/features/ui/hooks";

interface EpicModalProps {
  isOpen: boolean;
  projectId: string;
  editingEpic?: any;
  onClose: () => void;
  onSaved: () => void;
}

export const EpicModal: React.FC<EpicModalProps> = ({
  isOpen,
  projectId,
  editingEpic,
  onClose,
  onSaved,
}) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "todo" as const,
    priority: "medium" as const, // Changed to string
    mvp_flag: false,
  });

  const createEpicMutation = useCreateEpic(projectId);
  const updateEpicMutation = useUpdateEpic(projectId);

  const isEditing = !!editingEpic;
  const isSaving = createEpicMutation.isPending || updateEpicMutation.isPending;

  // Helper function to convert number to priority string
  const numberToPriority = (num: number): "low" | "medium" | "high" | "critical" => {
    if (num <= 25) return "low";
    if (num <= 50) return "medium"; 
    if (num <= 75) return "high";
    return "critical";
  };

  // Helper function to convert priority string to number
  const priorityToNumber = (priority: string): number => {
    switch (priority) {
      case "low": return 25;
      case "medium": return 50;
      case "high": return 75;
      case "critical": return 100;
      default: return 50;
    }
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editingEpic) {
        setFormData({
          title: editingEpic.title || "",
          description: editingEpic.description || "",
          status: editingEpic.status || "todo",
          priority: editingEpic.priority || "medium",
          mvp_flag: editingEpic.mvp_flag || false,
        });
      } else {
        setFormData({
          title: "",
          description: "",
          status: "todo",
          priority: "medium",
          mvp_flag: false,
        });
      }
    }
  }, [isOpen, editingEpic]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showToast("Epic title is required", "error");
      return;
    }

    try {
      if (isEditing) {
        await updateEpicMutation.mutateAsync({
          epicId: editingEpic.id,
          updates: formData,
        });
      } else {
        // Send the correct data format to the backend
        const createRequest = {
          project_id: projectId,
          title: formData.title,
          description: formData.description,
          priority: formData.priority, // Already a string
          mvp_flag: formData.mvp_flag,
        };
        await createEpicMutation.mutateAsync(createRequest);
      }
      onSaved();
    } catch (error) {
      // Error handling is done in the mutation
    }
  }, [formData, isEditing, editingEpic?.id, createEpicMutation, updateEpicMutation, onSaved, showToast, projectId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Epic" : "Create New Epic"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Epic title..."
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Epic description..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-1">Status</label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="doing">Doing</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium mb-1">Priority</label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as any }))}
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

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="mvp_flag"
              checked={formData.mvp_flag}
              onChange={(e) => setFormData(prev => ({ ...prev, mvp_flag: e.target.checked }))}
              className="h-4 w-4"
            />
            <label htmlFor="mvp_flag" className="text-sm font-medium">MVP (Minimum Viable Product)</label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : isEditing ? "Update Epic" : "Create Epic"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};