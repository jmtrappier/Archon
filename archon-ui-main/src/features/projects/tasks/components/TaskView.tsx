import { ArrowLeft, Calendar, Clock, User, Tag, CheckSquare, MoreHorizontal } from "lucide-react";
import type React from "react";
import { useCallback, useState, useEffect } from "react";
import { Button } from "../../../ui/primitives";
import { HierarchyBreadcrumb } from "../../../ui/components/navigation";
import { useHierarchyContext } from "../../../../contexts/HierarchyContext";
import { useTaskActions, useSubtasks } from "../hooks";
import { useProject } from "../../hooks/useProjectQueries";
import { useEpic } from "../../epics/hooks/useEpicQueries";
import { useStory } from "../../stories/hooks/useStoryQueries";
import type { Task, Assignee } from "../types";
import { getProgressColor, getProgressTextColor, enhanceTaskWithSubtasks } from "../utils";
import { TaskAssignee } from "./TaskAssignee";
import { TaskCardActions } from "./TaskCardActions";
import { SubtaskList } from "./SubtaskList";
import { TaskEditModal } from "./TaskEditModal";

export interface TaskViewProps {
  task: Task;
  projectId: string;
  onClose?: () => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete?: (task: Task) => void;
  isModal?: boolean; // Whether this is displayed as a modal or inline
}

export const TaskView: React.FC<TaskViewProps> = ({
  task,
  projectId,
  onClose,
  onTaskUpdate,
  onTaskDelete,
  isModal = true,
}) => {
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<Task | null>(null);

  // Hierarchy context
  const { setProjectContext, setEpicContext, setStoryContext, setTaskContext, clearFromLevel } = useHierarchyContext();

  // Hooks
  const { changeAssignee, isUpdating } = useTaskActions(projectId);
  const { data: subtasks = [] } = useSubtasks(task.id);

  // Fetch hierarchy data
  const { data: project } = useProject(projectId);
  const { data: story } = useStory(task.story_id);
  const { data: epic } = useEpic(story?.epic_id);

  // Enhance task with subtask data
  const enhancedTask = enhanceTaskWithSubtasks(task, subtasks);

  // Set hierarchy context when component mounts or data changes
  useEffect(() => {
    if (project) {
      setProjectContext({
        id: project.id,
        title: project.title,
      });
    }
  }, [project, setProjectContext]);

  useEffect(() => {
    if (epic) {
      setEpicContext({
        id: epic.id,
        title: epic.title,
        progress: epic.progress,
      });
    }
  }, [epic, setEpicContext]);

  useEffect(() => {
    if (story) {
      setStoryContext({
        id: story.id,
        title: story.title,
        progress: story.progress,
      });
    }
  }, [story, setStoryContext]);

  useEffect(() => {
    if (task) {
      setTaskContext({
        id: task.id,
        title: task.title,
        progress: enhancedTask.progress,
      });
      // Clear subtask context since we're at the task level
      clearFromLevel('subtask');
    }
  }, [task, enhancedTask.progress, setTaskContext, clearFromLevel]);

  // Handlers
  const handleTaskEdit = useCallback(() => {
    setIsEditingTask(true);
  }, []);

  const handleTaskDelete = useCallback(() => {
    if (onTaskDelete) {
      onTaskDelete(task);
    }
  }, [onTaskDelete, task]);

  const handleAssigneeChange = useCallback(
    (newAssignee: Assignee) => {
      changeAssignee(task.id, newAssignee);
    },
    [changeAssignee, task.id]
  );

  const handleSubtaskEdit = useCallback((subtask: Task) => {
    setEditingSubtask(subtask);
  }, []);

  const handleSubtaskDelete = useCallback(
    (subtask: Task) => {
      // Handle subtask deletion - this would typically show a confirmation modal
      console.log("Delete subtask:", subtask.id);
    },
    []
  );

  const getStatusColor = (status: Task["status"]) => {
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

  return (
    <>
      <div
        className={`
          ${
            isModal
              ? "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              : "w-full"
          }
        `}
        onClick={isModal ? onClose : undefined}
      >
        <div
          className={`
            ${
              isModal
                ? "bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
            }
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              {isModal && onClose && (
                <Button variant="ghost" size="sm" onClick={onClose} className="p-2">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}

              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white line-clamp-1">
                  {task.title}
                </h2>

                <span
                  className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${getStatusColor(
                    task.status
                  )}`}
                >
                  {task.status}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <TaskCardActions
                taskId={task.id}
                taskTitle={task.title}
                onEdit={handleTaskEdit}
                onDelete={handleTaskDelete}
                isDeleting={false}
              />
            </div>
          </div>

          {/* Hierarchy Breadcrumb - only show when not in modal mode */}
          {!isModal && (
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <HierarchyBreadcrumb
                showHome={true}
                compact={true}
                showProgress={true}
                showIcons={true}
                enableKeyboardNavigation={true}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Task metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Assignee */}
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Assignee
                  </div>
                  <TaskAssignee
                    assignee={task.assignee}
                    onAssigneeChange={handleAssigneeChange}
                    isLoading={isUpdating}
                  />
                </div>
              </div>

              {/* Feature */}
              {task.feature && (
                <div className="flex items-center gap-3">
                  <Tag className="h-4 w-4 text-gray-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Feature
                    </div>
                    <span
                      className="inline-block px-2 py-1 text-sm font-medium rounded-md"
                      style={{
                        backgroundColor: `${task.featureColor}20`,
                        color: task.featureColor,
                      }}
                    >
                      {task.feature}
                    </span>
                  </div>
                </div>
              )}

              {/* Created date */}
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Created
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(task.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress overview */}
            {(enhancedTask.subtask_count ?? 0) > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Progress Overview
                  </h3>

                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {enhancedTask.completed_subtasks}/{enhancedTask.subtask_count} subtasks completed
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${getProgressColor(
                        enhancedTask.progress || 0
                      )}`}
                      style={{ width: `${enhancedTask.progress || 0}%` }}
                    />
                  </div>

                  <span
                    className={`text-sm font-bold ${getProgressTextColor(
                      enhancedTask.progress || 0
                    )}`}
                  >
                    {enhancedTask.progress || 0}%
                  </span>
                </div>
              </div>
            )}

            {/* Description */}
            {task.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Description
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {task.description}
                  </p>
                </div>
              </div>
            )}

            {/* Subtasks */}
            <div>
              <SubtaskList
                parentTask={enhancedTask}
                projectId={projectId}
                onSubtaskEdit={handleSubtaskEdit}
                onSubtaskDelete={handleSubtaskDelete}
                isCompact={false}
              />
            </div>

            {/* Sources and Code Examples */}
            {(task.sources && task.sources.length > 0) && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Sources
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                  {task.sources.map((source, index) => (
                    <div key={index} className="text-sm text-gray-700 dark:text-gray-300">
                      {typeof source === 'object' && 'url' in source ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >
                          {source.url}
                        </a>
                      ) : (
                        <pre className="font-mono text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded">
                          {JSON.stringify(source, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last updated */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              Last updated: {new Date(task.updated_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Task Modal */}
      {isEditingTask && (
        <TaskEditModal
          isOpen={isEditingTask}
          onClose={() => setIsEditingTask(false)}
          onSubmit={async (updates) => {
            if (onTaskUpdate) {
              onTaskUpdate(task.id, updates);
            }
            setIsEditingTask(false);
          }}
          task={task}
          projectId={projectId}
          title="Edit Task"
        />
      )}

      {/* Edit Subtask Modal */}
      {editingSubtask && (
        <TaskEditModal
          isOpen={!!editingSubtask}
          onClose={() => setEditingSubtask(null)}
          onSubmit={async (updates) => {
            if (onTaskUpdate) {
              onTaskUpdate(editingSubtask.id, updates);
            }
            setEditingSubtask(null);
          }}
          task={editingSubtask}
          projectId={projectId}
          title="Edit Subtask"
        />
      )}
    </>
  );
};