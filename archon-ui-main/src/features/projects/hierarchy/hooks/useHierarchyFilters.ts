import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { HierarchyStatus, Priority } from "../../shared/types";
import type { FlattenedNode, HierarchyFiltersMetadata, HierarchyViewMode } from "./useHierarchyData";

export type FilterVisibilityMode = "hide" | "dim";

export interface HierarchyFiltersState {
  search: string;
  statuses: HierarchyStatus[];
  priorities: Priority[];
  assignees: string[];
  mvpOnly: boolean;
  visibilityMode: FilterVisibilityMode;
  viewMode: HierarchyViewMode;
  includeArchived: boolean;
}

export interface HierarchyFiltersResult {
  filters: HierarchyFiltersState;
  setSearch: (value: string) => void;
  toggleStatus: (status: HierarchyStatus) => void;
  togglePriority: (priority: Priority) => void;
  toggleAssignee: (assignee: string) => void;
  toggleMvpOnly: () => void;
  setVisibilityMode: (mode: FilterVisibilityMode) => void;
  setViewMode: (mode: HierarchyViewMode) => void;
  setIncludeArchived: (value: boolean) => void;
  applyFilters: (nodes: FlattenedNode[]) => FlattenedNode[];
}

const parseListParam = <T extends string>(value: string | null): T[] =>
  value ? (value.split(",").filter(Boolean) as T[]) : [];

const updateParam = (params: URLSearchParams, key: string, values: string[] | boolean | string) => {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      params.delete(key);
    } else {
      params.set(key, values.join(","));
    }
  } else if (typeof values === "boolean") {
    if (values) {
      params.set(key, "true");
    } else {
      params.delete(key);
    }
  } else {
    params.set(key, values);
  }
};

const filterNodes = (nodes: FlattenedNode[], filters: HierarchyFiltersState): FlattenedNode[] => {
  const { search, statuses, priorities, assignees, mvpOnly } = filters;
  return nodes.filter((node) => {
    if (node.type === "project") {
      return true;
    }

    if (search) {
      const query = search.toLowerCase();
      const matchesSearch = node.title.toLowerCase().includes(query) || node.path.some((segment) => segment.toLowerCase().includes(query));
      if (!matchesSearch) {
        return false;
      }
    }

    if (statuses.length > 0 && node.status && !statuses.includes(node.status)) {
      return false;
    }

    if (priorities.length > 0 && node.priority && !priorities.includes(node.priority)) {
      return false;
    }

    if (assignees.length > 0) {
      if (!node.assignee || !assignees.includes(node.assignee)) {
        return false;
      }
    }

    if (mvpOnly && !node.mvpFlag) {
      return false;
    }

    return true;
  });
};

export const useHierarchyFilters = (
  metadata: HierarchyFiltersMetadata | undefined,
): HierarchyFiltersResult => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<HierarchyFiltersState>(() => ({
    search: searchParams.get("h-search") || "",
    statuses: parseListParam<HierarchyStatus>(searchParams.get("h-status")),
    priorities: parseListParam<Priority>(searchParams.get("h-priority")),
    assignees: parseListParam<string>(searchParams.get("h-assignee")),
    mvpOnly: searchParams.get("h-mvp") === "true",
    visibilityMode: (searchParams.get("h-visibility") as FilterVisibilityMode) || "dim",
    viewMode: (searchParams.get("h-view") as HierarchyViewMode) || "hierarchy",
    includeArchived: searchParams.get("h-archived") === "true",
  }), [searchParams]);

  const updateSearchParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        updater(next);
        return next;
      });
    },
    [setSearchParams],
  );

  const setSearch = useCallback((value: string) => {
    updateSearchParams((params) => {
      if (value) {
        params.set("h-search", value);
      } else {
        params.delete("h-search");
      }
    });
  }, [updateSearchParams]);

  const toggleStatus = useCallback((status: HierarchyStatus) => {
    updateSearchParams((params) => {
      const current = parseListParam<HierarchyStatus>(params.get("h-status"));
      const next = current.includes(status) ? current.filter((item) => item !== status) : [...current, status];
      updateParam(params, "h-status", next);
    });
  }, [updateSearchParams]);

  const togglePriority = useCallback((priority: Priority) => {
    updateSearchParams((params) => {
      const current = parseListParam<Priority>(params.get("h-priority"));
      const next = current.includes(priority) ? current.filter((item) => item !== priority) : [...current, priority];
      updateParam(params, "h-priority", next);
    });
  }, [updateSearchParams]);

  const toggleAssignee = useCallback((assignee: string) => {
    updateSearchParams((params) => {
      const current = parseListParam<string>(params.get("h-assignee"));
      const next = current.includes(assignee) ? current.filter((item) => item !== assignee) : [...current, assignee];
      updateParam(params, "h-assignee", next);
    });
  }, [updateSearchParams]);

  const toggleMvpOnly = useCallback(() => {
    updateSearchParams((params) => {
      const current = params.get("h-mvp") === "true";
      updateParam(params, "h-mvp", !current);
    });
  }, [updateSearchParams]);

  const setVisibilityMode = useCallback((mode: FilterVisibilityMode) => {
    updateSearchParams((params) => {
      updateParam(params, "h-visibility", mode);
    });
  }, [updateSearchParams]);

  const setViewMode = useCallback((mode: HierarchyViewMode) => {
    updateSearchParams((params) => {
      updateParam(params, "h-view", mode);
    });
  }, [updateSearchParams]);

  const setIncludeArchived = useCallback((value: boolean) => {
    updateSearchParams((params) => {
      updateParam(params, "h-archived", value);
    });
  }, [updateSearchParams]);

  const applyFilters = useCallback(
    (nodes: FlattenedNode[]) => filterNodes(nodes, filters),
    [filters],
  );

  // Ensure URL params never reference values that do not exist anymore (e.g., assignee removed)
  // This cleanup runs when metadata changes
  useMemo(() => {
    if (!metadata) return;
    updateSearchParams((params) => {
      const currentAssignees = parseListParam<string>(params.get("h-assignee"));
      const validAssignees = currentAssignees.filter((assignee) => metadata.assignees[assignee]);
      if (validAssignees.length !== currentAssignees.length) {
        updateParam(params, "h-assignee", validAssignees);
      }
    });
  }, [metadata, updateSearchParams]);

  return {
    filters,
    setSearch,
    toggleStatus,
    togglePriority,
    toggleAssignee,
    toggleMvpOnly,
    setVisibilityMode,
    setViewMode,
    setIncludeArchived,
    applyFilters,
  };
};
