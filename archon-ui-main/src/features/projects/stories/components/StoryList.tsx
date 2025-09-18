import { BarChart3, Filter, Grid, List, Plus, Search } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { Input } from "../../../ui/primitives/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/primitives/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/primitives/tooltip";
import { useEpicStories, useReorderStoriesInEpic, useUpdateStoryStatus } from "../hooks/useStoryQueries";
import type { HierarchyStatus, Priority, Story, StoryFilters, StoryWithEpic } from "../types";
import { STORY_PRIORITY_ORDER, STORY_STATUS_ORDER } from "../utils/story-styles";
import { StoryCard } from "./StoryCard";

export interface StoryListProps {
  epicId: string;
  onCreateStory?: () => void;
  onEditStory?: (story: Story | StoryWithEpic) => void;
  onDeleteStory?: (story: Story | StoryWithEpic) => void;
  onViewTasks?: (story: Story | StoryWithEpic) => void;
  showEpicContext?: boolean;
  className?: string;
  compact?: boolean;
  viewMode?: "grid" | "list" | "kanban";
}

export const StoryList: React.FC<StoryListProps> = ({
  epicId,
  onCreateStory,
  onEditStory,
  onDeleteStory,
  onViewTasks,
  showEpicContext = false,
  className = "",
  compact = false,
  viewMode = "grid",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<HierarchyStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [mvpOnly, setMvpOnly] = useState(false);
  const [hoveredStoryId, setHoveredStoryId] = useState<string | null>(null);
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set());

  // Fetch stories
  const { data: stories = [], isLoading, error } = useEpicStories(epicId);
  const updateStoryStatus = useUpdateStoryStatus(epicId);
  const reorderStoriesInEpic = useReorderStoriesInEpic(epicId);

  // Filter and sort stories
  const filteredStories = useMemo(() => {
    let filtered = [...stories];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (story) => story.title.toLowerCase().includes(term) || story.description?.toLowerCase().includes(term),
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((story) => story.status === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter((story) => story.priority === priorityFilter);
    }

    // Apply MVP filter
    if (mvpOnly) {
      filtered = filtered.filter((story) => story.mvp_flag);
    }

    // Sort by priority then by status
    filtered.sort((a, b) => {
      const aPriority = STORY_PRIORITY_ORDER.indexOf(a.priority || "medium");
      const bPriority = STORY_PRIORITY_ORDER.indexOf(b.priority || "medium");
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      const aStatus = STORY_STATUS_ORDER.indexOf(a.status);
      const bStatus = STORY_STATUS_ORDER.indexOf(b.status);
      return aStatus - bStatus;
    });

    return filtered;
  }, [stories, searchTerm, statusFilter, priorityFilter, mvpOnly]);

  // Group stories by status for kanban view
  const storiesByStatus = useMemo(() => {
    if (viewMode !== "kanban") return {};

    return STORY_STATUS_ORDER.reduce(
      (acc, status) => {
        acc[status] = filteredStories.filter((story) => story.status === status);
        return acc;
      },
      {} as Record<HierarchyStatus, Story[]>,
    );
  }, [filteredStories, viewMode]);

  // Handlers
  const handleStoryReorder = useCallback(
    (storyId: string, targetIndex: number, status: HierarchyStatus) => {
      const statusStories =
        viewMode === "kanban" ? storiesByStatus[status] || [] : filteredStories.filter((s) => s.status === status);

      const newOrder = [...statusStories];
      const currentIndex = newOrder.findIndex((story) => story.id === storyId);

      if (currentIndex !== -1) {
        const [movedStory] = newOrder.splice(currentIndex, 1);
        newOrder.splice(targetIndex, 0, movedStory);

        // Update server with new order
        reorderStoriesInEpic.mutate(newOrder.map((s) => s.id));
      }
    },
    [filteredStories, storiesByStatus, viewMode, reorderStoriesInEpic],
  );

  const handleStorySelect = useCallback((storyId: string) => {
    setSelectedStories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(storyId)) {
        newSet.delete(storyId);
      } else {
        newSet.add(storyId);
      }
      return newSet;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setMvpOnly(false);
  }, []);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: stories.length,
      filtered: filteredStories.length,
      todo: stories.filter((s) => s.status === "todo").length,
      doing: stories.filter((s) => s.status === "doing").length,
      review: stories.filter((s) => s.status === "review").length,
      waiting: stories.filter((s) => s.status === "waiting").length,
      done: stories.filter((s) => s.status === "done").length,
      mvp: stories.filter((s) => s.mvp_flag).length,
    };
  }, [stories, filteredStories]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-48 text-red-500">
        <p>Error loading stories: {error.message}</p>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <TooltipProvider>
        <div className={`space-y-4 ${className}`}>
          {/* Header with filters and actions */}
          <div className="flex flex-col space-y-4">
            {/* Top row: Title, stats, and create button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Stories ({stats.filtered})</h2>

                {/* Quick stats */}
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    Todo: {stats.todo}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Doing: {stats.doing}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Done: {stats.done}
                  </Badge>
                  {stats.mvp > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      MVP: {stats.mvp}
                    </Badge>
                  )}
                </div>
              </div>

              {onCreateStory && (
                <Button onClick={onCreateStory} size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Story
                </Button>
              )}
            </div>

            {/* Filters row */}
            <div className="flex items-center space-x-3">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search stories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={(value: HierarchyStatus | "all") => setStatusFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="doing">Doing</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority filter */}
              <Select value={priorityFilter} onValueChange={(value: Priority | "all") => setPriorityFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              {/* MVP filter */}
              <Button variant={mvpOnly ? "default" : "outline"} size="sm" onClick={() => setMvpOnly(!mvpOnly)}>
                MVP Only
              </Button>

              {/* Clear filters */}
              {(searchTerm || statusFilter !== "all" || priorityFilter !== "all" || mvpOnly) && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filteredStories.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <BarChart3 className="w-12 h-12 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {stories.length === 0 ? "No stories yet" : "No stories match your filters"}
              </h3>
              <p className="text-center mb-4">
                {stories.length === 0
                  ? "Create your first story to get started with this epic."
                  : "Try adjusting your filters or clearing them to see more stories."}
              </p>
              {stories.length === 0 && onCreateStory && (
                <Button onClick={onCreateStory} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create First Story
                </Button>
              )}
            </div>
          )}

          {/* Kanban view */}
          {viewMode === "kanban" && !isLoading && filteredStories.length > 0 && (
            <div className="grid grid-cols-5 gap-4">
              {STORY_STATUS_ORDER.map((status) => (
                <div key={status} className="space-y-3">
                  <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 capitalize">
                    {status} ({storiesByStatus[status]?.length || 0})
                  </h3>
                  <div className="space-y-3">
                    {storiesByStatus[status]?.map((story, index) => (
                      <StoryCard
                        key={story.id}
                        story={story}
                        index={index}
                        epicId={epicId}
                        onStoryReorder={handleStoryReorder}
                        onEdit={onEditStory}
                        onDelete={onDeleteStory}
                        onViewTasks={onViewTasks}
                        hoveredStoryId={hoveredStoryId}
                        onStoryHover={setHoveredStoryId}
                        selectedStories={selectedStories}
                        onStorySelect={handleStorySelect}
                        showEpicContext={showEpicContext}
                        compact={compact}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grid/List view */}
          {(viewMode === "grid" || viewMode === "list") && !isLoading && filteredStories.length > 0 && (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "space-y-3"
              }
            >
              {filteredStories.map((story, index) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  index={index}
                  epicId={epicId}
                  onStoryReorder={handleStoryReorder}
                  onEdit={onEditStory}
                  onDelete={onDeleteStory}
                  onViewTasks={onViewTasks}
                  hoveredStoryId={hoveredStoryId}
                  onStoryHover={setHoveredStoryId}
                  selectedStories={selectedStories}
                  onStorySelect={handleStorySelect}
                  showEpicContext={showEpicContext}
                  compact={viewMode === "list" || compact}
                />
              ))}
            </div>
          )}
        </div>
      </TooltipProvider>
    </DndProvider>
  );
};
