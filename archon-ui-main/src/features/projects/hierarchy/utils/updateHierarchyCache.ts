import type { QueryClient } from "@tanstack/react-query";
import type { HierarchyTreeNode, ProjectHierarchyResponse } from "../../services/hierarchyService";
import type { HierarchyStatus, Priority } from "../../shared/types";
import { hierarchyQueryKeys } from "../hooks/useHierarchyData";

export interface HierarchyUpdatePayload {
  title?: string;
  description?: string;
  status?: HierarchyStatus;
  priority?: Priority;
  assignee?: string;
}

function cloneHierarchy(data: ProjectHierarchyResponse): ProjectHierarchyResponse {
  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data)) as ProjectHierarchyResponse;
}

function applyUpdates(target: { [key: string]: unknown }, updates: HierarchyUpdatePayload): void {
  if (updates.title !== undefined) {
    target.title = updates.title;
  }
  if (updates.description !== undefined) {
    target.description = updates.description;
  }
  if (updates.status !== undefined) {
    target.status = updates.status as HierarchyStatus;
  }
  if (updates.priority !== undefined) {
    target.priority = updates.priority as Priority;
  }
  if (updates.assignee !== undefined) {
    target.assignee = updates.assignee;
  }
}

function updateHierarchyData(
  hierarchy: ProjectHierarchyResponse,
  node: HierarchyTreeNode,
  updates: HierarchyUpdatePayload,
): boolean {
  const { project } = hierarchy;

  if (node.type === "epic") {
    const epic = project.epics.find((item) => item.id === node.id);
    if (epic) {
      applyUpdates(epic, updates);
      return true;
    }
    return false;
  }

  for (const epic of project.epics) {
    if (node.type === "story") {
      const story = epic.stories?.find((item) => item.id === node.id);
      if (story) {
        applyUpdates(story, updates);
        return true;
      }
    }

    if (node.type === "task" || node.type === "subtask") {
      const stories = epic.stories ?? [];
      for (const story of stories) {
        const tasks = story.tasks ?? [];
        const task = tasks.find((item) => item.id === node.id);
        if (task) {
          applyUpdates(task, updates);
          return true;
        }

        if (node.type === "subtask") {
          for (const parentTask of tasks) {
            const subtasks = parentTask.subtasks ?? [];
            const subtask = subtasks.find((item) => item.id === node.id);
            if (subtask) {
              applyUpdates(subtask, updates);
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

export function updateHierarchyQueryCache(
  queryClient: QueryClient,
  projectId: string,
  node: HierarchyTreeNode,
  updates: HierarchyUpdatePayload,
): void {
  const includeArchivedOptions = [false, true];
  const includeTasksOptions = [false, true];

  includeArchivedOptions.forEach((includeArchived) => {
    includeTasksOptions.forEach((includeTasks) => {
      const queryKey = hierarchyQueryKeys.detail(projectId, includeArchived, includeTasks);
      queryClient.setQueryData<ProjectHierarchyResponse | undefined>(queryKey, (existing) => {
        if (!existing) {
          return existing;
        }
        const cloned = cloneHierarchy(existing);
        const updated = updateHierarchyData(cloned, node, updates);
        return updated ? cloned : existing;
      });
    });
  });
}
