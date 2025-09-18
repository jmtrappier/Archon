import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { Button } from "../../../ui/primitives";
import { useReorderSubtasks, useSubtasks } from "../hooks";
import type { Task } from "../types";
import { getProgressColor, getProgressTextColor } from "../utils";
import { SubtaskEditModal } from "./SubtaskEditModal";
import { SubtaskItem } from "./SubtaskItem";

export interface SubtaskListProps {
  parentTask: Task;
  projectId: string;
  onSubtaskEdit?: (subtask: Task) => void;
  onSubtaskDelete?: (subtask: Task) => void;
  isCompact?: boolean; // For different display modes
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  parentTask,
  projectId,
  onSubtaskEdit,
  onSubtaskDelete,
  isCompact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(!isCompact);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());

  // Hooks for subtask operations
  const { data: subtasks = [], isLoading, error } = useSubtasks(parentTask.id);
  const reorderSubtasksMutation = useReorderSubtasks(parentTask.id);

  // Calculate progress
  const progress = parentTask.progress || 0;
  const completedCount = parentTask.completed_subtasks || 0;
  const totalCount = parentTask.subtask_count || subtasks.length;

  const handleToggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const handleAddSubtask = useCallback(() => {
    setIsAddingSubtask(true);
    setIsExpanded(true); // Auto-expand when adding
  }, []);

  const handleSubtaskReorder = useCallback(
    (subtaskId: string, targetIndex: number) => {
      const currentSubtasks = [...subtasks];
      const draggedSubtask = currentSubtasks.find((s) => s.id === subtaskId);

      if (!draggedSubtask) return;

      const currentIndex = currentSubtasks.indexOf(draggedSubtask);
      currentSubtasks.splice(currentIndex, 1);
      currentSubtasks.splice(targetIndex, 0, draggedSubtask);

      const orderedIds = currentSubtasks.map((s) => s.id);
      reorderSubtasksMutation.mutate(orderedIds);
    },
    [subtasks, reorderSubtasksMutation],
  );

  const handleToggleSubtaskExpand = useCallback((subtaskId: string) => {
    setExpandedSubtasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subtaskId)) {
        newSet.delete(subtaskId);
      } else {
        newSet.add(subtaskId);
      }
      return newSet;
    });
  }, []);

  // Don't render if no subtasks and not in expanded state
  if (!isExpanded && totalCount === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      {/* Header with progress and controls */}
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleExpanded}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-1"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}

          <span>Subtasks</span>

          {/* Progress indicator */}
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs">
                ({completedCount}/{totalCount})
              </span>

              {/* Progress bar */}
              <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getProgressColor(progress)}`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              <span className={`text-xs font-medium ${getProgressTextColor(progress)}`}>{progress}%</span>
            </div>
          )}
        </Button>

        {/* Add subtask button */}
        {isExpanded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddSubtask}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Plus className="h-3 w-3" />
            Add Subtask
          </Button>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="space-y-1">
          {/* Loading state */}
          {isLoading && <div className="pl-6 py-2 text-sm text-gray-500">Loading subtasks...</div>}

          {/* Error state */}
          {error && <div className="pl-6 py-2 text-sm text-red-600">Failed to load subtasks</div>}

          {/* Subtasks list */}
          {Array.isArray(subtasks) &&
            subtasks.map((subtask, index) => (
              <SubtaskItem
                key={subtask.id}
                subtask={subtask}
                parentTaskId={parentTask.id}
                index={index}
                projectId={projectId}
                onSubtaskReorder={handleSubtaskReorder}
                onEdit={onSubtaskEdit}
                onDelete={onSubtaskDelete}
                isExpanded={expandedSubtasks.has(subtask.id)}
                onToggleExpand={() => handleToggleSubtaskExpand(subtask.id)}
                hasNestedSubtasks={false} // TODO: Implement nested subtasks detection
              />
            ))}

          {/* Empty state */}
          {!isLoading && !error && Array.isArray(subtasks) && subtasks.length === 0 && (
            <div className="pl-6 py-4 text-center">
              <p className="text-sm text-gray-500 mb-2">No subtasks yet</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddSubtask}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add your first subtask
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add subtask modal */}
      {isAddingSubtask && (
        <SubtaskEditModal
          isOpen={isAddingSubtask}
          parentTaskId={parentTask.id}
          projectId={projectId}
          editingSubtask={null}
          onClose={() => setIsAddingSubtask(false)}
          onSaved={() => setIsAddingSubtask(false)}
        />
      )}
    </div>
  );
};
