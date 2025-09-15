/**
 * Hierarchy Types - Foundation for BMAD Hierarchy
 *
 * Defines the core types for PROJECT → EPIC → STORY → TASK → SUBTASK hierarchy
 * following the existing Task service patterns established in the codebase.
 */

// Re-export existing task types that are now part of hierarchy
export type { DatabaseTaskStatus, Assignee, TaskPriority } from "../../tasks/types";

// Base hierarchy status - extends existing DatabaseTaskStatus to include 'waiting'
export type HierarchyStatus = "todo" | "doing" | "review" | "waiting" | "done";

// Priority type for all hierarchy levels
export type Priority = "low" | "medium" | "high" | "critical";

// Base hierarchy interface - common fields across all levels
export interface HierarchyItem {
  id: string;
  title: string;
  description: string;
  status: HierarchyStatus;
  created_at: string;
  updated_at: string;

  // Soft delete fields
  archived?: boolean;
  archived_at?: string;
  archived_by?: string;
}

// Epic interface - top level in hierarchy after Project
export interface Epic extends HierarchyItem {
  project_id: string;
  priority: Priority;
  mvp_flag: boolean;
  progress?: number; // Calculated from child Stories

  // Related entities (populated by queries when needed)
  stories?: Story[];
}

// Story interface - child of Epic, parent of Tasks
export interface Story extends HierarchyItem {
  epic_id: string;
  priority: Priority;
  mvp_flag: boolean;
  progress?: number; // Calculated from child Tasks

  // Related entities (populated by queries when needed)
  epic?: Epic;
  tasks?: Task[];
}

// Enhanced Task interface - extends existing Task with hierarchy fields
export interface Task extends HierarchyItem {
  project_id: string;
  story_id?: string; // Link to parent Story
  parent_task_id?: string; // For Subtasks (existing field)
  assignee: string; // Using existing Assignee type
  task_order: number;
  feature?: string;
  priority?: Priority;
  progress?: number; // Calculated from Subtasks if any

  // Task-specific fields from existing implementation
  sources?: TaskSource[];
  code_examples?: TaskCodeExample[];

  // Extended UI properties
  featureColor?: string;

  // Related entities (populated by queries when needed)
  story?: Story;
  subtasks?: Task[]; // Child Tasks (Subtasks)
  parent_task?: Task; // Parent Task if this is a Subtask
}

// Task-specific types from existing implementation
export type TaskSource = {
  url: string;
  type: string;
  relevance: string;
} | Record<string, unknown>;

export type TaskCodeExample = {
  file: string;
  function: string;
  purpose: string;
} | Record<string, unknown>;

// Request types for creating hierarchy items
export interface CreateEpicRequest {
  project_id: string;
  title: string;
  description?: string;
  priority?: Priority;
  mvp_flag?: boolean;
}

export interface CreateStoryRequest {
  epic_id: string;
  title: string;
  description?: string;
  priority?: Priority;
  mvp_flag?: boolean;
}

// Enhanced Task create request - maintains compatibility with existing
export interface CreateTaskRequest {
  project_id: string;
  story_id?: string; // NEW: Link to Story
  parent_task_id?: string; // Existing: For Subtasks
  title: string;
  description: string;
  status?: HierarchyStatus;
  assignee?: string;
  task_order?: number;
  feature?: string;
  featureColor?: string;
  priority?: Priority;
  sources?: TaskSource[];
  code_examples?: TaskCodeExample[];
}

// Update request types
export interface UpdateEpicRequest {
  title?: string;
  description?: string;
  status?: HierarchyStatus;
  priority?: Priority;
  mvp_flag?: boolean;
}

export interface UpdateStoryRequest {
  epic_id?: string; // Allow moving Story to different Epic
  title?: string;
  description?: string;
  status?: HierarchyStatus;
  priority?: Priority;
  mvp_flag?: boolean;
}

export interface UpdateTaskRequest {
  story_id?: string; // Allow moving Task to different Story
  parent_task_id?: string; // Allow moving Subtask to different Task
  title?: string;
  description?: string;
  status?: HierarchyStatus;
  assignee?: string;
  task_order?: number;
  feature?: string;
  featureColor?: string;
  priority?: Priority;
  sources?: TaskSource[];
  code_examples?: TaskCodeExample[];
}

// Hierarchy path types for breadcrumb navigation
export interface HierarchyPath {
  project: { id: string; title: string };
  epic?: { id: string; title: string };
  story?: { id: string; title: string };
  task?: { id: string; title: string };
  subtask?: { id: string; title: string };
}

// Progress calculation types
export interface ProgressCalculation {
  total_items: number;
  completed_items: number;
  in_progress_items: number;
  todo_items: number;
  waiting_items: number;
  review_items: number;
  progress_percentage: number;
}

// Count types for each hierarchy level
export interface EpicCounts {
  todo: number;
  doing: number;
  review: number;
  waiting: number;
  done: number;
}

export interface StoryCounts {
  todo: number;
  doing: number;
  review: number;
  waiting: number;
  done: number;
}

// Re-export existing TaskCounts for consistency
export type { TaskCounts } from "../../tasks/types";

// Cross-level operation types
export interface MoveTaskRequest {
  task_id: string;
  from_story_id?: string;
  to_story_id: string;
  new_task_order?: number;
}

export interface MoveStoryRequest {
  story_id: string;
  from_epic_id: string;
  to_epic_id: string;
}

// Query options for list operations
export interface QueryOptions {
  search?: string;
  status?: HierarchyStatus;
  assignee?: string;
  priority?: Priority;
  mvp_only?: boolean;
  include_archived?: boolean;
  limit?: number;
  offset?: number;
}

// Service response types with pagination
export interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// Error types for hierarchy operations
export interface HierarchyError {
  type: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN' | 'CIRCULAR_DEPENDENCY' | 'HIERARCHY_CONSTRAINT';
  message: string;
  details?: Record<string, unknown>;
}