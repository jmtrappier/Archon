import * as LucideIcons from "lucide-react";

const { BarChart3, ChevronRight, Flag, Users, MoreVertical, Edit, Trash2 } = LucideIcons;

import type React from "react";
import { useCallback, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../ui/primitives/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/primitives/tooltip";
import {
  type DraggedStory,
  HierarchicalDropZone,
  HierarchicalItemTypes,
  useHierarchicalDragDrop,
} from "../../tasks/components/HierarchicalDragDrop";
import { useUpdateEpicStatus } from "../hooks/useEpicQueries";
import type { Epic, HierarchyStatus, Priority } from "../types";
import { getEpicPriorityColor, getEpicStatusColor } from "../utils/epic-styles";

export interface EpicCardProps {
  epic: Epic;
  index: number;
  projectId: string;
  onEpicReorder: (epicId: string, targetIndex: number, status: HierarchyStatus) => void;
  onEdit?: (epic: Epic) => void;
  onDelete?: (epic: Epic) => void;
  onViewStories?: (epic: Epic) => void;
  hoveredEpicId?: string | null;
  onEpicHover?: (epicId: string | null) => void;
  selectedEpics?: Set<string>;
  onEpicSelect?: (epicId: string) => void;
  showProgress?: boolean;
  storyCounts?: Record<string, any>;
}

export const EpicCard: React.FC<EpicCardProps> = ({
  epic,
  index,
  projectId,
  onEpicReorder,
  onEdit,
  onDelete,
  onViewStories,
  hoveredEpicId,
  onEpicHover,
  selectedEpics,
  onEpicSelect,
  showProgress = true,
  storyCounts,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use React Query hook for status updates
  const updateEpicStatus = useUpdateEpicStatus(projectId);

  // Handlers
  const handleEdit = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      if (onEdit) {
        onEdit(epic);
      }
    },
    [onEdit, epic],
  );

  const handleDelete = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      if (onDelete) {
        onDelete(epic);
      }
    },
    [onDelete, epic],
  );

  const handleViewStories = useCallback(() => {
    if (onViewStories) {
      onViewStories(epic);
    }
  }, [onViewStories, epic]);

  const handleStatusChange = useCallback(
    (newStatus: HierarchyStatus) => {
      updateEpicStatus.mutate({ epicId: epic.id, status: newStatus });
    },
    [updateEpicStatus, epic.id],
  );

  // Hierarchical drag & drop functionality
  const { moveStoryToEpic } = useHierarchicalDragDrop();

  // Handle story drop on epic
  const handleStoryDrop = useCallback(
    async (draggedItem: DraggedStory, targetId: string) => {
      if (draggedItem.type === HierarchicalItemTypes.STORY) {
        await moveStoryToEpic(draggedItem.id, targetId);
      }
    },
    [moveStoryToEpic],
  );

  // Drag and Drop
  const [{ isDragging }, drag] = useDrag({
    type: HierarchicalItemTypes.EPIC,
    item: { id: epic.id, status: epic.status, index, type: "epic" },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: HierarchicalItemTypes.EPIC,
    hover: (draggedItem: { id: string; status: HierarchyStatus; index: number }, monitor) => {
      if (!monitor.isOver({ shallow: true })) return;
      if (draggedItem.id === epic.id) return;
      if (draggedItem.status !== epic.status) return;

      const draggedIndex = draggedItem.index;
      const hoveredIndex = index;

      if (draggedIndex === hoveredIndex) return;

      // Move the epic immediately for visual feedback
      onEpicReorder(draggedItem.id, hoveredIndex, epic.status);

      // Update the dragged item's index
      draggedItem.index = hoveredIndex;
    },
  });

  const isHighlighted = hoveredEpicId === epic.id;
  const isSelected = selectedEpics?.has(epic.id) || false;

  const handleMouseEnter = () => {
    onEpicHover?.(epic.id);
  };

  const handleMouseLeave = () => {
    onEpicHover?.(null);
  };

  const handleEpicClick = (e: React.MouseEvent) => {
    // Handle selection with Ctrl/Cmd
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      onEpicSelect?.(epic.id);
      return;
    }

    // Don't navigate if clicking on buttons or dropdown
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest('[role="menu"]') ||
      (e.target as HTMLElement).closest('[role="menuitem"]')
    ) {
      return;
    }

    // Navigate to epic stories view
    if (onViewStories) {
      e.stopPropagation();
      onViewStories(epic);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Styling calculations
  const progressPercentage = epic.progress || 0;
  const statusColor = getEpicStatusColor(epic.status);
  const priorityColor = getEpicPriorityColor(epic.priority || "medium");

  // Glassmorphism styling
  const cardBaseStyles =
    "bg-gradient-to-b from-white/90 to-white/70 dark:from-white/15 dark:to-black/40 border border-gray-200 dark:border-gray-700 rounded-xl backdrop-blur-lg";
  const transitionStyles = "transition-all duration-200 ease-in-out";

  const highlightGlow = isHighlighted ? "border-indigo-400/60 shadow-[0_0_12px_rgba(99,102,241,0.3)]" : "";
  const selectionGlow = isSelected
    ? "border-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.5)] bg-blue-50/40 dark:bg-blue-900/30"
    : "";

  const hoverEffectClasses =
    "group-hover:border-indigo-400/80 dark:group-hover:border-indigo-500/60 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] dark:group-hover:shadow-[0_0_20px_rgba(99,102,241,0.6)]";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HierarchicalDropZone
            type="epic"
            targetId={epic.id}
            onDrop={handleStoryDrop}
            acceptedTypes={[HierarchicalItemTypes.STORY]}
            className="relative"
          >
            <div
              ref={(node) => drag(drop(node))}
              role="button"
              tabIndex={0}
              className={`w-full min-h-[180px] cursor-move relative ${
                isDragging ? "opacity-60 scale-95" : "scale-100 opacity-100"
              } ${transitionStyles} group`}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={handleEpicClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (onEdit) {
                    onEdit(epic);
                  }
                }
              }}
            >
              <div
                className={`${cardBaseStyles} ${transitionStyles} ${hoverEffectClasses} ${highlightGlow} ${selectionGlow} w-full min-h-[180px] h-full overflow-hidden`}
              >
                {/* Status indicator with priority blend */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-[4px] rounded-l-xl opacity-80 group-hover:w-[5px] group-hover:opacity-100 transition-all duration-300`}
                  style={{
                    background: `linear-gradient(to bottom, ${statusColor}, ${priorityColor})`,
                    boxShadow: `0 0 8px ${statusColor}30`,
                  }}
                />

                {/* Content container */}
                <div className="flex flex-col h-full p-4">
                  {/* Header with badges and actions */}
                  <div className="flex items-start justify-between mb-3 pl-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status badge */}
                      <Badge
                        variant="secondary"
                        className="text-xs font-medium px-2 py-1 rounded-md"
                        style={{
                          backgroundColor: `${statusColor}20`,
                          color: statusColor,
                          border: `1px solid ${statusColor}30`,
                        }}
                      >
                        {epic.status.toUpperCase()}
                      </Badge>

                      {/* MVP flag */}
                      {epic.mvp_flag && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="destructive" className="text-xs font-medium px-2 py-1 rounded-md">
                              <Flag className="w-3 h-3 mr-1" />
                              MVP
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Minimum Viable Product feature</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Priority badge */}
                      {epic.priority !== "medium" && (
                        <Badge
                          variant="outline"
                          className="text-xs font-medium px-2 py-1 rounded-md"
                          style={{
                            borderColor: priorityColor,
                            color: priorityColor,
                          }}
                        >
                          {String(epic.priority || "").toUpperCase()}
                        </Badge>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      {onViewStories && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewStories();
                              }}
                              className="h-6 w-6 p-0 hover:bg-white/20 dark:hover:bg-white/10"
                            >
                              <ChevronRight className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View Stories</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleToggleExpand}
                        className="h-6 w-6 p-0 hover:bg-white/20 dark:hover:bg-white/10"
                      >
                        <span className="text-sm">📊</span>
                      </Button>

                      {/* Context menu with edit/delete options */}
                      {(onEdit || onDelete) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 w-7 p-0 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 flex items-center justify-center"
                            >
                              <span className="text-xs">⋮</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            {onEdit && (
                              <DropdownMenuItem onClick={handleEdit} className="cursor-pointer">
                                <span className="text-xs mr-2">✏️</span>
                                Edit Epic
                              </DropdownMenuItem>
                            )}
                            {onEdit && onDelete && <DropdownMenuSeparator />}
                            {onDelete && (
                              <DropdownMenuItem
                                onClick={handleDelete}
                                className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                              >
                                <span className="text-xs mr-2">🗑️</span>
                                Delete Epic
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3
                    className="text-sm font-semibold text-gray-900 dark:text-white mb-2 pl-1 line-clamp-2 overflow-hidden leading-tight"
                    title={epic.title}
                  >
                    {epic.title}
                  </h3>

                  {/* Description */}
                  {epic.description && (
                    <div className="pl-1 mb-3 flex-1">
                      <p
                        className={`text-xs text-gray-600 dark:text-gray-400 ${
                          isExpanded ? "" : "line-clamp-2"
                        } break-words whitespace-pre-wrap opacity-80`}
                      >
                        {epic.description}
                      </p>
                    </div>
                  )}

                  {/* Progress section */}
                  {showProgress && (
                    <div className="pl-1 mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Progress</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {Math.round(progressPercentage)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${progressPercentage}%`,
                            background: `linear-gradient(90deg, ${statusColor}, ${priorityColor})`,
                            boxShadow: `0 0 4px ${statusColor}40`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expanded metrics */}
                  {isExpanded && (
                    <div className="pl-1 mb-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <Users className="w-3 h-3" />
                        <span>
                          Stories: {(() => {
                            const counts = storyCounts?.[epic.id];
                            if (!counts) return "0";
                            return (
                              counts.todo +
                              counts.doing +
                              counts.review +
                              counts.waiting +
                              counts.done
                            ).toString();
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <BarChart3 className="w-3 h-3" />
                        <span>Tasks: 0</span> {/* Will be populated from metrics */}
                      </div>
                    </div>
                  )}

                  {/* Footer with timestamps */}
                  <div className="flex items-center justify-between mt-auto pt-2 pl-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>Created: {new Date(epic.created_at).toLocaleDateString()}</span>
                    {epic.updated_at !== epic.created_at && (
                      <span>Updated: {new Date(epic.updated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </HierarchicalDropZone>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to view Stories</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
