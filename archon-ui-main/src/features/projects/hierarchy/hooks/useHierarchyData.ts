import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSmartPolling } from "@/features/ui/hooks";
import type { HierarchyStatus, Priority } from "../../shared/types";
import { hierarchyService, type HierarchyTreeNode } from "../../services/hierarchyService";

export type HierarchyViewMode = "hierarchy" | "dependencies";

export interface UseHierarchyDataOptions {
  projectId: string;
  includeArchived?: boolean;
  viewMode?: HierarchyViewMode;
}

export interface FlattenedNode extends HierarchyTreeNode {
  path: string[];
}

export interface HierarchyFiltersMetadata {
  statuses: Record<HierarchyStatus, number>;
  priorities: Record<Priority, number>;
  assignees: Record<string, number>;
  hasMvp: boolean;
}

export interface UseHierarchyDataResult {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  tree: HierarchyTreeNode[];
  flatNodes: FlattenedNode[];
  metadata?: HierarchyFiltersMetadata;
}

export const hierarchyQueryKeys = {
  all: ["project-hierarchy"] as const,
  detail: (projectId: string, includeArchived?: boolean) =>
    [...hierarchyQueryKeys.all, projectId, includeArchived ? "archived" : "active"] as const,
};

interface HierarchyNodeInput {
  id: string;
  title: string;
  description?: string;
  status?: HierarchyStatus;
  priority?: Priority;
  progress?: number;
  mvp_flag?: boolean;
  assignee?: string;
  children?: HierarchyNodeInput[];
  type: "project" | "epic" | "story" | "task" | "subtask";
  raw: Record<string, unknown>;
}

const makeNodeId = (id: string, type: HierarchyTreeNode["type"]): string => `${type}:${id}`;

const mapHierarchy = (nodes: HierarchyNodeInput[], parentId: string | null, depth: number): HierarchyTreeNode[] =>
  nodes.map((node) => {
    const nodeId = makeNodeId(node.id, node.type);
    const children = node.children ? mapHierarchy(node.children, nodeId, depth + 1) : [];

    return {
      id: node.id,
      nodeId,
      title: node.title,
      description: node.description,
      type: node.type,
      status: node.status,
      priority: node.priority,
      assignee: node.assignee,
      progress: node.progress,
      mvpFlag: node.mvp_flag,
      children,
      parentId,
      depth,
      raw: node.raw,
    } satisfies HierarchyTreeNode;
  });

const flattenNodes = (nodes: HierarchyTreeNode[], path: string[] = []): FlattenedNode[] =>
  nodes.flatMap((node) => {
    const currentPath = [...path, node.title];
    const self: FlattenedNode = {
      ...node,
      path: currentPath,
    };

    if (!node.children?.length) {
      return [self];
    }

    return [self, ...flattenNodes(node.children, currentPath)];
  });

const buildFiltersMetadata = (nodes: FlattenedNode[]): HierarchyFiltersMetadata => {
  const statusEntries: HierarchyFiltersMetadata["statuses"] = {
    todo: 0,
    doing: 0,
    review: 0,
    waiting: 0,
    done: 0,
  };
  const priorityEntries: HierarchyFiltersMetadata["priorities"] = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  const assignees: Record<string, number> = {};
  let hasMvp = false;

  for (const node of nodes) {
    if (node.status && statusEntries[node.status] !== undefined) {
      statusEntries[node.status] += 1;
    }
    if (node.priority && priorityEntries[node.priority] !== undefined) {
      priorityEntries[node.priority] += 1;
    }
    if (node.assignee) {
      assignees[node.assignee] = (assignees[node.assignee] || 0) + 1;
    }
    if (node.mvpFlag) {
      hasMvp = true;
    }
  }

  return {
    statuses: statusEntries,
    priorities: priorityEntries,
    assignees,
    hasMvp,
  };
};

const normalizeHierarchyResponse = (response: Awaited<ReturnType<typeof hierarchyService.getProjectHierarchy>>): HierarchyTreeNode[] => {
  const projectNode: HierarchyNodeInput = {
    id: response.project.id,
    title: response.project.title,
    description: response.project.description,
    type: "project",
    raw: response.project,
    children: response.project.epics?.map((epic) => ({
      id: epic.id,
      title: epic.title,
      description: epic.description,
      status: epic.status as HierarchyStatus | undefined,
      priority: epic.priority,
      progress: epic.progress,
      mvp_flag: epic.mvp_flag,
      type: "epic",
      raw: epic,
      children: epic.stories?.map((story) => ({
        id: story.id,
        title: story.title,
        description: story.description,
        status: story.status as HierarchyStatus | undefined,
        priority: story.priority,
        progress: story.progress,
        mvp_flag: story.mvp_flag,
        type: "story",
        raw: story,
        children: story.tasks?.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status as HierarchyStatus | undefined,
          priority: task.priority,
          progress: task.progress,
          assignee: task.assignee,
          type: task.parent_task_id ? "subtask" : "task",
          raw: task,
          children: task.subtasks?.map((subtask) => ({
            id: subtask.id,
            title: subtask.title,
            description: subtask.description,
            status: subtask.status as HierarchyStatus | undefined,
            priority: subtask.priority as Priority | undefined,
            progress: subtask.progress,
            assignee: subtask.assignee,
            type: "subtask",
            raw: subtask,
          })),
        })),
      })),
    })),
  };

  return mapHierarchy([projectNode], null, 0);
};

export const useHierarchyData = ({ projectId, includeArchived }: UseHierarchyDataOptions): UseHierarchyDataResult => {
  const { refetchInterval } = useSmartPolling(10000);

  const {
    data,
    isLoading,
    error,
    isError,
  } = useQuery({
    queryKey: hierarchyQueryKeys.detail(projectId, includeArchived),
    queryFn: () => hierarchyService.getProjectHierarchy(projectId, { includeArchived }),
    enabled: Boolean(projectId),
    refetchInterval,
    staleTime: 10000,
  });

  const tree = useMemo(() => {
    if (!data) {
      return [];
    }
    return normalizeHierarchyResponse(data);
  }, [data]);

  const flatNodes = useMemo(() => flattenNodes(tree), [tree]);

  const metadata = useMemo(() => (flatNodes.length > 0 ? buildFiltersMetadata(flatNodes) : undefined), [flatNodes]);

  return {
    isLoading,
    isError,
    error,
    tree,
    flatNodes,
    metadata,
  };
};
