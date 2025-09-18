/**
 * Epic Types Module
 *
 * Re-exports all Epic-related types from the shared hierarchy types
 * and adds any Epic-specific type extensions.
 */

// Re-export hierarchy types related to Epics
export type {
  CreateEpicRequest,
  Epic,
  EpicCounts,
  HierarchyError,
  HierarchyStatus,
  ListResponse,
  Priority,
  ProgressCalculation,
  QueryOptions,
  UpdateEpicRequest,
} from "../../shared/types/hierarchy";

// Epic-specific extended types
export interface EpicWithMetrics extends Epic {
  metrics: {
    total_stories: number;
    completed_stories: number;
    total_tasks: number;
    completed_tasks: number;
    story_completion_rate: number;
    task_completion_rate: number;
  };
}

// Epic filter types
export interface EpicFilters {
  status?: HierarchyStatus[];
  priority?: Priority[];
  mvp_only?: boolean;
  has_stories?: boolean;
  completion_rate_min?: number;
  completion_rate_max?: number;
}

// Epic sorting options
export type EpicSortField = "title" | "created_at" | "updated_at" | "priority" | "progress" | "status";
export type SortDirection = "asc" | "desc";

export interface EpicSortOptions {
  field: EpicSortField;
  direction: SortDirection;
}

// Epic query parameters combining filters and sorting
export interface EpicQueryParams extends QueryOptions {
  sort?: EpicSortOptions;
  filters?: EpicFilters;
  include_metrics?: boolean;
}
