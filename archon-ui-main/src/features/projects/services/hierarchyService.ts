import { callAPIWithETag } from "../shared/apiWithEtag";
import type { HierarchyStatus, Priority, Story, Epic, Task } from "../shared/types";

export type HierarchyNodeType = "project" | "epic" | "story" | "task" | "subtask";

export interface HierarchyTaskResponse extends Task {
  subtasks?: Task[];
}

export interface HierarchyStoryResponse extends Story {
  tasks?: HierarchyTaskResponse[];
}

export interface HierarchyEpicResponse extends Epic {
  stories?: HierarchyStoryResponse[];
}

export interface ProjectHierarchyResponse {
  project: {
    id: string;
    title: string;
    description?: string;
    epics: HierarchyEpicResponse[];
  };
  metadata: {
    epic_count: number;
    story_count: number;
    task_count: number;
    include_tasks: boolean;
    include_archived: boolean;
  };
}

export interface HierarchyQueryOptions {
  includeTasks?: boolean;
  includeArchived?: boolean;
}

export interface HierarchyTreeNode {
  id: string;
  nodeId: string;
  title: string;
  description?: string;
  type: HierarchyNodeType;
  status?: HierarchyStatus;
  priority?: Priority;
  assignee?: string;
  mvpFlag?: boolean;
  progress?: number;
  children: HierarchyTreeNode[];
  parentId?: string | null;
  depth: number;
  raw: Record<string, unknown>;
}

export const hierarchyService = {
  async getProjectHierarchy(projectId: string, options?: HierarchyQueryOptions): Promise<ProjectHierarchyResponse> {
    const params = new URLSearchParams();
    if (options?.includeTasks === false) {
      params.append("include_tasks", "false");
    }
    if (options?.includeArchived) {
      params.append("include_archived", "true");
    }

    const url = params.size > 0 ? `/api/projects/${projectId}/hierarchy?${params.toString()}` : `/api/projects/${projectId}/hierarchy`;

    const response = await callAPIWithETag<ProjectHierarchyResponse>(url);
    return response;
  },
};
