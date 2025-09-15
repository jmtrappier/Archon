import { BarChart3, ChevronRight, Flag, Users, ExternalLink } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/primitives/tooltip";
import {
  HierarchicalDropZone,
  HierarchicalDragWrapper,
  HierarchicalItemTypes,
  type DraggedTask,
  useHierarchicalDragDrop
} from "../../tasks/components/HierarchicalDragDrop";
import { useUpdateStoryStatus } from "../hooks/useStoryQueries";
import type { Story, StoryWithEpic, HierarchyStatus, Priority } from "../types";
import {
  getStoryStatusColor,
  getStoryPriorityColor,
  StoryItemTypes,
  getStorySizeClass,
  STORY_HOVER_EFFECTS,
  STORY_TRANSITIONS,
  STORY_GLASSMORPHISM,
  getStoryEpicBadgeColor,
  STORY_MVP_STYLES,
} from "../utils/story-styles";

export interface StoryCardProps {
  story: Story | StoryWithEpic;
  index: number;
  epicId: string;
  onStoryReorder: (storyId: string, targetIndex: number, status: HierarchyStatus) => void;
  onEdit?: (story: Story | StoryWithEpic) => void;
  onDelete?: (story: Story | StoryWithEpic) => void;
  onViewTasks?: (story: Story | StoryWithEpic) => void;
  hoveredStoryId?: string | null;
  onStoryHover?: (storyId: string | null) => void;
  selectedStories?: Set<string>;
  onStorySelect?: (storyId: string) => void;
  showProgress?: boolean;
  showEpicContext?: boolean; // Show epic info if story has epic context
  compact?: boolean;
}

export const StoryCard: React.FC<StoryCardProps> = ({
  story,
  index,
  epicId,
  onStoryReorder,
  onEdit,
  onDelete,
  onViewTasks,
  hoveredStoryId,
  onStoryHover,
  selectedStories,
  onStorySelect,
  showProgress = true,
  showEpicContext = false,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use React Query hook for status updates
  const updateStoryStatus = useUpdateStoryStatus(epicId);

  // Check if story has epic context
  const storyWithEpic = story as StoryWithEpic;
  const hasEpicContext = showEpicContext && storyWithEpic.epic;

  // Handlers
  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit(story);
    }
  }, [onEdit, story]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(story);
    }
  }, [onDelete, story]);

  const handleViewTasks = useCallback(() => {
    if (onViewTasks) {
      onViewTasks(story);
    }
  }, [onViewTasks, story]);

  const handleStatusChange = useCallback((newStatus: HierarchyStatus) => {
    updateStoryStatus.mutate({ storyId: story.id, status: newStatus });
  }, [updateStoryStatus, story.id]);

  // Hierarchical drag & drop functionality
  const { moveTaskToStory } = useHierarchicalDragDrop();

  // Handle task drop on story
  const handleTaskDrop = useCallback(async (draggedItem: DraggedTask, targetId: string) => {
    if (draggedItem.type === HierarchicalItemTypes.TASK) {
      await moveTaskToStory(draggedItem.id, targetId);
    }
  }, [moveTaskToStory]);

  // Drag and Drop
  const [{ isDragging }, drag] = useDrag({
    type: HierarchicalItemTypes.STORY,
    item: {
      type: HierarchicalItemTypes.STORY,
      id: story.id,
      title: story.title,
      epicId: epicId,
      projectId: story.project_id
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: StoryItemTypes.STORY,
    hover: (draggedItem: { id: string; status: HierarchyStatus; index: number }, monitor) => {
      if (!monitor.isOver({ shallow: true })) return;
      if (draggedItem.id === story.id) return;
      if (draggedItem.status !== story.status) return;

      const draggedIndex = draggedItem.index;
      const hoveredIndex = index;

      if (draggedIndex === hoveredIndex) return;

      // Move the story immediately for visual feedback
      onStoryReorder(draggedItem.id, hoveredIndex, story.status);

      // Update the dragged item's index
      draggedItem.index = hoveredIndex;
    },
  });

  const isHighlighted = hoveredStoryId === story.id;
  const isSelected = selectedStories?.has(story.id) || false;

  const handleMouseEnter = () => {
    onStoryHover?.(story.id);
  };

  const handleMouseLeave = () => {
    onStoryHover?.(null);
  };

  const handleStoryClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      onStorySelect?.(story.id);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Styling calculations
  const progressPercentage = story.progress || 0;
  const statusColor = getStoryStatusColor(story.status);
  const priorityColor = getStoryPriorityColor(story.priority || "medium");
  const epicBadgeColor = hasEpicContext ? getStoryEpicBadgeColor(storyWithEpic.epic.title) : "";

  // Size class based on compact mode and content
  const sizeClass = compact
    ? "min-h-[80px]"
    : getStorySizeClass(!!story.description, isExpanded);

  // Glassmorphism styling
  const cardBaseStyles = STORY_GLASSMORPHISM.card;
  const transitionStyles = STORY_TRANSITIONS.all;

  const highlightGlow = isHighlighted ? "border-blue-400/60 shadow-[0_0_12px_rgba(59,130,246,0.3)]" : "";
  const selectionGlow = isSelected
    ? "border-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.5)] bg-blue-50/40 dark:bg-blue-900/30"
    : "";

  const hoverEffectClasses = STORY_HOVER_EFFECTS.card;

  return (
    <TooltipProvider>
      <HierarchicalDropZone
        type="story"
        targetId={story.id}
        onDrop={handleTaskDrop}
        acceptedTypes={[HierarchicalItemTypes.TASK]}
        className="relative"
      >
        <HierarchicalDragWrapper
          item={{
            type: HierarchicalItemTypes.STORY,
            id: story.id,
            title: story.title,
            epicId: epicId,
            projectId: story.project_id
          }}
        >
          <div
            ref={(node) => drag(drop(node))}
            role="button"
            tabIndex={0}
        className={`w-full ${sizeClass} cursor-move relative ${
          isDragging ? "opacity-60 scale-95" : "scale-100 opacity-100"
        } ${transitionStyles} group`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleStoryClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (onEdit) {
              onEdit(story);
            }
          }
        }}
      >
        <div
          className={`${cardBaseStyles} ${transitionStyles} ${hoverEffectClasses} ${highlightGlow} ${selectionGlow} w-full ${sizeClass} h-full overflow-hidden border border-gray-200 dark:border-gray-700 rounded-xl`}
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
          <div className={`flex flex-col h-full ${compact ? 'p-2' : 'p-4'}`}>
            {/* Header with badges and actions */}
            <div className="flex items-start justify-between mb-3 pl-1">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Epic context badge (if available and enabled) */}
                {hasEpicContext && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge
                        variant="outline"
                        className="text-xs font-medium px-2 py-1 rounded-md"
                        style={{
                          backgroundColor: `${epicBadgeColor}15`,
                          borderColor: `${epicBadgeColor}40`,
                          color: epicBadgeColor,
                        }}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        {storyWithEpic.epic.title.length > 15
                          ? `${storyWithEpic.epic.title.substring(0, 15)}...`
                          : storyWithEpic.epic.title}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Epic: {storyWithEpic.epic.title}</p>
                    </TooltipContent>
                  </Tooltip>
                )}

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
                  {story.status.toUpperCase()}
                </Badge>

                {/* MVP flag */}
                {story.mvp_flag && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge
                        variant="destructive"
                        className={`text-xs font-medium px-2 py-1 rounded-md ${STORY_MVP_STYLES.flag}`}
                      >
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
                {story.priority !== "medium" && (
                  <Badge
                    variant="outline"
                    className="text-xs font-medium px-2 py-1 rounded-md"
                    style={{
                      borderColor: priorityColor,
                      color: priorityColor,
                    }}
                  >
                    {story.priority?.toUpperCase()}
                  </Badge>
                )}
              </div>

              {/* Action buttons */}
              <div className={`flex items-center gap-1 ${STORY_HOVER_EFFECTS.actions} transition-opacity duration-200`}>
                {onViewTasks && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewTasks();
                        }}
                        className="h-6 w-6 p-0 hover:bg-white/20 dark:hover:bg-white/10"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Tasks</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {!compact && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleExpand}
                    className="h-6 w-6 p-0 hover:bg-white/20 dark:hover:bg-white/10"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Title */}
            <h3
              className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-gray-900 dark:text-white mb-2 pl-1 line-clamp-2 overflow-hidden leading-tight`}
              title={story.title}
            >
              {story.title}
            </h3>

            {/* Description */}
            {story.description && !compact && (
              <div className="pl-1 mb-3 flex-1">
                <p
                  className={`text-xs text-gray-600 dark:text-gray-400 ${
                    isExpanded ? "" : "line-clamp-2"
                  } break-words whitespace-pre-wrap opacity-80`}
                >
                  {story.description}
                </p>
              </div>
            )}

            {/* Progress section */}
            {showProgress && !compact && (
              <div className="pl-1 mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Progress</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{Math.round(progressPercentage)}%</span>
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
            {isExpanded && !compact && (
              <div className="pl-1 mb-3 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Users className="w-3 h-3" />
                  <span>Tasks: 0</span> {/* Will be populated when tasks are implemented */}
                </div>
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <BarChart3 className="w-3 h-3" />
                  <span>Subtasks: 0</span> {/* Will be populated from metrics */}
                </div>
              </div>
            )}

            {/* Footer with timestamps */}
            {!compact && (
              <div className="flex items-center justify-between mt-auto pt-2 pl-1 text-xs text-gray-500 dark:text-gray-400">
                <span>Created: {new Date(story.created_at).toLocaleDateString()}</span>
                {story.updated_at !== story.created_at && (
                  <span>Updated: {new Date(story.updated_at).toLocaleDateString()}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
        </HierarchicalDragWrapper>
      </HierarchicalDropZone>
    </TooltipProvider>
  );
};