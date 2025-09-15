import React, { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, ListTodo, AlertCircle, Link2 } from "lucide-react";
import { HierarchyLayout } from "../../hierarchy/components/HierarchyLayout";
import { ProgressCard } from "../../hierarchy/components/ProgressCard";
import { HierarchyBreadcrumb } from "@/features/ui/components/navigation";
import { useProject } from "../../hooks/useProjectQueries";
import { useEpic } from "../../epics/hooks/useEpicQueries";
import { useStory } from "../hooks/useStoryQueries";
import { useProjectTasks } from "../../tasks/hooks/useTaskQueries";
import { TaskEditModal } from "../../tasks/components/TaskEditModal";
import { Button } from "@/features/ui/primitives/button";
import { Badge } from "@/features/ui/primitives/badge";
import { useToast } from "@/features/ui/hooks";

export const StoryDetailView: React.FC = () => {
  const { projectId, epicId, storyId } = useParams<{
    projectId: string;
    epicId: string;
    storyId: string;
  }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  // Fetch data
  const { data: project } = useProject(projectId!);
  const { data: epic } = useEpic(epicId!);
  const { data: story, isLoading: storyLoading, error: storyError } = useStory(storyId!);
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useProjectTasks(projectId!);

  // Filter only root tasks (not subtasks)
  const rootTasks = tasks.filter(t => !t.parent_task_id);

  // Calculate stats
  const totalTasks = rootTasks.length;
  const completedTasks = rootTasks.filter(t => t.status === "done").length;
  const totalSubtasks = rootTasks.reduce((sum, t) => sum + (t.subtask_count || 0), 0);
  const completedSubtasks = rootTasks.reduce((sum, t) => sum + (t.completed_subtasks || 0), 0);

  const handleBack = useCallback(() => {
    navigate(`/projects/${projectId}/epics/${epicId}`);
  }, [navigate, projectId, epicId]);

  const handleTaskClick = useCallback((taskId: string) => {
    navigate(`/projects/${projectId}/epics/${epicId}/stories/${storyId}/tasks/${taskId}`);
  }, [navigate, projectId, epicId, storyId]);

  const handleTaskEdit = useCallback((task: any) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  }, []);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    if (confirm("Are you sure you want to delete this task? This will also delete all its subtasks.")) {
      try {
        // TODO: Implement task deletion
        showToast("Task deletion not yet implemented", "info");
      } catch (error) {
        showToast("Failed to delete task", "error");
      }
    }
  }, [showToast]);

  const handleAddTask = useCallback(() => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  }, []);

  const handleTaskSaved = useCallback(() => {
    setIsTaskModalOpen(false);
    setEditingTask(null);
    showToast(editingTask ? "Task updated successfully" : "Task created successfully", "success");
  }, [editingTask, showToast]);

  const handleTaskSelect = useCallback((taskId: string, selected: boolean) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return newSet;
    });
  }, []);

  if (storyLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ListTodo className="h-12 w-12 text-gray-400 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading story...</p>
        </div>
      </div>
    );
  }

  if (storyError || tasksError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">
            Failed to load story data
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <HierarchyLayout
        level="story"
        title={`${story?.code}: ${story?.title}`}
        subtitle={story?.description}
        progress={story?.progress || 0}
        breadcrumb={
          <HierarchyBreadcrumb>
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {project?.title || "Project"}
            </button>
            <span className="mx-2 text-gray-400">/</span>
            <button
              onClick={() => navigate(`/projects/${projectId}/epics/${epicId}`)}
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {epic?.code}: {epic?.title}
            </button>
            <span className="mx-2 text-gray-400">/</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {story?.code}: {story?.title}
            </span>
          </HierarchyBreadcrumb>
        }
        onBack={handleBack}
        onAddNew={handleAddTask}
        addNewLabel="New Task"
        stats={[
          { label: "Tasks", value: totalTasks },
          { label: "Completed", value: completedTasks },
          { label: "Subtasks", value: totalSubtasks },
          { label: "Subtasks Done", value: completedSubtasks },
        ]}
      >
        {/* Story Details Section */}
        {story?.acceptance_criteria && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
              Acceptance Criteria
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
              {story.acceptance_criteria}
            </p>
          </div>
        )}

        {/* Dependencies Section */}
        {story?.dependencies && story.dependencies.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-2 flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Dependencies
            </h3>
            <div className="flex flex-wrap gap-2">
              {story.dependencies.map((dep: any, index: number) => (
                <Badge
                  key={index}
                  className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                >
                  {dep.type}: {dep.target}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {rootTasks.length === 0 ? (
          <div className="text-center py-12">
            <ListTodo className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No tasks yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Tasks are specific work items that need to be completed for this story.
              Create your first task to start implementation.
            </p>
            <Button onClick={handleAddTask} className="mx-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create First Task
            </Button>
          </div>
        ) : (
          <>
            {/* Bulk Actions Bar */}
            {selectedTasks.size > 0 && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {selectedTasks.size} task{selectedTasks.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedTasks(new Set())}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      showToast("Bulk operations not yet implemented", "info");
                    }}
                  >
                    Delete Selected
                  </Button>
                </div>
              </div>
            )}

            {/* Tasks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rootTasks.map((task) => (
                <ProgressCard
                  key={task.id}
                  level="task"
                  code={task.code || `T-${task.id.slice(0, 6)}`}
                  title={task.title}
                  description={task.description}
                  status={task.status}
                  progress={task.progress || 0}
                  priority={task.task_order}
                  assignee={task.assignee}
                  childCount={
                    task.subtask_count ? {
                      total: task.subtask_count,
                      completed: task.completed_subtasks || 0,
                      label: "Subtasks",
                    } : undefined
                  }
                  onClick={() => handleTaskClick(task.id)}
                  onEdit={() => handleTaskEdit(task)}
                  onDelete={() => handleTaskDelete(task.id)}
                  isSelected={selectedTasks.has(task.id)}
                  onSelect={(selected) => handleTaskSelect(task.id, selected)}
                />
              ))}
            </div>
          </>
        )}
      </HierarchyLayout>

      {/* Task Modal */}
      <TaskEditModal
        isOpen={isTaskModalOpen}
        projectId={projectId!}
        storyId={storyId}
        editingTask={editingTask}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSaved={handleTaskSaved}
      />
    </>
  );
};