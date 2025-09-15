import { ChevronRight, MoreHorizontal } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Button } from "../../../ui/primitives";
import { useTaskActions } from "../hooks";
import type { Assignee, Task } from "../types";
import { getOrderColor, getOrderGlow, ItemTypes } from "../utils/task-styles";
import { TaskAssignee } from "./TaskAssignee";
import { TaskCardActions } from "./TaskCardActions";

export interface SubtaskItemProps {
  subtask: Task;
  parentTaskId: string;
  index: number;
  projectId: string;
  onSubtaskReorder: (subtaskId: string, targetIndex: number) => void;
  onEdit?: (subtask: Task) => void;
  onDelete?: (subtask: Task) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  hasNestedSubtasks?: boolean;
}

export const SubtaskItem: React.FC<SubtaskItemProps> = ({
  subtask,
  parentTaskId,
  index,
  projectId,
  onSubtaskReorder,
  onEdit,
  onDelete,
  isExpanded = false,
  onToggleExpand,
  hasNestedSubtasks = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { changeAssignee, isUpdating } = useTaskActions(projectId);

  // Handlers
  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit(subtask);
    }
  }, [onEdit, subtask]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(subtask);
    }
  }, [onDelete, subtask]);

  const handleAssigneeChange = useCallback(
    (newAssignee: Assignee) => {
      changeAssignee(subtask.id, newAssignee);
    },
    [changeAssignee, subtask.id]
  );

  const handleToggleExpand = useCallback(() => {
    if (onToggleExpand && hasNestedSubtasks) {
      onToggleExpand();
    }
  }, [onToggleExpand, hasNestedSubtasks]);

  // Drag and drop for subtask reordering
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.TASK,
    item: { id: subtask.id, index, type: "subtask", parentId: parentTaskId },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemTypes.TASK,
    hover: (
      draggedItem: {
        id: string;
        index: number;
        type: string;
        parentId: string;
      },
      monitor
    ) => {
      if (!monitor.isOver({ shallow: true })) return;
      if (draggedItem.id === subtask.id) return;
      if (draggedItem.type !== "subtask") return;
      if (draggedItem.parentId !== parentTaskId) return;

      const draggedIndex = draggedItem.index;
      const hoveredIndex = index;

      if (draggedIndex === hoveredIndex) return;

      // Move the subtask immediately for visual feedback
      onSubtaskReorder(draggedItem.id, hoveredIndex);

      // Update the dragged item's index to prevent re-triggering
      draggedItem.index = hoveredIndex;
    },
  });

  // Status-based styling
  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "done":
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case "doing":
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
      case "review":
        return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
      case "waiting":
        return "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800";
      default:
        return "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700";
    }
  };

  const getStatusDot = (status: Task["status"]) => {
    switch (status) {
      case "done":
        return "bg-green-500";
      case "doing":
        return "bg-blue-500";
      case "review":
        return "bg-yellow-500";
      case "waiting":
        return "bg-orange-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`relative pl-6 ${
        isDragging ? "opacity-50 scale-95" : "opacity-100 scale-100"
      } transition-all duration-200`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hierarchical connection line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
      <div className="absolute left-3 top-4 w-3 h-px bg-gray-200 dark:bg-gray-700" />

      {/* Subtask card */}
      <div
        className={`
          relative rounded-lg border p-3 mb-2 cursor-pointer
          ${getStatusColor(subtask.status)}
          ${isHovered ? "shadow-md" : "shadow-sm"}
          transition-all duration-200
        `}
      >
        {/* Priority indicator */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-[2px] ${getOrderColor(
            subtask.task_order
          )} ${getOrderGlow(subtask.task_order)} rounded-l-lg opacity-70`}
        />

        <div className="flex items-start gap-3 pl-1">
          {/* Expand/Collapse button for nested subtasks */}
          {hasNestedSubtasks && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleExpand}
              className="h-6 w-6 p-0 min-w-0 flex-shrink-0"
            >
              <ChevronRight
                className={`h-3 w-3 transition-transform duration-200 ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
            </Button>
          )}

          {/* Status indicator dot */}
          <div className="flex items-center mt-1 flex-shrink-0">
            <div
              className={`w-2 h-2 rounded-full ${getStatusDot(
                subtask.status
              )}`}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {subtask.title}
                </h5>
                {subtask.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                    {subtask.description}
                  </p>
                )}
                {subtask.feature && (
                  <span
                    className="inline-block px-2 py-1 mt-1 text-xs font-medium rounded-md"
                    style={{
                      backgroundColor: `${subtask.featureColor}20`,
                      color: subtask.featureColor,
                    }}
                  >
                    {subtask.feature}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {isHovered && (
                  <TaskCardActions
                    taskId={subtask.id}
                    taskTitle={subtask.title}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isDeleting={false}
                  />
                )}
              </div>
            </div>

            {/* Footer with assignee */}
            <div className="flex items-center justify-between mt-2">
              <TaskAssignee
                assignee={subtask.assignee}
                onAssigneeChange={handleAssigneeChange}
                isLoading={isUpdating}
              />
              <span className="text-xs text-gray-500 capitalize">
                {subtask.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};