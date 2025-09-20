import { Fragment } from "react";
import { ChevronRight, ChevronDown, Hash, FileText, ListTodo, Waypoints, UserCircle2, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/features/ui/primitives/badge";
import type { HierarchyTreeNode } from "../../services/hierarchyService";
import type { FilterVisibilityMode } from "../hooks/useHierarchyFilters";

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  doing: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  waiting: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  medium: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300",
  high: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
  critical: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
};

const TYPE_COLORS: Record<HierarchyTreeNode["type"], string> = {
  project: "text-gray-600",
  epic: "text-purple-500",
  story: "text-sky-500",
  task: "text-emerald-500",
  subtask: "text-emerald-400",
};

const typeIcon = (type: HierarchyTreeNode["type"]) => {
  switch (type) {
    case "project":
      return <Waypoints className="h-4 w-4" />;
    case "epic":
      return <Hash className="h-4 w-4" />;
    case "story":
      return <FileText className="h-4 w-4" />;
    case "task":
    case "subtask":
      return <ListTodo className="h-4 w-4" />;
    default:
      return null;
  }
};

interface HierarchyNodeProps {
  node: HierarchyTreeNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
  visibilityMode: FilterVisibilityMode;
  isDimmed: boolean;
}

export const HierarchyNode: React.FC<HierarchyNodeProps> = ({
  node,
  depth,
  hasChildren,
  isExpanded,
  onToggle,
  onSelect,
  isSelected,
  visibilityMode,
  isDimmed,
}) => {
  const statusColor = node.status ? STATUS_COLORS[node.status] ?? STATUS_COLORS.todo : STATUS_COLORS.todo;
  const iconColor = TYPE_COLORS[node.type] ?? "text-gray-500";

  const showProgress = typeof node.progress === "number" && node.progress >= 0;

  const leftPadding = depth === 0 ? 0 : depth * 20;

  const isClickable = hasChildren;

  const dimmedClass = visibilityMode === "dim" && isDimmed ? "opacity-45" : "opacity-100";

  return (
    <div
      className={cn(
        "group relative mb-1",
        dimmedClass,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
          "bg-white/75 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60",
          "hover:border-sky-400 hover:shadow-sm",
          isSelected && "border-sky-500 shadow-md",
        )}
        style={{ marginLeft: leftPadding }}
        onClick={onSelect}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
      >
        {/* Expand / collapse */}
        <div className="flex items-center">
          {hasChildren ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md border border-transparent transition-colors",
                "hover:bg-slate-100 dark:hover:bg-slate-800",
              )}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
            </button>
          ) : (
            <div className="h-6 w-6" />
          )}
        </div>

        {/* Icon & title */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800", iconColor)}>
            {typeIcon(node.type)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{node.title}</span>
              {node.mvpFlag && (
                <Badge className="bg-amber-200/60 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  <Pin className="mr-1 h-3 w-3" /> MVP
                </Badge>
              )}
            </div>
            {node.description && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{node.description}</p>
            )}
          </div>
        </div>

        {/* Priority */}
        {node.priority && (
          <Badge className={cn("capitalize text-xs", PRIORITY_COLORS[node.priority] ?? PRIORITY_COLORS.medium)}>
            {node.priority}
          </Badge>
        )}

        {/* Status */}
        {node.status && (
          <Badge className={cn("capitalize text-xs", statusColor)}>{node.status}</Badge>
        )}

        {/* Progress */}
        {showProgress && (
          <div className="hidden items-center gap-2 md:flex">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                style={{ width: `${Math.min(100, Math.max(0, node.progress ?? 0))}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{Math.round(node.progress ?? 0)}%</span>
          </div>
        )}

        {/* Assignee */}
        {node.assignee && (
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <UserCircle2 className="h-4 w-4" />
            <span className="truncate max-w-[6rem]">{node.assignee}</span>
          </div>
        )}
      </div>
    </div>
  );
};
