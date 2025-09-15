/**
 * Story Types Module
 *
 * Re-exports all Story-related types from the shared hierarchy types
 * and adds any Story-specific type extensions.
 */

// Re-export hierarchy types related to Stories
export type {
  Story,
  CreateStoryRequest,
  UpdateStoryRequest,
  StoryCounts,
  HierarchyStatus,
  Priority,
  QueryOptions,
  ListResponse,
  HierarchyError,
  ProgressCalculation,
} from "../../shared/types/hierarchy";

// Story-specific extended types
export interface StoryWithMetrics extends Story {
  metrics: {
    total_tasks: number;
    completed_tasks: number;
    total_subtasks: number;
    completed_subtasks: number;
    task_completion_rate: number;
    subtask_completion_rate: number;
  };
}

// Story filter types
export interface StoryFilters {
  status?: HierarchyStatus[];
  priority?: Priority[];
  mvp_only?: boolean;
  has_tasks?: boolean;
  completion_rate_min?: number;
  completion_rate_max?: number;
  epic_id?: string;
}

// Story sorting options
export type StorySortField = 'title' | 'created_at' | 'updated_at' | 'priority' | 'progress' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface StorySortOptions {
  field: StorySortField;
  direction: SortDirection;
}

// Story query parameters combining filters and sorting
export interface StoryQueryParams extends QueryOptions {
  sort?: StorySortOptions;
  filters?: StoryFilters;
  include_metrics?: boolean;
}

// Move story request type
export interface MoveStoryBetweenEpicsRequest {
  story_id: string;
  from_epic_id: string;
  to_epic_id: string;
}