/**
 * Dependency Utilities
 *
 * Helper functions for working with dependencies, validation, and visualization
 */

import type { HierarchyStatus, Priority } from "../../shared/types/hierarchy";
import type {
  Dependency,
  DependencyConflict,
  DependencyEdge,
  DependencyEntityType,
  DependencyNode,
  DependencyStatus,
  DependencyType,
  GraphFilter,
} from "../types";

// Color schemes for different dependency types and statuses
export const DEPENDENCY_COLORS = {
  types: {
    blocks: "#ef4444", // red-500
    depends_on: "#3b82f6", // blue-500
    related_to: "#10b981", // emerald-500
  },
  statuses: {
    active: "#22c55e", // green-500
    resolved: "#6b7280", // gray-500
    blocked: "#f59e0b", // amber-500
    conflict: "#dc2626", // red-600
  },
  entities: {
    epic: "#8b5cf6", // violet-500
    story: "#06b6d4", // cyan-500
    task: "#f97316", // orange-500
  },
  priorities: {
    low: "#6b7280", // gray-500
    medium: "#3b82f6", // blue-500
    high: "#f59e0b", // amber-500
    critical: "#dc2626", // red-600
  },
  hierarchyStatuses: {
    todo: "#6b7280", // gray-500
    doing: "#3b82f6", // blue-500
    review: "#f59e0b", // amber-500
    waiting: "#8b5cf6", // violet-500
    done: "#22c55e", // green-500
  },
} as const;

/**
 * Get color for dependency type
 */
export function getDependencyTypeColor(type: DependencyType): string {
  return DEPENDENCY_COLORS.types[type];
}

/**
 * Get color for dependency status
 */
export function getDependencyStatusColor(status: DependencyStatus): string {
  return DEPENDENCY_COLORS.statuses[status];
}

/**
 * Get color for entity type
 */
export function getEntityTypeColor(type: DependencyEntityType): string {
  return DEPENDENCY_COLORS.entities[type];
}

/**
 * Get color for priority
 */
export function getPriorityColor(priority: Priority): string {
  return DEPENDENCY_COLORS.priorities[priority];
}

/**
 * Get color for hierarchy status
 */
export function getHierarchyStatusColor(status: HierarchyStatus): string {
  return DEPENDENCY_COLORS.hierarchyStatuses[status];
}

/**
 * Get display name for dependency type
 */
export function getDependencyTypeLabel(type: DependencyType): string {
  const labels: Record<DependencyType, string> = {
    blocks: "Blocks",
    depends_on: "Depends On",
    related_to: "Related To",
  };
  return labels[type];
}

/**
 * Get display name for dependency status
 */
export function getDependencyStatusLabel(status: DependencyStatus): string {
  const labels: Record<DependencyStatus, string> = {
    active: "Active",
    resolved: "Resolved",
    blocked: "Blocked",
    conflict: "Conflict",
  };
  return labels[status];
}

/**
 * Get display name for entity type
 */
export function getEntityTypeLabel(type: DependencyEntityType): string {
  const labels: Record<DependencyEntityType, string> = {
    epic: "Epic",
    story: "Story",
    task: "Task",
  };
  return labels[type];
}

/**
 * Determine dependency status based on related entities
 */
export function calculateDependencyStatus(
  fromEntity: { status: HierarchyStatus },
  toEntity: { status: HierarchyStatus },
  dependencyType: DependencyType,
): DependencyStatus {
  // For "blocks" relationships
  if (dependencyType === "blocks") {
    if (fromEntity.status === "done") {
      return "resolved";
    }
    if (toEntity.status === "doing" && fromEntity.status !== "done") {
      return "blocked";
    }
    return "active";
  }

  // For "depends_on" relationships
  if (dependencyType === "depends_on") {
    if (toEntity.status === "done") {
      return "resolved";
    }
    if (fromEntity.status === "doing" && toEntity.status !== "done") {
      return "blocked";
    }
    return "active";
  }

  // For "related_to" relationships
  if (dependencyType === "related_to") {
    if (fromEntity.status === "done" && toEntity.status === "done") {
      return "resolved";
    }
    return "active";
  }

  return "active";
}

/**
 * Validate dependency relationship
 */
export function validateDependency(
  fromEntity: DependencyNode,
  toEntity: DependencyNode,
  dependencyType: DependencyType,
): { valid: boolean; error?: string } {
  // Cannot depend on itself
  if (fromEntity.id === toEntity.id) {
    return { valid: false, error: "Cannot create dependency from entity to itself" };
  }

  // Validate hierarchy constraints
  const hierarchyOrder: Record<DependencyEntityType, number> = {
    epic: 0,
    story: 1,
    task: 2,
  };

  // For "blocks" and "depends_on", validate hierarchy makes sense
  if (dependencyType === "blocks" || dependencyType === "depends_on") {
    const fromLevel = hierarchyOrder[fromEntity.type];
    const toLevel = hierarchyOrder[toEntity.type];

    // Epic cannot depend on Story or Task
    if (fromEntity.type === "epic" && (toEntity.type === "story" || toEntity.type === "task")) {
      if (dependencyType === "depends_on") {
        return { valid: false, error: "Epic cannot depend on lower-level entities" };
      }
    }

    // Task cannot block Epic
    if (fromEntity.type === "task" && toEntity.type === "epic" && dependencyType === "blocks") {
      return { valid: false, error: "Task cannot block Epic" };
    }
  }

  // Check for same project
  if (fromEntity.project_id !== toEntity.project_id) {
    return { valid: false, error: "Dependencies can only exist within the same project" };
  }

  // Validate hierarchy parent-child relationships
  if (dependencyType === "depends_on") {
    // Story cannot depend on its own Epic
    if (fromEntity.type === "story" && toEntity.type === "epic" && fromEntity.epic_id === toEntity.id) {
      return { valid: false, error: "Story cannot depend on its parent Epic" };
    }

    // Task cannot depend on its own Story
    if (fromEntity.type === "task" && toEntity.type === "story" && fromEntity.story_id === toEntity.id) {
      return { valid: false, error: "Task cannot depend on its parent Story" };
    }
  }

  return { valid: true };
}

/**
 * Check if dependency creates a circular reference
 */
export function detectCircularDependency(
  dependencies: Dependency[],
  newDependency: { from_id: string; to_id: string },
): boolean {
  // Build adjacency list
  const graph = new Map<string, Set<string>>();

  // Add existing dependencies
  dependencies.forEach((dep) => {
    if (!graph.has(dep.from_id)) {
      graph.set(dep.from_id, new Set());
    }
    graph.get(dep.from_id)!.add(dep.to_id);
  });

  // Add new dependency
  if (!graph.has(newDependency.from_id)) {
    graph.set(newDependency.from_id, new Set());
  }
  graph.get(newDependency.from_id)!.add(newDependency.to_id);

  // Check for cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = graph.get(nodeId) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  // Check all nodes for cycles
  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      if (hasCycle(nodeId)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Find shortest path between two entities
 */
export function findShortestPath(dependencies: Dependency[], fromId: string, toId: string): string[] | null {
  if (fromId === toId) return [fromId];

  // Build adjacency list
  const graph = new Map<string, string[]>();
  dependencies.forEach((dep) => {
    if (!graph.has(dep.from_id)) {
      graph.set(dep.from_id, []);
    }
    graph.get(dep.from_id)!.push(dep.to_id);
  });

  // BFS to find shortest path
  const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [fromId] }];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;

    const neighbors = graph.get(id) || [];
    for (const neighbor of neighbors) {
      if (neighbor === toId) {
        return [...path, neighbor];
      }

      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, path: [...path, neighbor] });
      }
    }
  }

  return null; // No path found
}

/**
 * Get dependency impact analysis
 */
export function analyzeDependencyImpact(
  dependencies: Dependency[],
  entityId: string,
): {
  directlyAffects: string[];
  indirectlyAffects: string[];
  directlyAffectedBy: string[];
  indirectlyAffectedBy: string[];
} {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  // Build graphs
  dependencies.forEach((dep) => {
    // Outgoing dependencies (what this entity affects)
    if (!outgoing.has(dep.from_id)) {
      outgoing.set(dep.from_id, []);
    }
    outgoing.get(dep.from_id)!.push(dep.to_id);

    // Incoming dependencies (what affects this entity)
    if (!incoming.has(dep.to_id)) {
      incoming.set(dep.to_id, []);
    }
    incoming.get(dep.to_id)!.push(dep.from_id);
  });

  // Find all affected entities (downstream)
  function findDownstream(startId: string): { direct: string[]; indirect: string[] } {
    const direct = outgoing.get(startId) || [];
    const indirect = new Set<string>();
    const visited = new Set<string>([startId]);

    const queue = [...direct];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      if (!direct.includes(currentId)) {
        indirect.add(currentId);
      }

      const neighbors = outgoing.get(currentId) || [];
      queue.push(...neighbors);
    }

    return { direct, indirect: Array.from(indirect) };
  }

  // Find all affecting entities (upstream)
  function findUpstream(startId: string): { direct: string[]; indirect: string[] } {
    const direct = incoming.get(startId) || [];
    const indirect = new Set<string>();
    const visited = new Set<string>([startId]);

    const queue = [...direct];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      if (!direct.includes(currentId)) {
        indirect.add(currentId);
      }

      const neighbors = incoming.get(currentId) || [];
      queue.push(...neighbors);
    }

    return { direct, indirect: Array.from(indirect) };
  }

  const downstream = findDownstream(entityId);
  const upstream = findUpstream(entityId);

  return {
    directlyAffects: downstream.direct,
    indirectlyAffects: downstream.indirect,
    directlyAffectedBy: upstream.direct,
    indirectlyAffectedBy: upstream.indirect,
  };
}

/**
 * Filter graph data based on criteria
 */
export function filterGraph(
  nodes: DependencyNode[],
  edges: DependencyEdge[],
  filter: GraphFilter,
): { nodes: DependencyNode[]; edges: DependencyEdge[] } {
  // Filter nodes
  let filteredNodes = nodes.filter((node) => {
    // Entity type filter
    if (filter.entityTypes.size > 0 && !filter.entityTypes.has(node.type)) {
      return false;
    }

    // Status filter
    if (filter.statuses.size > 0 && !filter.statuses.has(node.status)) {
      return false;
    }

    // Priority filter
    if (filter.priorities.size > 0 && node.priority && !filter.priorities.has(node.priority)) {
      return false;
    }

    // Search query filter
    if (filter.searchQuery && !node.title.toLowerCase().includes(filter.searchQuery.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Filter edges
  const filteredEdges = edges.filter((edge) => {
    // Dependency type filter
    if (filter.dependencyTypes.size > 0 && !filter.dependencyTypes.has(edge.type)) {
      return false;
    }

    // Ensure both source and target nodes are in filtered nodes
    const hasSource = filteredNodes.some((node) => node.id === edge.source);
    const hasTarget = filteredNodes.some((node) => node.id === edge.target);

    return hasSource && hasTarget;
  });

  // If showOnlyConnected is true, remove nodes with no edges
  if (filter.showOnlyConnected) {
    const connectedNodeIds = new Set<string>();
    filteredEdges.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    filteredNodes = filteredNodes.filter((node) => connectedNodeIds.has(node.id));
  }

  return { nodes: filteredNodes, edges: filteredEdges };
}

/**
 * Calculate graph metrics
 */
export function calculateGraphMetrics(
  nodes: DependencyNode[],
  edges: DependencyEdge[],
): {
  totalNodes: number;
  totalEdges: number;
  density: number;
  avgDegree: number;
  maxInDegree: number;
  maxOutDegree: number;
  isolatedNodes: number;
  stronglyConnectedComponents: number;
} {
  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  // Calculate degrees
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  nodes.forEach((node) => {
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
  });

  edges.forEach((edge) => {
    outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  const maxInDegree = Math.max(...Array.from(inDegree.values()), 0);
  const maxOutDegree = Math.max(...Array.from(outDegree.values()), 0);
  const avgDegree = nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;

  // Calculate density
  const maxPossibleEdges = nodeCount * (nodeCount - 1);
  const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

  // Count isolated nodes (no incoming or outgoing edges)
  const isolatedNodes = nodes.filter(
    (node) => (inDegree.get(node.id) || 0) === 0 && (outDegree.get(node.id) || 0) === 0,
  ).length;

  return {
    totalNodes: nodeCount,
    totalEdges: edgeCount,
    density,
    avgDegree,
    maxInDegree,
    maxOutDegree,
    isolatedNodes,
    stronglyConnectedComponents: 0, // Simplified for now
  };
}

/**
 * Generate dependency suggestions based on hierarchy and patterns
 */
export function generateDependencySuggestions(
  node: DependencyNode,
  allNodes: DependencyNode[],
  existingDependencies: Dependency[],
): Array<{
  targetNode: DependencyNode;
  suggestedType: DependencyType;
  confidence: number;
  reason: string;
}> {
  const suggestions: Array<{
    targetNode: DependencyNode;
    suggestedType: DependencyType;
    confidence: number;
    reason: string;
  }> = [];

  // Get existing dependency IDs for this node
  const existingFromIds = new Set(
    existingDependencies.filter((dep) => dep.from_id === node.id).map((dep) => dep.to_id),
  );
  const existingToIds = new Set(existingDependencies.filter((dep) => dep.to_id === node.id).map((dep) => dep.from_id));

  allNodes.forEach((targetNode) => {
    if (targetNode.id === node.id) return;
    if (existingFromIds.has(targetNode.id) || existingToIds.has(targetNode.id)) return;

    // Hierarchy-based suggestions
    if (node.type === "task" && targetNode.type === "task") {
      // Tasks in same story might be related
      if (node.story_id === targetNode.story_id) {
        suggestions.push({
          targetNode,
          suggestedType: "related_to",
          confidence: 0.6,
          reason: "Tasks in same story",
        });
      }
    }

    if (node.type === "story" && targetNode.type === "story") {
      // Stories in same epic might be related
      if (node.epic_id === targetNode.epic_id) {
        suggestions.push({
          targetNode,
          suggestedType: "related_to",
          confidence: 0.5,
          reason: "Stories in same epic",
        });
      }
    }

    // Status-based suggestions
    if (node.status === "todo" && targetNode.status === "done") {
      suggestions.push({
        targetNode,
        suggestedType: "depends_on",
        confidence: 0.4,
        reason: "Completed work may be a dependency",
      });
    }

    if (node.status === "done" && targetNode.status === "todo") {
      suggestions.push({
        targetNode,
        suggestedType: "blocks",
        confidence: 0.3,
        reason: "Completed work may unblock pending work",
      });
    }

    // Priority-based suggestions
    if (node.priority === "high" && targetNode.priority === "low") {
      suggestions.push({
        targetNode,
        suggestedType: "blocks",
        confidence: 0.3,
        reason: "High priority may block low priority",
      });
    }
  });

  // Sort by confidence and return top suggestions
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}
