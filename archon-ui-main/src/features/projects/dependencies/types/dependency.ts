/**
 * Dependency Types - Foundation for Dependency Visualization
 *
 * Defines the core types for dependencies between EPICs, STORIEs, and TASKs
 * following the existing service patterns and hierarchy types.
 */

import type { HierarchyStatus, Priority } from "../../shared/types/hierarchy";

// Dependency entity types
export type DependencyEntityType = "epic" | "story" | "task";

// Dependency relationship types
export type DependencyType = "blocks" | "depends_on" | "related_to";

// Dependency status based on entities involved
export type DependencyStatus = "active" | "resolved" | "blocked" | "conflict";

// Core dependency interface
export interface Dependency {
  id: string;
  from_type: DependencyEntityType;
  from_id: string;
  to_type: DependencyEntityType;
  to_id: string;
  dependency_type: DependencyType;
  created_at: string;
  updated_at: string;
  created_by?: string;
  description?: string;

  // Computed fields (populated by queries when needed)
  status?: DependencyStatus;
  from_entity?: DependencyEntity;
  to_entity?: DependencyEntity;
}

// Simplified entity representation for dependencies
export interface DependencyEntity {
  id: string;
  type: DependencyEntityType;
  title: string;
  status: HierarchyStatus;
  priority?: Priority;
  progress?: number;

  // Hierarchy context
  project_id: string;
  epic_id?: string; // For stories and tasks
  story_id?: string; // For tasks
  parent_task_id?: string; // For subtasks
}

// Node representation for graph visualization
export interface DependencyNode {
  id: string;
  type: DependencyEntityType;
  title: string;
  status: HierarchyStatus;
  priority?: Priority;
  progress?: number;

  // Hierarchy context for breadcrumb and navigation
  project_id: string;
  epic_id?: string;
  story_id?: string;
  parent_task_id?: string;

  // Graph positioning
  position?: { x: number; y: number };

  // Visual properties
  color?: string;
  size?: "sm" | "md" | "lg";
  isHighlighted?: boolean;
  isSelected?: boolean;

  // Relationships count
  incomingCount?: number;
  outgoingCount?: number;
}

// Edge representation for graph visualization
export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  type: DependencyType;
  status: DependencyStatus;

  // Visual properties
  color?: string;
  width?: number;
  isHighlighted?: boolean;
  isSelected?: boolean;

  // Path data for SVG rendering
  path?: string;

  // Label positioning
  labelPosition?: { x: number; y: number };
}

// Graph data structure
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];

  // Layout information
  width: number;
  height: number;

  // Statistics
  totalDependencies: number;
  activeDependencies: number;
  blockedDependencies: number;
  conflictDependencies: number;
}

// Request types for creating dependencies
export interface CreateDependencyRequest {
  from_type: DependencyEntityType;
  from_id: string;
  to_type: DependencyEntityType;
  to_id: string;
  dependency_type: DependencyType;
  description?: string;
}

// Update request for dependencies
export interface UpdateDependencyRequest {
  dependency_type?: DependencyType;
  description?: string;
}

// Query parameters for dependency operations
export interface DependencyQueryParams {
  entity_type?: DependencyEntityType;
  entity_id?: string;
  dependency_type?: DependencyType;
  status?: DependencyStatus;
  include_entities?: boolean;
  limit?: number;
  offset?: number;
}

// Response types for list operations
export interface DependencyListResponse {
  dependencies: Dependency[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// Graph query parameters
export interface GraphQueryParams {
  project_id: string;
  entity_types?: DependencyEntityType[];
  max_depth?: number;
  include_subtasks?: boolean;
  focus_entity_id?: string;
  focus_entity_type?: DependencyEntityType;
}

// Conflict detection result
export interface DependencyConflict {
  type: "circular" | "invalid_hierarchy" | "status_mismatch";
  message: string;
  entities: string[];
  dependencies: string[];
  suggestions?: string[];
}

// Validation result for dependency operations
export interface DependencyValidation {
  valid: boolean;
  conflicts?: DependencyConflict[];
  warnings?: string[];
}

// Batch dependency operations
export interface BatchDependencyRequest {
  dependencies: CreateDependencyRequest[];
  validate_before_create?: boolean;
}

export interface BatchDependencyResponse {
  created: Dependency[];
  failed: { request: CreateDependencyRequest; error: string }[];
  conflicts: DependencyConflict[];
}

// Graph layout types
export interface GraphLayout {
  algorithm: "force" | "hierarchical" | "circular" | "tree";
  options: {
    nodeSpacing?: number;
    levelSpacing?: number;
    centerForce?: number;
    repelForce?: number;
    linkDistance?: number;
    iterations?: number;
  };
}

// Graph interaction types
export interface GraphInteraction {
  type: "node_click" | "node_hover" | "edge_click" | "edge_hover" | "canvas_click";
  nodeId?: string;
  edgeId?: string;
  position?: { x: number; y: number };
}

// Graph filtering options
export interface GraphFilter {
  entityTypes: Set<DependencyEntityType>;
  dependencyTypes: Set<DependencyType>;
  statuses: Set<HierarchyStatus>;
  priorities: Set<Priority>;
  showOnlyConnected: boolean;
  searchQuery?: string;
}

// Performance optimization types
export interface GraphPerformanceOptions {
  maxNodes: number;
  maxEdges: number;
  virtualizeNodes: boolean;
  useWebGL: boolean;
  debounceLayout: number;
}

// Export all commonly used types
export type {
  // Core types
  DependencyEntityType,
  DependencyType,
  DependencyStatus,
  // Main interfaces
  Dependency,
  DependencyEntity,
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  // Request/Response types
  CreateDependencyRequest,
  UpdateDependencyRequest,
  DependencyQueryParams,
  DependencyListResponse,
  // Validation and conflicts
  DependencyConflict,
  DependencyValidation,
  // Graph types
  GraphQueryParams,
  GraphLayout,
  GraphInteraction,
  GraphFilter,
  GraphPerformanceOptions,
};
