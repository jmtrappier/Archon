import React, { useState } from "react";
import {
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  ChevronRight,
  Hash,
  Users,
  ListTodo,
  FileText
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/features/ui/primitives/dropdown-menu";
import { Badge } from "@/features/ui/primitives/badge";

interface ProgressCardProps {
  level: "epic" | "story" | "task" | "subtask";
  code: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "review" | "done" | "waiting";
  progress?: number;
  priority?: number;
  assignee?: string;
  childCount?: {
    total: number;
    completed: number;
    label: string;
  };
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  level,
  code,
  title,
  description,
  status,
  progress = 0,
  priority,
  assignee,
  childCount,
  onClick,
  onEdit,
  onDelete,
  onView,
  isSelected = false,
  onSelect,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getStatusColor = () => {
    switch (status) {
      case "done":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "doing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "review":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "waiting":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getLevelIcon = () => {
    switch (level) {
      case "epic":
        return <Hash className="h-4 w-4 text-purple-500" />;
      case "story":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "task":
        return <ListTodo className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getLevelBorderColor = () => {
    switch (level) {
      case "epic":
        return "border-l-purple-500";
      case "story":
        return "border-l-blue-500";
      case "task":
        return "border-l-green-500";
      default:
        return "border-l-gray-400";
    }
  };

  const getPriorityColor = () => {
    if (!priority) return "";
    if (priority >= 80) return "text-red-500";
    if (priority >= 60) return "text-orange-500";
    if (priority >= 40) return "text-yellow-500";
    return "text-gray-400";
  };

  return (
    <div
      className={`
        relative bg-white dark:bg-gray-800 rounded-lg shadow-sm
        border border-gray-200 dark:border-gray-700
        border-l-4 ${getLevelBorderColor()}
        transition-all duration-200 ease-in-out
        ${isHovered ? "shadow-md transform scale-[1.02]" : ""}
        ${onClick ? "cursor-pointer" : ""}
        ${isSelected ? "ring-2 ring-blue-500" : ""}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick?.()}
    >
      {/* Selection Checkbox */}
      {onSelect && (
        <div className="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(e.target.checked);
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1">
            {getLevelIcon()}
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
              {code}
            </span>
            {priority !== undefined && (
              <span className={`text-xs font-semibold ${getPriorityColor()}`}>
                P{priority}
              </span>
            )}
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onView && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onView();
                }}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {description}
          </p>
        )}

        {/* Status and Assignee */}
        <div className="flex items-center gap-2 mb-3">
          <Badge className={getStatusColor()}>
            {status}
          </Badge>
          {assignee && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {assignee}
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {progress !== undefined && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Progress
              </span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  progress >= 80 ? "bg-green-500" :
                  progress >= 50 ? "bg-blue-500" :
                  progress >= 25 ? "bg-yellow-500" :
                  "bg-red-500"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Child Count */}
        {childCount && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {childCount.label}
            </span>
            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-900 dark:text-white">
                {childCount.completed}/{childCount.total}
              </span>
              {onClick && (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};