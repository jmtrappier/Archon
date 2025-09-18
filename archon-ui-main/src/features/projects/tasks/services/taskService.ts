/**
 * Task Management Service
 * Focused service for task CRUD operations only
 */

import { formatZodErrors, ValidationError } from "../../shared/api";
import { callAPIWithETag, invalidateETagCache } from "../../shared/apiWithEtag";

import { validateCreateTask, validateUpdateTask, validateUpdateTaskStatus } from "../schemas";
import type { CreateTaskRequest, DatabaseTaskStatus, Task, TaskCounts, UpdateTaskRequest } from "../types";

export const taskService = {
  /**
   * Get all tasks for a project
   */
  async getTasksByProject(projectId: string): Promise<Task[]> {
    try {
      const tasks = await callAPIWithETag<Task[]>(`/api/projects/${projectId}/tasks`);

      // Return tasks as-is; UI uses DB status values (todo/doing/review/done)
      return tasks;
    } catch (error) {
      console.error(`Failed to get tasks for project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<Task> {
    try {
      const task = await callAPIWithETag<Task>(`/api/tasks/${taskId}`);
      return task;
    } catch (error) {
      console.error(`Failed to get task ${taskId}:`, error);
      throw error;
    }
  },

  /**
   * Create a new task
   */
  async createTask(taskData: CreateTaskRequest): Promise<Task> {
    // Validate input
    const validation = validateCreateTask(taskData);
    if (!validation.success) {
      throw new ValidationError(formatZodErrors(validation.error));
    }

    try {
      // The validation.data already has defaults from schema
      const requestData = validation.data;

      const task = await callAPIWithETag<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(requestData),
      });

      // Invalidate task list cache for the project
      invalidateETagCache(`/api/projects/${taskData.project_id}/tasks`);
      invalidateETagCache("/api/tasks/counts");

      return task;
    } catch (error) {
      console.error("Failed to create task:", error);
      throw error;
    }
  },

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, updates: UpdateTaskRequest): Promise<Task> {
    // Validate input
    const validation = validateUpdateTask(updates);
    if (!validation.success) {
      throw new ValidationError(formatZodErrors(validation.error));
    }

    try {
      const task = await callAPIWithETag<Task>(`/api/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(validation.data),
      });

      // Invalidate related caches
      // Note: We don't know the project_id here, so TanStack Query will handle invalidation
      invalidateETagCache("/api/tasks/counts");

      return task;
    } catch (error) {
      console.error(`Failed to update task ${taskId}:`, error);
      throw error;
    }
  },

  /**
   * Update task status (for drag & drop operations)
   */
  async updateTaskStatus(taskId: string, status: DatabaseTaskStatus): Promise<Task> {
    // Validate input
    const validation = validateUpdateTaskStatus({
      task_id: taskId,
      status: status,
    });
    if (!validation.success) {
      throw new ValidationError(formatZodErrors(validation.error));
    }

    try {
      // Use the standard update task endpoint with JSON body
      const task = await callAPIWithETag<Task>(`/api/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      // Invalidate task counts cache when status changes
      invalidateETagCache("/api/tasks/counts");

      return task;
    } catch (error) {
      console.error(`Failed to update task status ${taskId}:`, error);
      throw error;
    }
  },

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      await callAPIWithETag<void>(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      // Invalidate task counts cache after deletion
      invalidateETagCache("/api/tasks/counts");
    } catch (error) {
      console.error(`Failed to delete task ${taskId}:`, error);
      throw error;
    }
  },

  /**
   * Update task order for better drag-and-drop support
   */
  async updateTaskOrder(taskId: string, newOrder: number, newStatus?: DatabaseTaskStatus): Promise<Task> {
    try {
      const updates: UpdateTaskRequest = {
        task_order: newOrder,
      };

      if (newStatus) {
        updates.status = newStatus;
      }

      const task = await this.updateTask(taskId, updates);

      return task;
    } catch (error) {
      console.error(`Failed to update task order for ${taskId}:`, error);
      throw error;
    }
  },

  /**
   * Get tasks by status across all projects
   */
  async getTasksByStatus(status: DatabaseTaskStatus): Promise<Task[]> {
    try {
      // Note: This method requires cross-project access
      // For now, we'll throw an error suggesting to use project-scoped queries
      throw new Error("getTasksByStatus requires cross-project access. Use getTasksByProject instead.");
    } catch (error) {
      console.error(`Failed to get tasks by status ${status}:`, error);
      throw error;
    }
  },

  /**
   * Get task counts for all projects in a single batch request
   * Optimized endpoint to avoid N+1 query problem
   */
  async getTaskCountsForAllProjects(): Promise<Record<string, TaskCounts>> {
    try {
      const response = await callAPIWithETag<Record<string, TaskCounts>>("/api/projects/task-counts");
      return response || {};
    } catch (error) {
      console.error("Failed to get task counts for all projects:", error);
      throw error;
    }
  },

  // ========================================
  // HIERARCHY INTEGRATION METHODS
  // ========================================

  /**
   * Get tasks by story ID
   */
  async getTasksByStory(storyId: string): Promise<Task[]> {
    try {
      const tasks = await callAPIWithETag<Task[]>(`/api/stories/${storyId}/tasks`);
      return tasks;
    } catch (error) {
      console.error(`Failed to get tasks for story ${storyId}:`, error);
      throw error;
    }
  },

  /**
   * Get subtasks for a specific task (using parent_task_id)
   */
  async getSubtasks(parentTaskId: string): Promise<Task[]> {
    try {
      const subtasks = await callAPIWithETag<Task[]>(`/api/tasks/${parentTaskId}/subtasks`);
      return subtasks;
    } catch (error) {
      console.error(`Failed to get subtasks for task ${parentTaskId}:`, error);
      throw error;
    }
  },

  /**
   * Move task to a different story
   */
  async moveTaskToStory(taskId: string, toStoryId: string, newTaskOrder?: number): Promise<Task> {
    try {
      const updates: UpdateTaskRequest = {
        story_id: toStoryId,
      };

      if (newTaskOrder !== undefined) {
        updates.task_order = newTaskOrder;
      }

      const task = await this.updateTask(taskId, updates);

      // Invalidate story-related caches
      invalidateETagCache(`/api/stories/${toStoryId}/tasks`);

      return task;
    } catch (error) {
      console.error(`Failed to move task ${taskId} to story ${toStoryId}:`, error);
      throw error;
    }
  },

  /**
   * Move subtask to a different parent task
   */
  async moveSubtaskToParent(subtaskId: string, newParentTaskId: string, newTaskOrder?: number): Promise<Task> {
    try {
      const updates: UpdateTaskRequest = {
        parent_task_id: newParentTaskId,
      };

      if (newTaskOrder !== undefined) {
        updates.task_order = newTaskOrder;
      }

      const task = await this.updateTask(subtaskId, updates);

      // Invalidate parent task cache
      invalidateETagCache(`/api/tasks/${newParentTaskId}/subtasks`);

      return task;
    } catch (error) {
      console.error(`Failed to move subtask ${subtaskId} to parent ${newParentTaskId}:`, error);
      throw error;
    }
  },

  /**
   * Create a subtask under a parent task
   */
  async createSubtask(parentTaskId: string, subtaskData: Omit<CreateTaskRequest, "parent_task_id">): Promise<Task> {
    try {
      const fullSubtaskData: CreateTaskRequest = {
        ...subtaskData,
        parent_task_id: parentTaskId,
      };

      const subtask = await this.createTask(fullSubtaskData);

      // Invalidate parent task's subtasks cache
      invalidateETagCache(`/api/tasks/${parentTaskId}/subtasks`);

      return subtask;
    } catch (error) {
      console.error(`Failed to create subtask under parent ${parentTaskId}:`, error);
      throw error;
    }
  },

  /**
   * Calculate task progress based on subtasks
   */
  async calculateTaskProgress(taskId: string): Promise<number> {
    try {
      const response = await callAPIWithETag<{ progress: number }>(`/api/tasks/${taskId}/progress`);
      return response.progress;
    } catch (error) {
      console.error(`Failed to calculate task progress for ${taskId}:`, error);
      throw error;
    }
  },

  /**
   * Get task hierarchy path for breadcrumb navigation
   */
  async getTaskHierarchyPath(taskId: string): Promise<any> {
    try {
      const path = await callAPIWithETag<any>(`/api/tasks/${taskId}/hierarchy-path`);
      return path;
    } catch (error) {
      console.error(`Failed to get hierarchy path for task ${taskId}:`, error);
      throw error;
    }
  },

  /**
   * Reorder tasks within a story
   */
  async reorderTasksInStory(storyId: string, orderedTaskIds: string[]): Promise<Task[]> {
    try {
      const tasks = await callAPIWithETag<Task[]>(`/api/stories/${storyId}/tasks/reorder`, {
        method: "PUT",
        body: JSON.stringify({ task_ids: orderedTaskIds }),
      });

      // Invalidate story's task cache
      invalidateETagCache(`/api/stories/${storyId}/tasks`);

      return tasks;
    } catch (error) {
      console.error(`Failed to reorder tasks in story ${storyId}:`, error);
      throw error;
    }
  },

  /**
   * Reorder subtasks within a parent task
   */
  async reorderSubtasks(parentTaskId: string, orderedSubtaskIds: string[]): Promise<Task[]> {
    try {
      const subtasks = await callAPIWithETag<Task[]>(`/api/tasks/${parentTaskId}/subtasks/reorder`, {
        method: "PUT",
        body: JSON.stringify({ subtask_ids: orderedSubtaskIds }),
      });

      // Invalidate parent task's subtasks cache
      invalidateETagCache(`/api/tasks/${parentTaskId}/subtasks`);

      return subtasks;
    } catch (error) {
      console.error(`Failed to reorder subtasks in parent task ${parentTaskId}:`, error);
      throw error;
    }
  },
};
