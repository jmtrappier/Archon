import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { epicService } from "@/features/projects/epics/services/epicService";
import { storyService } from "@/features/projects/stories/services/storyService";
import { taskService } from "@/features/projects/tasks/services/taskService";
import { useToast } from "@/features/ui/hooks/useToast";

interface MoveOperationParams {
  sourceId: string;
  sourceType: string;
  targetId: string;
  targetType: string;
  projectId: string;
}

interface ReorderOperationParams {
  nodeId: string;
  nodeType: string;
  newOrder: number;
  projectId: string;
  parentId?: string;
}

export const useTreeDragDrop = (projectId: string) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Move Epic to Project (reorder)
  const moveEpicMutation = useMutation({
    mutationFn: async ({ epicId, order }: { epicId: string; order: number }) => {
      return epicService.updateEpic(epicId, { task_order: order });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hierarchy", projectId] });
      queryClient.invalidateQueries({ queryKey: ["epics", projectId] });
    },
  });

  // Move Story to Epic
  const moveStoryToEpicMutation = useMutation({
    mutationFn: async ({ storyId, epicId }: { storyId: string; epicId: string }) => {
      return storyService.updateStory(storyId, { epic_id: epicId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hierarchy", projectId] });
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      queryClient.invalidateQueries({ queryKey: ["epics"] });
    },
  });

  // Move Task to Story
  const moveTaskToStoryMutation = useMutation({
    mutationFn: async ({ taskId, storyId }: { taskId: string; storyId: string }) => {
      return taskService.updateTask(taskId, { story_id: storyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hierarchy", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stories"] });
    },
  });

  // Convert Task to Subtask (move to another Task)
  const convertTaskToSubtaskMutation = useMutation({
    mutationFn: async ({ taskId, parentTaskId }: { taskId: string; parentTaskId: string }) => {
      return taskService.updateTask(taskId, { parent_task_id: parentTaskId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hierarchy", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
    },
  });

  // Move Subtask to Task
  const moveSubtaskToTaskMutation = useMutation({
    mutationFn: async ({ subtaskId, taskId }: { subtaskId: string; taskId: string }) => {
      return taskService.updateTask(subtaskId, { parent_task_id: taskId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hierarchy", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
    },
  });

  // Reorder items at same level
  const reorderMutation = useMutation({
    mutationFn: async ({ nodeId, nodeType, newOrder }: ReorderOperationParams) => {
      switch (nodeType) {
        case "epic":
          return epicService.updateEpic(nodeId, { task_order: newOrder });
        case "story":
          return storyService.updateStory(nodeId, { task_order: newOrder });
        case "task":
        case "subtask":
          return taskService.updateTaskOrder(nodeId, newOrder);
        default:
          throw new Error(`Unknown node type: ${nodeType}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hierarchy", projectId] });
    },
  });

  const handleMove = useCallback(
    async (source: any, target: any) => {
      try {
        // Validate business rules
        if (source.nodeId === target.nodeId) {
          throw new Error("Cannot move item to itself");
        }

        // Check for circular dependencies
        if (source.type === "epic" && target.type === "story") {
          throw new Error("Cannot move epic to story");
        }
        if (source.type === "story" && target.type === "task") {
          throw new Error("Cannot move story to task");
        }

        // Execute appropriate move operation using actual UUIDs from raw data
        if (source.type === "story" && target.type === "epic") {
          // Extract actual UUIDs from the source and target raw data
          const sourceStoryId = source.raw?.id || source.nodeId;
          const targetEpicId = target.raw?.id || target.nodeId;

          await moveStoryToEpicMutation.mutateAsync({
            storyId: sourceStoryId,
            epicId: targetEpicId,
          });
        } else if (source.type === "task" && target.type === "story") {
          const sourceTaskId = source.raw?.id || source.nodeId;
          const targetStoryId = target.raw?.id || target.nodeId;

          await moveTaskToStoryMutation.mutateAsync({
            taskId: sourceTaskId,
            storyId: targetStoryId,
          });
        } else if (source.type === "task" && target.type === "task") {
          // Convert task to subtask
          const sourceTaskId = source.raw?.id || source.nodeId;
          const targetTaskId = target.raw?.id || target.nodeId;

          await convertTaskToSubtaskMutation.mutateAsync({
            taskId: sourceTaskId,
            parentTaskId: targetTaskId,
          });
        } else if (source.type === "subtask" && target.type === "task") {
          const sourceSubtaskId = source.raw?.id || source.nodeId;
          const targetTaskId = target.raw?.id || target.nodeId;

          await moveSubtaskToTaskMutation.mutateAsync({
            subtaskId: sourceSubtaskId,
            taskId: targetTaskId,
          });
        } else {
          throw new Error(`Invalid move: ${source.type} to ${target.type}`);
        }

        // Log audit trail
        console.log("Audit trail:", {
          moved_from: source.parentId,
          moved_to: target.nodeId,
          moved_by: "current_user", // Get from auth context
          moved_at: new Date().toISOString(),
          item_type: source.type,
          item_id: source.nodeId,
        });

        return true;
      } catch (error) {
        console.error("Move operation failed:", error);
        throw error;
      }
    },
    [
      moveStoryToEpicMutation,
      moveTaskToStoryMutation,
      convertTaskToSubtaskMutation,
      moveSubtaskToTaskMutation,
    ]
  );

  const handleReorder = useCallback(
    async (nodeId: string, nodeType: string, newOrder: number) => {
      try {
        await reorderMutation.mutateAsync({
          nodeId,
          nodeType,
          newOrder,
          projectId,
        });
        return true;
      } catch (error) {
        console.error("Reorder operation failed:", error);
        throw error;
      }
    },
    [reorderMutation, projectId]
  );

  // Validation function for drag & drop rules
  const canDrop = useCallback((source: any, target: any) => {
    // Cannot drop on itself
    if (source.nodeId === target.nodeId) return false;

    // Cannot drop parent on its child (prevent cycles)
    if (isAncestor(source.nodeId, target.nodeId)) return false;

    // Projects cannot be moved
    if (source.type === "project" || target.type === "project") return false;

    // Valid moves matrix
    const validMoves: Record<string, string[]> = {
      epic: ["project"], // Epic can only reorder within project
      story: ["epic", "story"], // Story can move to epic or reorder
      task: ["story", "task"], // Task can move to story or become subtask
      subtask: ["task", "subtask"], // Subtask can move to task or reorder
    };

    return validMoves[source.type]?.includes(target.type) || false;
  }, []);

  // Helper to check if sourceId is ancestor of targetId
  const isAncestor = (sourceId: string, targetId: string): boolean => {
    // This would need access to the tree structure
    // For now, returning false - implement with actual tree traversal
    return false;
  };

  return {
    handleMove,
    handleReorder,
    canDrop,
    isLoading:
      moveEpicMutation.isPending ||
      moveStoryToEpicMutation.isPending ||
      moveTaskToStoryMutation.isPending ||
      convertTaskToSubtaskMutation.isPending ||
      moveSubtaskToTaskMutation.isPending ||
      reorderMutation.isPending,
  };
};