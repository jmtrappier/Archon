import { Filter, LayoutGrid, Plus, Table } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useSearchParams } from "react-router-dom";
import { DeleteConfirmModal } from "../../ui/components/DeleteConfirmModal";
import { Button } from "../../ui/primitives";
import { cn, glassmorphism } from "../../ui/primitives/styles";
import { useProjectEpics } from "../epics/hooks/useEpicQueries";
import type { Epic } from "../epics/types";
import { EpicModal } from "../epics/components/EpicModal";
import { useProjectStories, useUpdateStoryStatus } from "../stories/hooks/useStoryQueries";
import type { Story, HierarchyStatus } from "../stories/types";
import { StoryModal } from "../stories/components/StoryModal";
import { ProjectStoriesBoard } from "../stories/components/ProjectStoriesBoard";
import { ProjectStoriesTable } from "../stories/components/ProjectStoriesTable";
import { TaskEditModal, TaskView } from "./components";
import { useDeleteTask, useProjectTasks, useUpdateTask } from "./hooks";
import type { Task } from "./types";
import { getReorderTaskOrder, ORDER_INCREMENT, validateTaskOrder } from "./utils";
import { BoardView, TableView } from "./views";

interface TasksTabProps {
  projectId: string;
}

type ViewFilter = 'all' | 'epics' | 'stories' | 'tasks';

export const TasksTab = ({ projectId }: TasksTabProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"table" | "board">("board");
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');

  // Sync with URL parameters
  useEffect(() => {
    const urlView = searchParams.get('view');
    const urlFilter = searchParams.get('filter');

    if (urlView === 'table' || urlView === 'board') {
      setViewMode(urlView);
    }

    if (urlFilter === 'epics' || urlFilter === 'stories' || urlFilter === 'tasks' || urlFilter === 'all') {
      setViewFilter(urlFilter);
    }
  }, [searchParams]);

  // Update URL when view or filter changes
  const handleViewModeChange = useCallback((mode: 'table' | 'board') => {
    setViewMode(mode);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('view', mode);
      return newParams;
    });
  }, [setSearchParams]);

  const handleFilterChange = useCallback((filter: ViewFilter) => {
    setViewFilter(filter);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('filter', filter);
      return newParams;
    });
  }, [setSearchParams]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null); // For detailed task view

  // Epic modal state
  const [isEpicModalOpen, setIsEpicModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);

  // Story modal state
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [selectedEpicForStory, setSelectedEpicForStory] = useState<string | null>(null);
  const [editingStory, setEditingStory] = useState<Story | null>(null);

  // Fetch tasks, epics and stories using TanStack Query
  const { data: tasks = [], isLoading: isLoadingTasks } = useProjectTasks(projectId);
  const { data: epics = [], isLoading: isLoadingEpics } = useProjectEpics(projectId);
  const { data: stories = [], isLoading: isLoadingStories } = useProjectStories(projectId);
  const updateStoryStatusMutation = useUpdateStoryStatus();

  // Mutations for task operations
  const updateTaskMutation = useUpdateTask(projectId);
  const deleteTaskMutation = useDeleteTask(projectId);

  // Modal management functions
  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const openTaskView = (task: Task) => {
    setViewingTask(task);
  };

  const closeTaskView = () => {
    setViewingTask(null);
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingTask(null);
    setIsModalOpen(false);
  };

  // Epic modal management functions
  const openCreateEpicModal = () => {
    setEditingEpic(null);
    setIsEpicModalOpen(true);
  };

  const closeEpicModal = () => {
    setEditingEpic(null);
    setIsEpicModalOpen(false);
  };

  const handleEpicSaved = () => {
    setIsEpicModalOpen(false);
    setEditingEpic(null);
  };

  // Epic edit and delete handlers
  const handleEpicEdit = (epic: Epic) => {
    setEditingEpic(epic);
    setIsEpicModalOpen(true);
  };

  const handleEpicDelete = (epic: Epic) => {
    // For now, we'll just show the Epic edit modal - delete functionality can be added later
    console.log('Epic delete requested for:', epic.title);
    // TODO: Implement Epic delete functionality
  };

  const handleEpicViewStories = (epic: Epic) => {
    // Navigate to epic stories view
    window.location.href = `/projects/${projectId}/epics/${epic.id}/stories`;
  };

  // Story modal management functions
  const openCreateStoryModal = () => {
    // For Kanban usage, we don't pre-select an epic - let the modal handle it
    setSelectedEpicForStory(null);
    setEditingStory(null);
    setIsStoryModalOpen(true);
  };

  const closeStoryModal = () => {
    setSelectedEpicForStory(null);
    setEditingStory(null);
    setIsStoryModalOpen(false);
  };

  const handleStorySaved = () => {
    setIsStoryModalOpen(false);
    setSelectedEpicForStory(null);
    setEditingStory(null);
  };

  const handleStoryEdit = useCallback((story: Story) => {
    setEditingStory(story);
    setSelectedEpicForStory(story.epic_id);
    setIsStoryModalOpen(true);
  }, []);

  const handleStoryMove = useCallback((storyId: string, newStatus: HierarchyStatus) => {
    updateStoryStatusMutation.mutate({ storyId, status: newStatus });
  }, [updateStoryStatusMutation]);

  // Delete modal management functions
  const openDeleteModal = (task: Task) => {
    setTaskToDelete(task);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setTaskToDelete(null);
    setShowDeleteModal(false);
  };

  const confirmDeleteTask = () => {
    if (!taskToDelete) return;

    deleteTaskMutation.mutate(taskToDelete.id, {
      onSuccess: () => {
        closeDeleteModal();
      },
      onError: (error) => {
        console.error("Failed to delete task:", error);
      },
    });
  };

  // Get default order for new tasks in a status
  const getDefaultTaskOrder = useCallback((statusTasks: Task[]) => {
    if (statusTasks.length === 0) return ORDER_INCREMENT;
    const maxOrder = Math.max(...statusTasks.map((t) => t.task_order));
    return maxOrder + ORDER_INCREMENT;
  }, []);

  // Task reordering - immediate update
  const handleTaskReorder = useCallback(
    async (taskId: string, targetIndex: number, status: Task["status"]) => {
      // Get all tasks in the target status, sorted by current order
      const statusTasks = (tasks as Task[])
        .filter((task) => task.status === status)
        .sort((a, b) => a.task_order - b.task_order);

      const movingTaskIndex = statusTasks.findIndex((task) => task.id === taskId);
      if (movingTaskIndex === -1 || targetIndex < 0 || targetIndex > statusTasks.length) return;
      if (movingTaskIndex === targetIndex) return;

      // Calculate new position using battle-tested utility
      const newPosition = getReorderTaskOrder(statusTasks, taskId, targetIndex);

      // Update immediately with optimistic updates
      try {
        await updateTaskMutation.mutateAsync({
          taskId,
          updates: {
            task_order: newPosition,
          },
        });
      } catch (error) {
        console.error("Failed to reorder task:", error, {
          taskId,
          newPosition,
        });
        // Error toast handled by mutation
      }
    },
    [tasks, updateTaskMutation],
  );

  // Move task to different status
  const moveTask = useCallback(
    async (taskId: string, newStatus: Task["status"]) => {
      const movingTask = (tasks as Task[]).find((task) => task.id === taskId);
      if (!movingTask || movingTask.status === newStatus) return;

      try {
        // Calculate position for new status
        const tasksInNewStatus = (tasks as Task[]).filter((t) => t.status === newStatus);
        const newOrder = getDefaultTaskOrder(tasksInNewStatus);

        // Update via mutation (handles optimistic updates)
        await updateTaskMutation.mutateAsync({
          taskId,
          updates: {
            status: newStatus,
            task_order: newOrder,
          },
        });

        // Success handled by mutation
      } catch (error) {
        console.error("Failed to move task:", error, { taskId, newStatus });
        // Error toast handled by mutation
      }
    },
    [tasks, updateTaskMutation, getDefaultTaskOrder],
  );

  const completeTask = useCallback(
    (taskId: string) => {
      moveTask(taskId, "done");
    },
    [moveTask],
  );

  // Inline update for task fields
  const updateTaskInline = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Validate task_order if present (ensures integer precision)
      const processedUpdates = { ...updates };
      if (processedUpdates.task_order !== undefined) {
        processedUpdates.task_order = validateTaskOrder(processedUpdates.task_order);
      }

      await updateTaskMutation.mutateAsync({
        taskId,
        updates: processedUpdates,
      });
    } catch (error) {
      console.error("Failed to update task:", error, { taskId, updates });
      // Error toast handled by mutation
    }
  };



  const boardDataType: "epics" | "tasks" | "mixed" =
    viewFilter === "epics" ? "epics" : viewFilter === "tasks" ? "tasks" : "mixed";

  if (isLoadingTasks || isLoadingEpics || isLoadingStories) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-[70vh] relative">
        {/* Main content - Table or Board view */}
        <div className="relative h-[calc(100vh-220px)] overflow-auto">
          {viewMode === "table" ? (
            viewFilter === 'stories' ? (
              <ProjectStoriesTable
                stories={stories as Story[]}
                epics={epics as Epic[]}
                onStoryEdit={handleStoryEdit}
              />
            ) : (
              <TableView
                tasks={boardDataType === 'epics' ? [] : (tasks as Task[])}
                epics={boardDataType === 'tasks' ? [] : (epics as Epic[])}
                projectId={projectId}
                dataType={boardDataType}
                onTaskView={openTaskView}
                onTaskComplete={completeTask}
                onTaskDelete={openDeleteModal}
                onTaskReorder={handleTaskReorder}
                onTaskUpdate={updateTaskInline}
              />
            )
          ) : (
            viewFilter === 'stories' ? (
              <ProjectStoriesBoard
                stories={stories as Story[]}
                onStoryMove={handleStoryMove}
                onStoryEdit={handleStoryEdit}
              />
            ) : (
              <BoardView
                tasks={boardDataType === 'epics' ? [] : (tasks as Task[])}
                epics={boardDataType === 'tasks' ? [] : (epics as Epic[])}
                projectId={projectId}
                dataType={boardDataType}
                onTaskMove={moveTask}
                onTaskReorder={handleTaskReorder}
                onTaskEdit={openTaskView}
                onTaskDelete={openDeleteModal}
                onEpicEdit={handleEpicEdit}
                onEpicDelete={handleEpicDelete}
                onEpicViewStories={handleEpicViewStories}
              />
            )
          )}
        </div>

        {/* Fixed View Controls using Radix primitives */}
        <ViewControls
          viewMode={viewMode}
          viewFilter={viewFilter}
          onViewChange={handleViewModeChange}
          onFilterChange={handleFilterChange}
          onAddTask={openCreateModal}
          onAddEpic={openCreateEpicModal}
          onAddStory={openCreateStoryModal}
        />

        {/* Edit/Create Task Modal */}
        <TaskEditModal isModalOpen={isModalOpen} editingTask={editingTask} projectId={projectId} onClose={closeModal} />

        {/* Delete Task Modal */}
        <DeleteConfirmModal
          open={showDeleteModal}
          itemName={taskToDelete?.title || ""}
          onConfirm={confirmDeleteTask}
          onCancel={closeDeleteModal}
          onOpenChange={setShowDeleteModal}
          type="task"
          size="compact"
        />

        {/* Detailed Task View */}
        {viewingTask && (
          <TaskView
            task={viewingTask}
            projectId={projectId}
            onClose={closeTaskView}
            onTaskUpdate={updateTaskInline}
            onTaskDelete={openDeleteModal}
            isModal={true}
          />
        )}

        {/* Epic Modal */}
        <EpicModal
          isOpen={isEpicModalOpen}
          projectId={projectId}
          editingEpic={editingEpic}
          onClose={closeEpicModal}
          onSaved={handleEpicSaved}
        />

        {/* Story Modal */}
        <StoryModal
          isOpen={isStoryModalOpen}
          epicId={selectedEpicForStory}
          projectId={projectId}
          editingStory={editingStory ?? undefined}
          onClose={closeStoryModal}
          onSaved={handleStorySaved}
        />
      </div>
    </DndProvider>
  );
};

// Extracted ViewControls component using Radix primitives
interface ViewControlsProps {
  viewMode: "table" | "board";
  viewFilter: ViewFilter;
  onViewChange: (mode: "table" | "board") => void;
  onFilterChange: (filter: ViewFilter) => void;
  onAddTask: () => void;
  onAddEpic: () => void;
  onAddStory: () => void;
}

const ViewControls = ({ viewMode, viewFilter, onViewChange, onFilterChange, onAddTask, onAddEpic, onAddStory }: ViewControlsProps) => {
  const filterOptions = [
    { value: 'all' as ViewFilter, label: 'All', icon: '🎯' },
    { value: 'epics' as ViewFilter, label: 'EPICs', icon: '📋' },
    { value: 'stories' as ViewFilter, label: 'Stories', icon: '📖' },
    { value: 'tasks' as ViewFilter, label: 'Tasks', icon: '✅' },
  ];
  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <div className="flex items-center gap-4">
        {/* Filter Controls */}
        <div
          className={cn(
            "flex items-center overflow-hidden pointer-events-auto",
            glassmorphism.background.subtle,
            glassmorphism.border.default,
            glassmorphism.shadow.elevated,
            "rounded-lg",
          )}
        >
          {filterOptions.map((option, index) => (
            <React.Fragment key={option.value}>
              <button
                type="button"
                onClick={() => onFilterChange(option.value)}
                className={cn(
                  "px-3 py-2.5 flex items-center gap-2 relative transition-all duration-300 text-sm",
                  viewFilter === option.value
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300",
                )}
              >
                <span className="text-xs">{option.icon}</span>
                <span className="hidden sm:inline">{option.label}</span>
                {viewFilter === option.value && (
                  <span
                    className={cn(
                      "absolute bottom-0 left-[10%] right-[10%] w-[80%] mx-auto h-[2px]",
                      "bg-emerald-500",
                      "shadow-[0_0_10px_2px_rgba(16,185,129,0.4)]",
                      "dark:shadow-[0_0_20px_5px_rgba(16,185,129,0.7)]",
                    )}
                  />
                )}
              </button>
              {index < filterOptions.length - 1 && (
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-700" />
              )}
            </React.Fragment>
          ))}
        </div>
        {/* Add Buttons with Glassmorphism - Conditional based on filter */}
        <div className="flex items-center gap-2">
          {/* Add Epic Button - show for 'epics' or 'all' filter */}
          {(viewFilter === 'epics' || viewFilter === 'all') && (
            <Button
              onClick={onAddEpic}
              variant="outline"
              className={cn(
                "pointer-events-auto relative",
                glassmorphism.background.subtle,
                glassmorphism.border.default,
                glassmorphism.shadow.elevated,
                "text-purple-600 dark:text-purple-400",
                "hover:text-purple-700 dark:hover:text-purple-300",
                "transition-all duration-300",
              )}
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>Add Epic</span>
              {/* Glow effect */}
              <span
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-[2px]",
                  "bg-gradient-to-r from-transparent via-purple-500 to-transparent",
                  "shadow-[0_0_10px_2px_rgba(168,85,247,0.4)]",
                  "dark:shadow-[0_0_20px_5px_rgba(168,85,247,0.7)]",
                )}
              />
            </Button>
          )}

          {/* Add Story Button - show for 'stories' or 'all' filter */}
          {(viewFilter === 'stories' || viewFilter === 'all') && (
            <Button
              onClick={onAddStory}
              variant="outline"
              className={cn(
                "pointer-events-auto relative",
                glassmorphism.background.subtle,
                glassmorphism.border.default,
                glassmorphism.shadow.elevated,
                "text-orange-600 dark:text-orange-400",
                "hover:text-orange-700 dark:hover:text-orange-300",
                "transition-all duration-300",
              )}
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>Add Story</span>
              {/* Glow effect */}
              <span
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-[2px]",
                  "bg-gradient-to-r from-transparent via-orange-500 to-transparent",
                  "shadow-[0_0_10px_2px_rgba(251,146,60,0.4)]",
                  "dark:shadow-[0_0_20px_5px_rgba(251,146,60,0.7)]",
                )}
              />
            </Button>
          )}

          {/* Add Task Button - show for 'tasks' or 'all' filter */}
          {(viewFilter === 'tasks' || viewFilter === 'all') && (
            <Button
              onClick={onAddTask}
              variant="outline"
              className={cn(
                "pointer-events-auto relative",
                glassmorphism.background.subtle,
                glassmorphism.border.default,
                glassmorphism.shadow.elevated,
                "text-cyan-600 dark:text-cyan-400",
                "hover:text-cyan-700 dark:hover:text-cyan-300",
                "transition-all duration-300",
              )}
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>Add Task</span>
              {/* Glow effect */}
              <span
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-[2px]",
                  "bg-gradient-to-r from-transparent via-cyan-500 to-transparent",
                  "shadow-[0_0_10px_2px_rgba(34,211,238,0.4)]",
                  "dark:shadow-[0_0_20px_5px_rgba(34,211,238,0.7)]",
                )}
              />
            </Button>
          )}
        </div>

        {/* View Toggle Controls with Glassmorphism */}
        <div
          className={cn(
            "flex items-center overflow-hidden pointer-events-auto",
            glassmorphism.background.subtle,
            glassmorphism.border.default,
            glassmorphism.shadow.elevated,
            "rounded-lg",
          )}
        >
          <button
            type="button"
            onClick={() => onViewChange("table")}
            className={cn(
              "px-5 py-2.5 flex items-center gap-2 relative transition-all duration-300",
              viewMode === "table"
                ? "text-cyan-600 dark:text-cyan-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300",
            )}
          >
            <Table className="w-4 h-4" />
            <span>Table</span>
            {viewMode === "table" && (
              <span
                className={cn(
                  "absolute bottom-0 left-[15%] right-[15%] w-[70%] mx-auto h-[2px]",
                  "bg-cyan-500",
                  "shadow-[0_0_10px_2px_rgba(34,211,238,0.4)]",
                  "dark:shadow-[0_0_20px_5px_rgba(34,211,238,0.7)]",
                )}
              />
            )}
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700" />
          <button
            type="button"
            onClick={() => onViewChange("board")}
            className={cn(
              "px-5 py-2.5 flex items-center gap-2 relative transition-all duration-300",
              viewMode === "board"
                ? "text-purple-600 dark:text-purple-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300",
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Board</span>
            {viewMode === "board" && (
              <span
                className={cn(
                  "absolute bottom-0 left-[15%] right-[15%] w-[70%] mx-auto h-[2px]",
                  "bg-purple-500",
                  "shadow-[0_0_10px_2px_rgba(168,85,247,0.4)]",
                  "dark:shadow-[0_0_20px_5px_rgba(168,85,247,0.7)]",
                )}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
