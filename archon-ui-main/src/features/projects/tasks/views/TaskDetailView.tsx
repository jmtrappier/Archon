import React, { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plus,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  User,
  Edit2,
  Trash2
} from "lucide-react";
import { HierarchyLayout } from "../../hierarchy/components/HierarchyLayout";
import { useProject } from "../../hooks/useProjectQueries";
import { useEpic } from "../../epics/hooks/useEpicQueries";
import { useStory } from "../../stories/hooks/useStoryQueries";
import { useTask, useSubtasks, useUpdateTask } from "../hooks/useTaskQueries";
import { SubtaskEditModal } from "../components/SubtaskEditModal";
import { Button } from "@/features/ui/primitives/button";
import { Badge } from "@/features/ui/primitives/badge";
import { useToast } from "@/features/ui/hooks";

interface SubtaskItemProps {
  subtask: any;
  parentTask: any;
  onEdit: (subtask: any) => void;
  onDelete: (subtask: any) => void;
  onToggleComplete: (subtask: any) => void;
}

const SubtaskItem: React.FC<SubtaskItemProps> = ({
  subtask,
  parentTask,
  onEdit,
  onDelete,
  onToggleComplete,
}) => {
  const getStatusIcon = () => {
    switch (subtask.status) {
      case "done":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "doing":
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      case "review":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (subtask.status) {
      case "done":
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case "doing":
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
      case "review":
        return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700";
    }
  };

  return (
    <div className={`
      group p-4 rounded-lg border transition-all duration-200
      ${getStatusColor()}
      hover:shadow-md
    `}>
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <button
          onClick={() => onToggleComplete(subtask)}
          className="mt-0.5 transition-transform hover:scale-110"
          aria-label={`Mark ${subtask.status === "done" ? "incomplete" : "complete"}`}
        >
          {getStatusIcon()}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title and Parent Info */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className={`
                text-sm font-medium
                ${subtask.status === "done"
                  ? "text-gray-500 dark:text-gray-400 line-through"
                  : "text-gray-900 dark:text-white"}
              `}>
                {subtask.title}
              </h4>

              {/* Parent Task Badge */}
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs bg-gray-100 dark:bg-gray-700"
                >
                  Subtask of: {parentTask.code || parentTask.title}
                </Badge>

                {/* Assignee */}
                {subtask.assignee && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {subtask.assignee}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(subtask)}
                className="p-1"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(subtask)}
                className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Description */}
          {subtask.description && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
              {subtask.description}
            </p>
          )}

          {/* Status Badge */}
          <div className="mt-2">
            <Badge className={`text-xs ${
              subtask.status === "done" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
              subtask.status === "doing" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
              subtask.status === "review" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
              "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
            }`}>
              {subtask.status}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TaskDetailView: React.FC = () => {
  const { projectId, epicId, storyId, taskId } = useParams<{
    projectId: string;
    epicId: string;
    storyId: string;
    taskId: string;
  }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<any>(null);

  // Fetch data
  const { data: project } = useProject(projectId!);
  const { data: epic } = useEpic(epicId!);
  const { data: story } = useStory(storyId!);
  const { data: task, isLoading: taskLoading, error: taskError } = useTask(taskId!);
  const { data: subtasks = [], isLoading: subtasksLoading } = useSubtasks(taskId!);
  const updateTaskMutation = useUpdateTask(projectId!);

  // Calculate progress
  const completedSubtasks = subtasks.filter(s => s.status === "done").length;
  const progress = subtasks.length > 0
    ? Math.round((completedSubtasks / subtasks.length) * 100)
    : 0;

  const handleBack = useCallback(() => {
    navigate(`/projects/${projectId}/epics/${epicId}/stories/${storyId}`);
  }, [navigate, projectId, epicId, storyId]);

  const handleSubtaskEdit = useCallback((subtask: any) => {
    setEditingSubtask(subtask);
    setIsSubtaskModalOpen(true);
  }, []);

  const handleSubtaskDelete = useCallback(async (subtask: any) => {
    if (confirm(`Are you sure you want to delete "${subtask.title}"?`)) {
      try {
        // TODO: Implement subtask deletion
        showToast("Subtask deletion not yet implemented", "info");
      } catch (error) {
        showToast("Failed to delete subtask", "error");
      }
    }
  }, [showToast]);

  const handleSubtaskToggleComplete = useCallback(async (subtask: any) => {
    const newStatus = subtask.status === "done" ? "todo" : "done";
    try {
      await updateTaskMutation.mutateAsync({
        taskId: subtask.id,
        updates: { status: newStatus }
      });
      showToast(
        newStatus === "done"
          ? "Subtask marked as complete"
          : "Subtask marked as incomplete",
        "success"
      );
    } catch (error) {
      showToast("Failed to update subtask status", "error");
    }
  }, [updateTaskMutation, showToast]);

  const handleAddSubtask = useCallback(() => {
    setEditingSubtask(null);
    setIsSubtaskModalOpen(true);
  }, []);

  const handleSubtaskSaved = useCallback(() => {
    setIsSubtaskModalOpen(false);
    setEditingSubtask(null);
    showToast(
      editingSubtask ? "Subtask updated successfully" : "Subtask created successfully",
      "success"
    );
  }, [editingSubtask, showToast]);

  if (taskLoading || subtasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <CheckCircle2 className="h-12 w-12 text-gray-400 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading task...</p>
        </div>
      </div>
    );
  }

  if (taskError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">
            Failed to load task data
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <HierarchyLayout
        level="task"
        title={`Task: ${task?.title}`}
        subtitle={task?.description}
        progress={progress}
        breadcrumb={
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {project?.title || "Project"}
            </button>
            <span className="text-gray-400">/</span>
            <button
              onClick={() => navigate(`/projects/${projectId}/epics/${epicId}`)}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {epic?.code}
            </button>
            <span className="text-gray-400">/</span>
            <button
              onClick={() => navigate(`/projects/${projectId}/epics/${epicId}/stories/${storyId}`)}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {story?.code}
            </button>
            <span className="text-gray-400">/</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {task?.title}
            </span>
          </div>
        }
        onBack={handleBack}
        onAddNew={handleAddSubtask}
        addNewLabel="New Subtask"
        stats={[
          { label: "Subtasks", value: subtasks.length },
          { label: "Completed", value: completedSubtasks },
        ]}
      >
        {/* Task Details */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Task Details
            </h3>
            <div className="flex items-center gap-2">
              <Badge className={`
                ${task?.status === "done" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                  task?.status === "doing" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                  task?.status === "review" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                  "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"}
              `}>
                {task?.status}
              </Badge>
              {task?.assignee && (
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                  <User className="h-3 w-3 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {task.assignee}
                  </span>
                </div>
              )}
            </div>
          </div>
          {task?.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {task.description}
            </p>
          )}
        </div>

        {/* Subtasks List */}
        {subtasks.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No subtasks yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Break down this task into smaller, manageable subtasks to track progress more effectively.
            </p>
            <Button onClick={handleAddSubtask} className="mx-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create First Subtask
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {subtasks.map((subtask) => (
              <SubtaskItem
                key={subtask.id}
                subtask={subtask}
                parentTask={task}
                onEdit={handleSubtaskEdit}
                onDelete={handleSubtaskDelete}
                onToggleComplete={handleSubtaskToggleComplete}
              />
            ))}
          </div>
        )}
      </HierarchyLayout>

      {/* Subtask Modal */}
      <SubtaskEditModal
        isOpen={isSubtaskModalOpen}
        parentTaskId={taskId!}
        projectId={projectId!}
        editingSubtask={editingSubtask}
        onClose={() => {
          setIsSubtaskModalOpen(false);
          setEditingSubtask(null);
        }}
        onSaved={handleSubtaskSaved}
      />
    </>
  );
};