import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSmartPolling } from "../../../ui/hooks";
import { useToast } from "../../../ui/hooks/useToast";
import { projectKeys } from "../../hooks/useProjectQueries";
import { hierarchyQueryKeys } from "../../hierarchy/hooks/useHierarchyData";
import { invalidateETagCache } from "../../shared/apiWithEtag";
import { taskService } from "../services";
import type { CreateTaskRequest, Task, UpdateTaskRequest } from "../types";

// Query keys factory for tasks
export const taskKeys = {
  all: (projectId: string) => ["projects", projectId, "tasks"] as const,
  detail: (taskId: string) => ["tasks", taskId] as const,
};

// Fetch tasks for a specific project
export function useProjectTasks(projectId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(5000); // 5 second base interval for faster MCP updates

  return useQuery<Task[]>({
    queryKey: projectId ? taskKeys.all(projectId) : ["tasks-undefined"],
    queryFn: async () => {
      if (!projectId) throw new Error("No project ID");
      return taskService.getTasksByProject(projectId);
    },
    enabled: !!projectId && enabled,
    refetchInterval, // Smart interval based on page visibility/focus
    refetchOnWindowFocus: true, // Refetch immediately when tab gains focus (ETag makes this cheap)
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

// Fetch a single task by ID
export function useTask(taskId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(5000);

  return useQuery<Task>({
    queryKey: taskId ? taskKeys.detail(taskId) : ["task-undefined"],
    queryFn: async () => {
      if (!taskId) throw new Error("No task ID");
      return taskService.getTask(taskId);
    },
    enabled: !!taskId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });
}

// Create task mutation with optimistic updates
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (taskData: CreateTaskRequest) => taskService.createTask(taskData),
    onMutate: async (newTaskData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.all(newTaskData.project_id) });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData(taskKeys.all(newTaskData.project_id));

      // Create optimistic task with temporary ID
      const tempId = `temp-${Date.now()}`;
      const optimisticTask: Task = {
        id: tempId, // Temporary ID until real one comes back
        ...newTaskData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Ensure all required fields have defaults
        task_order: newTaskData.task_order ?? 100,
        status: newTaskData.status ?? "todo",
        assignee: newTaskData.assignee ?? "User",
      } as Task;

      // Optimistically add the new task
      queryClient.setQueryData(taskKeys.all(newTaskData.project_id), (old: Task[] | undefined) => {
        if (!old) return [optimisticTask];
        return [...old, optimisticTask];
      });

      return { previousTasks, tempId };
    },
    onError: (error, variables, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to create task:", error, { variables });
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.all(variables.project_id), context.previousTasks);
      }
      showToast(`Failed to create task: ${errorMessage}`, "error");
    },
    onSuccess: (data, variables, context) => {
      // Replace optimistic task with real one from server
      queryClient.setQueryData(taskKeys.all(variables.project_id), (old: Task[] | undefined) => {
        if (!old) return [data];
        // Replace only the specific temp task with real one
        return old
          .map((task) => (task.id === context?.tempId ? data : task))
          .filter(
            (task, index, self) =>
              // Remove any duplicates just in case
              index === self.findIndex((t) => t.id === task.id),
          );
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.taskCounts() });
      showToast("Task created successfully", "success");
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch to ensure consistency after operation completes
      queryClient.invalidateQueries({ queryKey: taskKeys.all(variables.project_id) });
    },
  });
}

// Update task mutation with optimistic updates
export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Task, Error, { taskId: string; updates: UpdateTaskRequest }, { previousTasks?: Task[] }>({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: UpdateTaskRequest }) => {
      console.log("⚛️ useUpdateTask.mutationFn called", { taskId, updates });
      return taskService.updateTask(taskId, updates);
    },
    onMutate: async ({ taskId, updates }) => {
      console.log("⚛️ useUpdateTask.onMutate called", { taskId, updates });

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.all(projectId) });
      console.log("⚛️ useUpdateTask.onMutate queries cancelled");

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.all(projectId));
      console.log("⚛️ useUpdateTask.onMutate previousTasks captured", { count: previousTasks?.length });

      // Optimistically update
      queryClient.setQueryData<Task[]>(taskKeys.all(projectId), (old) => {
        if (!old) return old;
        const updated = old.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
        console.log("⚛️ useUpdateTask.onMutate optimistic update applied", {
          taskId,
          updates,
          foundTask: !!old.find(t => t.id === taskId)
        });
        return updated;
      });

      return { previousTasks };
    },
    onError: (error, variables, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("⚛️ useUpdateTask.onError called", { error, variables, contextHasPrevious: !!context?.previousTasks });

      // Rollback on error
      if (context?.previousTasks) {
        console.log("⚛️ useUpdateTask.onError rolling back optimistic update");
        queryClient.setQueryData(taskKeys.all(projectId), context.previousTasks);
      }
      showToast(`Failed to update task: ${errorMessage}`, "error");

      // Refetch on error to ensure consistency
      console.log("⚛️ useUpdateTask.onError invalidating queries");
      queryClient.invalidateQueries({ queryKey: taskKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.taskCounts() });
    },
    onSuccess: (data, { updates }) => {
      console.log("⚛️ useUpdateTask.onSuccess called", {
        taskId: data.id,
        updates,
        returnedData: {
          id: data.id,
          status: data.status,
          priority: data.priority,
          assignee: data.assignee
        }
      });

      // Merge server response to keep timestamps and computed fields in sync
      queryClient.setQueryData<Task[]>(taskKeys.all(projectId), (old) => {
        const result = old ? old.map((t) => (t.id === data.id ? data : t)) : old;
        console.log("⚛️ useUpdateTask.onSuccess setQueryData for taskKeys.all", {
          taskId: data.id,
          foundInOld: !!old?.find(t => t.id === data.id),
          oldCount: old?.length,
          resultCount: Array.isArray(result) ? result.length : 'not-array'
        });
        return result;
      });

      // 🎯 FIX: Force refetch instead of just invalidating for TreeView
      console.log("⚛️ useUpdateTask.onSuccess force refetching hierarchy queries");
      
      // Invalidate and immediately refetch all hierarchy queries
      queryClient.invalidateQueries({ queryKey: hierarchyQueryKeys.all });
      queryClient.refetchQueries({ 
        queryKey: hierarchyQueryKeys.detail(projectId, false, true) // TreeView: includeArchived=false, includeTasks=true
      });
      queryClient.refetchQueries({ 
        queryKey: hierarchyQueryKeys.detail(projectId, true, true) // Also archived version
      });

      // 🎯 FIX: Clear ETag cache more thoroughly and force fresh data
      console.log("⚛️ useUpdateTask.onSuccess clearing ETag caches and forcing fresh data");
      invalidateETagCache(`/api/projects/${projectId}/hierarchy`);
      invalidateETagCache(`/api/projects/${projectId}/hierarchy?include_tasks=true`);
      invalidateETagCache(`/api/projects/${projectId}/hierarchy?include_tasks=true&include_archived=false`);
      invalidateETagCache(`/api/projects/${projectId}/hierarchy?include_tasks=true&include_archived=true`);

      // Only invalidate counts if status changed (which affects counts)
      if (updates.status) {
        console.log("⚛️ useUpdateTask.onSuccess status changed, invalidating counts");
        queryClient.invalidateQueries({ queryKey: projectKeys.taskCounts() });
        // Show toast for significant status changes
        showToast(`Task moved to ${updates.status}`, "success");
      }

      console.log("⚛️ useUpdateTask.onSuccess completed");
    },
  });
}

// Delete task mutation
export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<void, Error, string, { previousTasks?: Task[] }>({
    mutationFn: (taskId: string) => taskService.deleteTask(taskId),
    onMutate: async (taskId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.all(projectId) });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.all(projectId));

      // Optimistically remove the task
      queryClient.setQueryData<Task[]>(taskKeys.all(projectId), (old) => {
        if (!old) return old;
        return old.filter((task) => task.id !== taskId);
      });

      return { previousTasks };
    },
    onError: (error, taskId, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to delete task:", error, { taskId });
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.all(projectId), context.previousTasks);
      }
      showToast(`Failed to delete task: ${errorMessage}`, "error");
    },
    onSuccess: () => {
      showToast("Task deleted successfully", "success");
    },
    onSettled: () => {
      // Always refetch counts after deletion
      queryClient.invalidateQueries({ queryKey: projectKeys.taskCounts() });
    },
  });
}

// ========================================
// HIERARCHY INTEGRATION HOOKS
// ========================================

// Query keys for hierarchy operations
export const taskHierarchyKeys = {
  byStory: (storyId: string) => ["story", storyId, "tasks"] as const,
  subtasks: (parentTaskId: string) => ["task", parentTaskId, "subtasks"] as const,
  progress: (taskId: string) => ["task", taskId, "progress"] as const,
  hierarchyPath: (taskId: string) => ["task", taskId, "hierarchy-path"] as const,
};

// Fetch tasks for a specific story
export function useStoryTasks(storyId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(5000);

  return useQuery<Task[]>({
    queryKey: storyId ? taskHierarchyKeys.byStory(storyId) : ["story-tasks-undefined"],
    queryFn: async () => {
      if (!storyId) throw new Error("No story ID");
      return taskService.getTasksByStory(storyId);
    },
    enabled: !!storyId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });
}

// Fetch subtasks for a specific task
export function useSubtasks(parentTaskId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(5000);

  return useQuery<Task[]>({
    queryKey: parentTaskId ? taskHierarchyKeys.subtasks(parentTaskId) : ["subtasks-undefined"],
    queryFn: async () => {
      if (!parentTaskId) throw new Error("No parent task ID");
      return taskService.getSubtasks(parentTaskId);
    },
    enabled: !!parentTaskId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });
}

// Fetch task progress
export function useTaskProgress(taskId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(10000);

  return useQuery<number>({
    queryKey: taskId ? taskHierarchyKeys.progress(taskId) : ["task-progress-undefined"],
    queryFn: async () => {
      if (!taskId) throw new Error("No task ID");
      return taskService.calculateTaskProgress(taskId);
    },
    enabled: !!taskId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 15000,
  });
}

// Fetch task hierarchy path for breadcrumbs
export function useTaskHierarchyPath(taskId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(15000); // Slower refresh for paths

  return useQuery<any>({
    queryKey: taskId ? taskHierarchyKeys.hierarchyPath(taskId) : ["task-hierarchy-path-undefined"],
    queryFn: async () => {
      if (!taskId) throw new Error("No task ID");
      return taskService.getTaskHierarchyPath(taskId);
    },
    enabled: !!taskId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 30000, // Hierarchy paths change rarely
  });
}

// Create subtask mutation
export function useCreateSubtask(parentTaskId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (subtaskData: Omit<CreateTaskRequest, "parent_task_id">) =>
      taskService.createSubtask(parentTaskId, subtaskData),
    onMutate: async (newSubtaskData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskHierarchyKeys.subtasks(parentTaskId) });

      // Snapshot the previous value
      const previousSubtasks = queryClient.getQueryData(taskHierarchyKeys.subtasks(parentTaskId));

      // Create optimistic subtask with temporary ID
      const tempId = `temp-subtask-${Date.now()}`;
      const optimisticSubtask: Task = {
        id: tempId,
        ...newSubtaskData,
        parent_task_id: parentTaskId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Ensure all required fields have defaults
        task_order: newSubtaskData.task_order ?? 100,
        status: newSubtaskData.status ?? "todo",
        assignee: newSubtaskData.assignee ?? "User",
      } as Task;

      // Optimistically add the new subtask
      queryClient.setQueryData(taskHierarchyKeys.subtasks(parentTaskId), (old: Task[] | undefined) => {
        if (!old) return [optimisticSubtask];
        return [...old, optimisticSubtask];
      });

      return { previousSubtasks, tempId };
    },
    onError: (error, variables, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to create subtask:", error, { variables });
      // Rollback on error
      if (context?.previousSubtasks) {
        queryClient.setQueryData(taskHierarchyKeys.subtasks(parentTaskId), context.previousSubtasks);
      }
      showToast(`Failed to create subtask: ${errorMessage}`, "error");
    },
    onSuccess: (data, variables, context) => {
      // Replace optimistic subtask with real one from server
      queryClient.setQueryData(taskHierarchyKeys.subtasks(parentTaskId), (old: Task[] | undefined) => {
        if (!old) return [data];
        return old
          .map((task) => (task.id === context?.tempId ? data : task))
          .filter((task, index, self) => index === self.findIndex((t) => t.id === task.id));
      });
      showToast("Subtask created successfully", "success");
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: taskHierarchyKeys.subtasks(parentTaskId) });
      queryClient.invalidateQueries({ queryKey: taskHierarchyKeys.progress(parentTaskId) });
    },
  });
}

// Move task to different story mutation
export function useMoveTaskToStory() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Task, Error, { taskId: string; toStoryId: string; newTaskOrder?: number }>({
    mutationFn: ({ taskId, toStoryId, newTaskOrder }) => taskService.moveTaskToStory(taskId, toStoryId, newTaskOrder),
    onSuccess: (data, { toStoryId }) => {
      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: taskHierarchyKeys.byStory(toStoryId) });
      showToast("Task moved to story successfully", "success");
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(`Failed to move task: ${errorMessage}`, "error");
    },
  });
}

// Move subtask to different parent mutation
export function useMoveSubtaskToParent() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Task, Error, { subtaskId: string; newParentTaskId: string; newTaskOrder?: number }>({
    mutationFn: ({ subtaskId, newParentTaskId, newTaskOrder }) =>
      taskService.moveSubtaskToParent(subtaskId, newParentTaskId, newTaskOrder),
    onSuccess: (data, { newParentTaskId }) => {
      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: taskHierarchyKeys.subtasks(newParentTaskId) });
      showToast("Subtask moved successfully", "success");
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(`Failed to move subtask: ${errorMessage}`, "error");
    },
  });
}

// Reorder tasks in story mutation
export function useReorderTasksInStory(storyId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Task[], Error, string[]>({
    mutationFn: (orderedTaskIds: string[]) => taskService.reorderTasksInStory(storyId, orderedTaskIds),
    onMutate: async (orderedTaskIds) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskHierarchyKeys.byStory(storyId) });

      // Get current tasks
      const previousTasks = queryClient.getQueryData<Task[]>(taskHierarchyKeys.byStory(storyId));

      // Optimistically reorder
      if (previousTasks) {
        const reorderedTasks = orderedTaskIds
          .map((id) => previousTasks.find((task) => task.id === id))
          .filter(Boolean) as Task[];
        queryClient.setQueryData(taskHierarchyKeys.byStory(storyId), reorderedTasks);
      }

      return { previousTasks };
    },
    onError: (error, variables, context) => {
      console.error("Failed to reorder tasks:", error);
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(taskHierarchyKeys.byStory(storyId), context.previousTasks);
      }
      showToast("Failed to reorder tasks", "error");
    },
    onSuccess: () => {
      showToast("Tasks reordered successfully", "success");
    },
  });
}

// Reorder subtasks mutation
export function useReorderSubtasks(parentTaskId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Task[], Error, string[]>({
    mutationFn: (orderedSubtaskIds: string[]) => taskService.reorderSubtasks(parentTaskId, orderedSubtaskIds),
    onMutate: async (orderedSubtaskIds) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskHierarchyKeys.subtasks(parentTaskId) });

      // Get current subtasks
      const previousSubtasks = queryClient.getQueryData<Task[]>(taskHierarchyKeys.subtasks(parentTaskId));

      // Optimistically reorder
      if (previousSubtasks) {
        const reorderedSubtasks = orderedSubtaskIds
          .map((id) => previousSubtasks.find((task) => task.id === id))
          .filter(Boolean) as Task[];
        queryClient.setQueryData(taskHierarchyKeys.subtasks(parentTaskId), reorderedSubtasks);
      }

      return { previousSubtasks };
    },
    onError: (error, variables, context) => {
      console.error("Failed to reorder subtasks:", error);
      // Rollback on error
      if (context?.previousSubtasks) {
        queryClient.setQueryData(taskHierarchyKeys.subtasks(parentTaskId), context.previousSubtasks);
      }
      showToast("Failed to reorder subtasks", "error");
    },
    onSuccess: () => {
      showToast("Subtasks reordered successfully", "success");
    },
  });
}
