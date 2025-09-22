/**
 * Hierarchy Dependency Service - Extension for TreeView Integration
 *
 * Extends the base dependencyService with hierarchy-specific operations
 * for TreeView visualization, filtering, and topological analysis.
 */

import { dependencyService } from './dependencyService';
import type {
  Dependency,
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  DependencyEntityType,
  DependencyType,
  DependencyStatus,
  DependencyQueryParams,
  GraphQueryParams
} from '../types/dependency';
import type { HierarchyTreeNode } from '../../shared/types/hierarchy';

// Dependency statistics for TreeView badges
export interface HierarchyDependencyStats {
  nodeId: string;
  entityType: DependencyEntityType;
  entityId: string;
  blocking: number;    // How many items this node blocks
  blockedBy: number;   // How many items block this node
  related: number;     // Related dependencies
  total: number;       // Total dependencies
  hasConflicts: boolean;
  inCycle: boolean;
}

// Filter options for dependency visualization
export interface DependencyFilters {
  showBlocked: boolean;
  showBlocking: boolean;
  showWithoutDependencies: boolean;
  dependencyTypes: Set<DependencyType>;
  analysisMode: boolean;  // Topological ordering mode
}

// Topological sort result
export interface TopologicalResult {
  sortedNodes: HierarchyTreeNode[];
  cycles: Array<{
    nodeIds: string[];
    dependencies: string[];
    message: string;
  }>;
  hasCircularDependencies: boolean;
}

export const hierarchyDependencyService = {
  /**
   * Get dependency statistics for all nodes in a hierarchy tree
   */
  async getHierarchyDependencyStats(
    projectId: string,
    nodes: HierarchyTreeNode[]
  ): Promise<Map<string, HierarchyDependencyStats>> {
    try {
      const statsMap = new Map<string, HierarchyDependencyStats>();

      // Get all dependencies for the project
      const response = await dependencyService.getDependenciesByProject(projectId, {
        include_entities: true,
        limit: 1000 // TODO: Implement pagination if needed
      });

      // Initialize stats for all nodes
      for (const node of nodes) {
        if (node.type !== 'project') {
          statsMap.set(node.nodeId, {
            nodeId: node.nodeId,
            entityType: node.type as DependencyEntityType,
            entityId: node.id,
            blocking: 0,
            blockedBy: 0,
            related: 0,
            total: 0,
            hasConflicts: false,
            inCycle: false
          });
        }
      }

      // Process dependencies and update stats
      for (const dependency of response.dependencies) {
        const fromNodeId = this.createNodeId(dependency.from_type, dependency.from_id);
        const toNodeId = this.createNodeId(dependency.to_type, dependency.to_id);

        const fromStats = statsMap.get(fromNodeId);
        const toStats = statsMap.get(toNodeId);

        if (fromStats) {
          if (dependency.dependency_type === 'blocks') {
            fromStats.blocking++;
          } else if (dependency.dependency_type === 'depends_on') {
            fromStats.blockedBy++;
          } else if (dependency.dependency_type === 'related_to') {
            fromStats.related++;
          }
          fromStats.total++;

          if (dependency.status === 'conflict') {
            fromStats.hasConflicts = true;
          }
        }

        if (toStats) {
          if (dependency.dependency_type === 'blocks') {
            toStats.blockedBy++;
          } else if (dependency.dependency_type === 'depends_on') {
            toStats.blocking++;
          } else if (dependency.dependency_type === 'related_to') {
            toStats.related++;
          }
          toStats.total++;

          if (dependency.status === 'conflict') {
            toStats.hasConflicts = true;
          }
        }
      }

      // Check for circular dependencies
      const circularCheck = await dependencyService.checkCircularDependencies(projectId);
      if (circularCheck.hasCircular) {
        for (const cycle of circularCheck.cycles) {
          for (const entity of cycle.entities) {
            const nodeId = this.createNodeId(entity.type, entity.id);
            const stats = statsMap.get(nodeId);
            if (stats) {
              stats.inCycle = true;
            }
          }
        }
      }

      return statsMap;
    } catch (error) {
      console.error('Failed to get hierarchy dependency stats:', error);
      throw error;
    }
  },

  /**
   * Filter nodes based on dependency criteria
   */
  filterNodesByDependencies(
    nodes: HierarchyTreeNode[],
    stats: Map<string, HierarchyDependencyStats>,
    filters: DependencyFilters
  ): HierarchyTreeNode[] {
    return nodes.filter(node => {
      if (node.type === 'project') return true; // Always show project root

      const nodeStats = stats.get(node.nodeId);
      if (!nodeStats) return !filters.showBlocked && !filters.showBlocking; // Show if not filtering

      const isBlocked = nodeStats.blockedBy > 0;
      const isBlocking = nodeStats.blocking > 0;
      const hasNoDependencies = nodeStats.total === 0;

      // Apply filters
      if (filters.showBlocked && isBlocked) return true;
      if (filters.showBlocking && isBlocking) return true;
      if (filters.showWithoutDependencies && hasNoDependencies) return true;

      // If no specific filters are active, show all
      if (!filters.showBlocked && !filters.showBlocking && !filters.showWithoutDependencies) {
        return true;
      }

      return false;
    });
  },

  /**
   * Perform topological sort on hierarchy nodes based on dependencies
   */
  async performTopologicalSort(
    projectId: string,
    nodes: HierarchyTreeNode[]
  ): Promise<TopologicalResult> {
    try {
      // Get project dependencies
      const response = await dependencyService.getDependenciesByProject(projectId, {
        include_entities: true,
        limit: 1000
      });

      // Check for circular dependencies first
      const circularCheck = await dependencyService.checkCircularDependencies(projectId);

      if (circularCheck.hasCircular) {
        return {
          sortedNodes: nodes, // Return original order if circular
          cycles: circularCheck.cycles.map(cycle => ({
            nodeIds: cycle.entities.map(e => this.createNodeId(e.type, e.id)),
            dependencies: cycle.dependencies,
            message: `Circular dependency detected: ${cycle.entities.map(e => e.title).join(' → ')}`
          })),
          hasCircularDependencies: true
        };
      }

      // Build dependency graph for topological sort
      const nodeMap = new Map<string, HierarchyTreeNode>();
      const dependencyMap = new Map<string, Set<string>>();

      for (const node of nodes) {
        if (node.type !== 'project') {
          const nodeId = node.nodeId;
          nodeMap.set(nodeId, node);
          dependencyMap.set(nodeId, new Set());
        }
      }

      // Add dependency edges (only 'blocks' and 'depends_on' for ordering)
      for (const dependency of response.dependencies) {
        const fromNodeId = this.createNodeId(dependency.from_type, dependency.from_id);
        const toNodeId = this.createNodeId(dependency.to_type, dependency.to_id);

        if (dependency.dependency_type === 'blocks') {
          // If A blocks B, then B depends on A (B should come after A)
          const toDeps = dependencyMap.get(toNodeId);
          if (toDeps) {
            toDeps.add(fromNodeId);
          }
        } else if (dependency.dependency_type === 'depends_on') {
          // If A depends on B, then A should come after B
          const fromDeps = dependencyMap.get(fromNodeId);
          if (fromDeps) {
            fromDeps.add(toNodeId);
          }
        }
      }

      // Perform Kahn's algorithm for topological sorting
      const sorted: HierarchyTreeNode[] = [];
      const inDegree = new Map<string, number>();
      const queue: string[] = [];

      // Calculate in-degrees
      for (const [nodeId] of nodeMap) {
        inDegree.set(nodeId, 0);
      }

      for (const [nodeId, deps] of dependencyMap) {
        for (const depId of deps) {
          const current = inDegree.get(nodeId) || 0;
          inDegree.set(nodeId, current + 1);
        }
      }

      // Add nodes with no dependencies to queue
      for (const [nodeId, degree] of inDegree) {
        if (degree === 0) {
          queue.push(nodeId);
        }
      }

      // Process queue
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentNode = nodeMap.get(currentId);
        if (currentNode) {
          sorted.push(currentNode);
        }

        // Update in-degrees of dependent nodes
        for (const [nodeId, deps] of dependencyMap) {
          if (deps.has(currentId)) {
            const newDegree = (inDegree.get(nodeId) || 0) - 1;
            inDegree.set(nodeId, newDegree);
            if (newDegree === 0) {
              queue.push(nodeId);
            }
          }
        }
      }

      // Add project node at the beginning and any unprocessed nodes at the end
      const projectNode = nodes.find(n => n.type === 'project');
      const finalSorted = projectNode ? [projectNode, ...sorted] : sorted;

      // Add any nodes that weren't in the sort (no dependencies)
      for (const node of nodes) {
        if (node.type !== 'project' && !sorted.find(n => n.nodeId === node.nodeId)) {
          finalSorted.push(node);
        }
      }

      return {
        sortedNodes: finalSorted,
        cycles: [],
        hasCircularDependencies: false
      };
    } catch (error) {
      console.error('Failed to perform topological sort:', error);
      return {
        sortedNodes: nodes,
        cycles: [],
        hasCircularDependencies: false
      };
    }
  },

  /**
   * Get dependencies for a specific node with full entity details
   */
  async getNodeDependencies(
    entityType: DependencyEntityType,
    entityId: string
  ): Promise<{
    incoming: Array<Dependency & { from_entity: NonNullable<Dependency['from_entity']> }>;
    outgoing: Array<Dependency & { to_entity: NonNullable<Dependency['to_entity']> }>;
  }> {
    try {
      const response = await dependencyService.getDependenciesForEntity(entityType, entityId, {
        include_entities: true,
        limit: 100
      });

      const incoming: Array<Dependency & { from_entity: NonNullable<Dependency['from_entity']> }> = [];
      const outgoing: Array<Dependency & { to_entity: NonNullable<Dependency['to_entity']> }> = [];

      for (const dependency of response.dependencies) {
        if (dependency.to_id === entityId && dependency.to_type === entityType && dependency.from_entity) {
          incoming.push(dependency as any);
        } else if (dependency.from_id === entityId && dependency.from_type === entityType && dependency.to_entity) {
          outgoing.push(dependency as any);
        }
      }

      return { incoming, outgoing };
    } catch (error) {
      console.error(`Failed to get dependencies for ${entityType} ${entityId}:`, error);
      throw error;
    }
  },

  /**
   * Navigate to a dependency target and expand the tree path
   */
  async navigateToDependency(
    targetType: DependencyEntityType,
    targetId: string,
    onExpand: (path: string[]) => void,
    onSelect: (nodeId: string) => void
  ): Promise<void> {
    try {
      // Create the target node ID
      const targetNodeId = this.createNodeId(targetType, targetId);

      // For now, we'll just select the target
      // In a full implementation, we'd need to:
      // 1. Determine the full path to the target (project -> epic -> story -> task)
      // 2. Expand all parent nodes in the path
      // 3. Scroll to and select the target

      onSelect(targetNodeId);

      // TODO: Implement path expansion based on hierarchy
      // This would require knowing the full hierarchy structure
    } catch (error) {
      console.error(`Failed to navigate to ${targetType} ${targetId}:`, error);
      throw error;
    }
  },

  /**
   * Helper to create consistent node IDs
   */
  createNodeId(entityType: DependencyEntityType, entityId: string): string {
    return `${entityType}-${entityId}`;
  },

  /**
   * Parse node ID back to entity type and ID
   */
  parseNodeId(nodeId: string): { type: DependencyEntityType; id: string } | null {
    const parts = nodeId.split('-');
    if (parts.length < 2) return null;

    const type = parts[0] as DependencyEntityType;
    const id = parts.slice(1).join('-'); // Handle IDs with dashes

    if (!['epic', 'story', 'task'].includes(type)) return null;

    return { type, id };
  },

  /**
   * Get dependency suggestions for a node
   */
  async getDependencySuggestions(
    entityType: DependencyEntityType,
    entityId: string
  ) {
    return dependencyService.getSuggestedDependencies(entityType, entityId);
  },

  /**
   * Create a new dependency with validation
   */
  async createDependency(request: {
    from_type: DependencyEntityType;
    from_id: string;
    to_type: DependencyEntityType;
    to_id: string;
    dependency_type: DependencyType;
    description?: string;
  }) {
    // Validate the dependency first
    const validation = await dependencyService.validateDependency(request);
    if (!validation.valid) {
      throw new Error(`Invalid dependency: ${validation.conflicts?.[0]?.message || 'Unknown validation error'}`);
    }

    return dependencyService.createDependency(request);
  },

  /**
   * Delete a dependency
   */
  async deleteDependency(dependencyId: string) {
    return dependencyService.deleteDependency(dependencyId);
  }
};

export default hierarchyDependencyService;