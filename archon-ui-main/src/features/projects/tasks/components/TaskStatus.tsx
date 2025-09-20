/**
 * TaskStatus Component
 *
 * Status selector for tasks with inline editing support.
 * Provides visual status indication and editing functionality.
 */

import { CheckCircle, Circle, Clock, AlertTriangle, Play } from "lucide-react";
import type React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../ui/primitives/select";
import { cn, glassmorphism } from "../../../ui/primitives/styles";

export type TaskStatus = "todo" | "doing" | "review" | "waiting" | "done";

interface TaskStatusProps {
  status?: TaskStatus;
  onStatusChange?: (status: TaskStatus) => void;
  isLoading?: boolean;
}

// Status options for the dropdown
const STATUS_OPTIONS: Array<{
  value: TaskStatus;
  label: string;
  color: string;
  icon: React.ReactNode;
}> = [
  {
    value: "todo",
    label: "Todo",
    color: "text-slate-600",
    icon: <Circle className="w-3 h-3" />
  },
  {
    value: "doing",
    label: "Doing",
    color: "text-blue-600",
    icon: <Play className="w-3 h-3" />
  },
  {
    value: "review",
    label: "Review",
    color: "text-amber-600",
    icon: <AlertTriangle className="w-3 h-3" />
  },
  {
    value: "waiting",
    label: "Waiting",
    color: "text-rose-600",
    icon: <Clock className="w-3 h-3" />
  },
  {
    value: "done",
    label: "Done",
    color: "text-emerald-600",
    icon: <CheckCircle className="w-3 h-3" />
  },
];

export const TaskStatus: React.FC<TaskStatusProps> = ({
  status = "todo",
  onStatusChange,
  isLoading = false,
}) => {
  // Get status-specific styling
  const getStatusStyles = (statusValue: TaskStatus) => {
    switch (statusValue) {
      case "todo":
        return {
          background: "bg-slate-100/80 dark:bg-slate-800/60",
          text: "text-slate-600 dark:text-slate-300",
          hover: "hover:bg-slate-200/80 dark:hover:bg-slate-700/60",
          glow: "hover:shadow-[0_0_8px_rgba(148,163,184,0.3)]",
          iconColor: "text-slate-500",
        };
      case "doing":
        return {
          background: "bg-blue-100/80 dark:bg-blue-900/40",
          text: "text-blue-600 dark:text-blue-300",
          hover: "hover:bg-blue-200/80 dark:hover:bg-blue-800/40",
          glow: "hover:shadow-[0_0_8px_rgba(59,130,246,0.3)]",
          iconColor: "text-blue-500",
        };
      case "review":
        return {
          background: "bg-amber-100/80 dark:bg-amber-900/30",
          text: "text-amber-600 dark:text-amber-300",
          hover: "hover:bg-amber-200/80 dark:hover:bg-amber-800/30",
          glow: "hover:shadow-[0_0_8px_rgba(245,158,11,0.3)]",
          iconColor: "text-amber-500",
        };
      case "waiting":
        return {
          background: "bg-rose-100/80 dark:bg-rose-900/40",
          text: "text-rose-600 dark:text-rose-300",
          hover: "hover:bg-rose-200/80 dark:hover:bg-rose-800/40",
          glow: "hover:shadow-[0_0_8px_rgba(244,63,94,0.3)]",
          iconColor: "text-rose-500",
        };
      case "done":
        return {
          background: "bg-emerald-100/80 dark:bg-emerald-900/50",
          text: "text-emerald-600 dark:text-emerald-300",
          hover: "hover:bg-emerald-200/80 dark:hover:bg-emerald-800/50",
          glow: "hover:shadow-[0_0_8px_rgba(16,185,129,0.3)]",
          iconColor: "text-emerald-500",
        };
      default:
        return {
          background: "bg-slate-100/80 dark:bg-slate-800/60",
          text: "text-slate-600 dark:text-slate-300",
          hover: "hover:bg-slate-200/80 dark:hover:bg-slate-700/60",
          glow: "hover:shadow-[0_0_8px_rgba(148,163,184,0.3)]",
          iconColor: "text-slate-500",
        };
    }
  };

  const currentStyles = getStatusStyles(status);
  const currentOption = STATUS_OPTIONS.find((opt) => opt.value === status) || STATUS_OPTIONS[0];

  // If no change handler, just show a static button
  if (!onStatusChange) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          "transition-all duration-300",
          currentStyles.background,
          currentStyles.text,
          "opacity-75 cursor-not-allowed",
        )}
        title={`Status: ${currentOption.label}`}
        aria-label={`Status: ${currentOption.label}`}
      >
        <span className={cn(currentStyles.iconColor)}>{currentOption.icon}</span>
        <span>{currentOption.label}</span>
      </button>
    );
  }

  return (
    <Select value={status} onValueChange={(value) => onStatusChange(value as TaskStatus)}>
      <SelectTrigger
        disabled={isLoading}
        className={cn(
          "h-auto px-2.5 py-1 rounded-full text-xs font-medium min-w-[90px]",
          "border-0 shadow-none", // Remove default border and shadow
          "transition-all duration-300",
          currentStyles.background,
          currentStyles.text,
          currentStyles.hover,
          currentStyles.glow,
          "backdrop-blur-md",
        )}
        showChevron={false}
        aria-label={`Status: ${currentOption.label}${isLoading ? " (updating...)" : ""}`}
        aria-disabled={isLoading}
      >
        <div className="flex items-center gap-1.5">
          <span className={cn(currentStyles.iconColor)}>{currentOption.icon}</span>
          <span>{currentOption.label}</span>
        </div>
      </SelectTrigger>

      <SelectContent className="min-w-[120px]">
        {STATUS_OPTIONS.map((option) => {
          const optionStyles = getStatusStyles(option.value);

          return (
            <SelectItem key={option.value} value={option.value} className={option.color}>
              <div className="flex items-center gap-1.5">
                <span className={cn(optionStyles.iconColor)}>{option.icon}</span>
                <span>{option.label}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};