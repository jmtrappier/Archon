/**
 * HierarchicalDragDrop - Enhanced drag & drop system for EPIC→STORY→TASK→SUBTASK hierarchy
 *
 * Features:
 * - Multi-level drag & drop with visual feedback
 * - Business rule validation
 * - Cross-hierarchy movement (Task between Stories, Story between Epics)
 * - Smart drop zones with progressive disclosure
 * - Smooth animations and glassmorphism styling
 */

import type { FC, ReactNode } from "react";
import { useDrag, useDrop } from "react-dnd";
import { cn } from "../../../ui/primitives/styles";
import type { Epic, Story, Task } from "../types";

// Enhanced item types for hierarchical drag & drop
export const HierarchicalItemTypes = {
  EPIC: "hierarchical-epic",
  STORY: "hierarchical-story",
  TASK: "hierarchical-task",
  SUBTASK: "hierarchical-subtask",
} as const;

// Drag item interfaces
export interface DraggedEpic {
  type: typeof HierarchicalItemTypes.EPIC;
  id: string;
  title: string;
  projectId: string;
}

export interface DraggedStory {
  type: typeof HierarchicalItemTypes.STORY;
  id: string;
  title: string;
  epicId: string;
  projectId: string;
}

export interface DraggedTask {
  type: typeof HierarchicalItemTypes.TASK;
  id: string;
  title: string;
  storyId: string;
  status: Task["status"];
  projectId: string;
}

export interface DraggedSubtask {
  type: typeof HierarchicalItemTypes.SUBTASK;
  id: string;
  title: string;
  parentTaskId: string;
  index: number;
  projectId: string;
}

export type DraggedHierarchicalItem = DraggedEpic | DraggedStory | DraggedTask | DraggedSubtask;

// Drop zone styling system with beautiful glassmorphism
const dropZoneStyles = {
  epic: {
    base: "border-2 border-dashed border-transparent rounded-xl transition-all duration-300",
    active:
      "border-purple-400 bg-gradient-to-br from-purple-50/40 to-purple-100/30 dark:from-purple-900/20 dark:to-purple-800/30 shadow-[0_0_20px_rgba(147,51,234,0.3)] backdrop-blur-md",
    hover:
      "border-purple-500 bg-gradient-to-br from-purple-100/50 to-purple-200/40 dark:from-purple-800/30 dark:to-purple-700/40 shadow-[0_0_25px_rgba(147,51,234,0.5)]",
  },
  story: {
    base: "border-2 border-dashed border-transparent rounded-lg transition-all duration-300",
    active:
      "border-blue-400 bg-gradient-to-br from-blue-50/40 to-blue-100/30 dark:from-blue-900/20 dark:to-blue-800/30 shadow-[0_0_18px_rgba(59,130,246,0.3)] backdrop-blur-md",
    hover:
      "border-blue-500 bg-gradient-to-br from-blue-100/50 to-blue-200/40 dark:from-blue-800/30 dark:to-blue-700/40 shadow-[0_0_22px_rgba(59,130,246,0.5)]",
  },
  task: {
    base: "border-2 border-dashed border-transparent rounded-lg transition-all duration-300",
    active:
      "border-green-400 bg-gradient-to-br from-green-50/40 to-green-100/30 dark:from-green-900/20 dark:to-green-800/30 shadow-[0_0_16px_rgba(34,197,94,0.3)] backdrop-blur-md",
    hover:
      "border-green-500 bg-gradient-to-br from-green-100/50 to-green-200/40 dark:from-green-800/30 dark:to-green-700/40 shadow-[0_0_20px_rgba(34,197,94,0.5)]",
  },
  subtask: {
    base: "border border-dashed border-transparent rounded-md transition-all duration-300",
    active:
      "border-cyan-400 bg-gradient-to-br from-cyan-50/30 to-cyan-100/20 dark:from-cyan-900/15 dark:to-cyan-800/25 shadow-[0_0_12px_rgba(34,211,238,0.3)] backdrop-blur-sm",
    hover:
      "border-cyan-500 bg-gradient-to-br from-cyan-100/40 to-cyan-200/30 dark:from-cyan-800/25 dark:to-cyan-700/35 shadow-[0_0_16px_rgba(34,211,238,0.5)]",
  },
};

// Business rule validation
export const validateHierarchicalMove = (
  draggedItem: DraggedHierarchicalItem,
  targetType: keyof typeof HierarchicalItemTypes,
  targetId: string,
): { isValid: boolean; reason?: string } => {
  // Stories can only move between Epics
  if (draggedItem.type === HierarchicalItemTypes.STORY && targetType !== "EPIC") {
    return { isValid: false, reason: "Stories can only be moved between Epics" };
  }

  // Tasks can only move between Stories
  if (draggedItem.type === HierarchicalItemTypes.TASK && targetType !== "STORY") {
    return { isValid: false, reason: "Tasks can only be moved between Stories" };
  }

  // Subtasks can only move within same parent Task
  if (draggedItem.type === HierarchicalItemTypes.SUBTASK) {
    if (targetType !== "TASK") {
      return { isValid: false, reason: "Subtasks can only be moved within Tasks" };
    }
    if (draggedItem.parentTaskId !== targetId) {
      return { isValid: false, reason: "Subtasks can only be reordered within the same parent Task" };
    }
  }

  // Prevent self-drop
  if (draggedItem.id === targetId) {
    return { isValid: false, reason: "Cannot drop item on itself" };
  }

  return { isValid: true };
};

// Props interfaces
interface HierarchicalDropZoneProps {
  type: keyof typeof dropZoneStyles;
  targetId: string;
  onDrop: (draggedItem: DraggedHierarchicalItem, targetId: string) => Promise<void>;
  acceptedTypes: string[];
  children: ReactNode;
  className?: string;
  isActive?: boolean;
}

interface HierarchicalDragWrapperProps {
  item: DraggedHierarchicalItem;
  children: ReactNode;
  className?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

// Drop zone component with enhanced visual feedback
export const HierarchicalDropZone: FC<HierarchicalDropZoneProps> = ({
  type,
  targetId,
  onDrop,
  acceptedTypes,
  children,
  className = "",
  isActive = false,
}) => {
  const [{ isOver, canDrop, draggedItem }, drop] = useDrop<
    DraggedHierarchicalItem,
    void,
    { isOver: boolean; canDrop: boolean; draggedItem: DraggedHierarchicalItem | null }
  >({
    accept: acceptedTypes,
    drop: async (draggedItem) => {
      if (canDrop) {
        await onDrop(draggedItem, targetId);
      }
    },
    canDrop: (draggedItem) => {
      const validation = validateHierarchicalMove(
        draggedItem,
        type.toUpperCase() as keyof typeof HierarchicalItemTypes,
        targetId,
      );
      return validation.isValid;
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver({ shallow: true }),
      canDrop: !!monitor.canDrop(),
      draggedItem: monitor.getItem(),
    }),
  });

  // Dynamic styling based on drop state
  const getDropZoneClassName = () => {
    const styles = dropZoneStyles[type];

    if (isOver && canDrop) {
      return cn(styles.base, styles.hover);
    }

    if ((isActive || draggedItem) && canDrop) {
      return cn(styles.base, styles.active);
    }

    return cn(styles.base);
  };

  return (
    <div
      ref={drop}
      className={cn(getDropZoneClassName(), className)}
      role="button"
      aria-label={`Drop zone for ${type}`}
    >
      {children}

      {/* Visual feedback overlay */}
      {isOver && canDrop && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
          <div className="px-4 py-2 rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border shadow-lg">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Drop {draggedItem?.type.toLowerCase().replace("hierarchical-", "")} here
            </p>
          </div>
        </div>
      )}

      {/* Invalid drop feedback */}
      {isOver && !canDrop && draggedItem && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
          <div className="px-4 py-2 rounded-lg bg-red-50/90 dark:bg-red-900/90 backdrop-blur-md border border-red-200 dark:border-red-800 shadow-lg">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {
                validateHierarchicalMove(
                  draggedItem,
                  type.toUpperCase() as keyof typeof HierarchicalItemTypes,
                  targetId,
                ).reason
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Drag wrapper component with beautiful drag preview
export const HierarchicalDragWrapper: FC<HierarchicalDragWrapperProps> = ({
  item,
  children,
  className = "",
  onDragStart,
  onDragEnd,
}) => {
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: item.type,
    item: () => {
      onDragStart?.();
      return item;
    },
    end: () => {
      onDragEnd?.();
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={(node) => drag(preview(node))}
      className={cn("transition-all duration-300 cursor-move", isDragging && "opacity-50 scale-95 rotate-2", className)}
      style={{
        transform: isDragging ? "rotate(2deg)" : undefined,
      }}
    >
      {children}
    </div>
  );
};

// Utility hook for hierarchical drag & drop operations
export const useHierarchicalDragDrop = () => {
  // Services are not yet implemented - will be integrated later
  const taskService = undefined;
  const storyService = undefined;

  // Move story between epics
  const moveStoryToEpic = async (storyId: string, targetEpicId: string) => {
    try {
      // Use storyService when available
      if (storyService?.moveStoryToEpic) {
        await storyService.moveStoryToEpic(storyId, targetEpicId);
      } else {
        console.log(`[UX Design] Story ${storyId} → Epic ${targetEpicId} (service integration pending)`);
      }
    } catch (error) {
      console.error(`Failed to move story ${storyId} to epic ${targetEpicId}:`, error);
      throw error;
    }
  };

  // Move task between stories
  const moveTaskToStory = async (taskId: string, targetStoryId: string) => {
    try {
      // Use existing taskService.moveTaskToStory method
      if (taskService?.moveTaskToStory) {
        await taskService.moveTaskToStory(taskId, targetStoryId);
      } else {
        console.log(`[UX Design] Task ${taskId} → Story ${targetStoryId} (service integration pending)`);
      }
    } catch (error) {
      console.error(`Failed to move task ${taskId} to story ${targetStoryId}:`, error);
      throw error;
    }
  };

  // Reorder subtasks within task
  const reorderSubtasksInTask = async (parentTaskId: string, orderedSubtaskIds: string[]) => {
    try {
      // Use existing taskService.reorderSubtasks method
      if (taskService?.reorderSubtasks) {
        await taskService.reorderSubtasks(parentTaskId, orderedSubtaskIds);
      } else {
        console.log(
          `[UX Design] Reordering subtasks in ${parentTaskId}:`,
          orderedSubtaskIds,
          "(service integration pending)",
        );
      }
    } catch (error) {
      console.error(`Failed to reorder subtasks in task ${parentTaskId}:`, error);
      throw error;
    }
  };

  return {
    moveStoryToEpic,
    moveTaskToStory,
    reorderSubtasksInTask,
  };
};
