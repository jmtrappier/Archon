/**
 * React Query hooks for hierarchy dependency operations
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import hierarchyDependencyService, {
  type HierarchyDependencyStats,
  type DependencyFilters,
  type TopologicalResult
} from '../services/hierarchyDependencyService';
import type { HierarchyTreeNode } from '../../shared/types/hierarchy';
import type {
  DependencyEntityType,
  DependencyType,
  Dependency,
  CreateDependencyRequest
} from '../types/dependency';

// Query keys
export const hierarchyDependencyKeys = {
  all: ['hierarchyDependencies'] as const,
  stats: (projectId: string) => [...hierarchyDependencyKeys.all, 'stats', projectId] as const,
  nodeDependencies: (entityType: DependencyEntityType, entityId: string) =>
    [...hierarchyDependencyKeys.all, 'node', entityType, entityId] as const,
  topological: (projectId: string) => [...hierarchyDependencyKeys.all, 'topological', projectId] as const,
  suggestions: (entityType: DependencyEntityType, entityId: string) =>
    [...hierarchyDependencyKeys.all, 'suggestions', entityType, entityId] as const,
};

/**
 * Hook to get dependency statistics for hierarchy nodes
 */
export function useHierarchyDependencyStats(
  projectId: string,
  nodes: HierarchyTreeNode[],
  enabled: boolean = true
) {
  return useQuery({
    queryKey: hierarchyDependencyKeys.stats(projectId),
    queryFn: () => hierarchyDependencyService.getHierarchyDependencyStats(projectId, nodes),
    enabled: enabled && !!projectId && nodes.length > 0,
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
}

/**
 * Hook to get dependencies for a specific node
 */
export function useNodeDependencies(
  entityType: DependencyEntityType,
  entityId: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: hierarchyDependencyKeys.nodeDependencies(entityType, entityId),
    queryFn: () => hierarchyDependencyService.getNodeDependencies(entityType, entityId),
    enabled: enabled && !!entityType && !!entityId,
    staleTime: 30000,
    retry: 2,
  });
}

/**
 * Hook to perform topological sort on hierarchy nodes
 */
export function useTopologicalSort(
  projectId: string,
  nodes: HierarchyTreeNode[],
  enabled: boolean = false // Only enable when analysis mode is active
) {
  return useQuery({
    queryKey: hierarchyDependencyKeys.topological(projectId),
    queryFn: () => hierarchyDependencyService.performTopologicalSort(projectId, nodes),
    enabled: enabled && !!projectId && nodes.length > 0,
    staleTime: 60000, // 1 minute - topological sort is expensive
    retry: 1,
  });
}

/**
 * Hook to get dependency suggestions for a node
 */
export function useDependencySuggestions(
  entityType: DependencyEntityType,
  entityId: string,
  enabled: boolean = false // Only load when modal is open
) {
  return useQuery({
    queryKey: hierarchyDependencyKeys.suggestions(entityType, entityId),
    queryFn: () => hierarchyDependencyService.getDependencySuggestions(entityType, entityId),
    enabled: enabled && !!entityType && !!entityId,
    staleTime: 300000, // 5 minutes
    retry: 2,
  });
}

/**
 * Hook to create a new dependency
 */
export function useCreateDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateDependencyRequest) =>
      hierarchyDependencyService.createDependency(request),
    onSuccess: (newDependency) => {
      toast.success('Dependency created successfully');

      // Invalidate relevant queries
      const fromNodeId = hierarchyDependencyService.createNodeId(
        newDependency.from_type,
        newDependency.from_id
      );
      const toNodeId = hierarchyDependencyService.createNodeId(
        newDependency.to_type,
        newDependency.to_id
      );

      // Invalidate all dependency-related queries for affected entities
      queryClient.invalidateQueries({
        queryKey: hierarchyDependencyKeys.nodeDependencies(newDependency.from_type, newDependency.from_id)
      });
      queryClient.invalidateQueries({
        queryKey: hierarchyDependencyKeys.nodeDependencies(newDependency.to_type, newDependency.to_id)
      });

      // Invalidate project-wide queries
      if (newDependency.from_entity?.project_id) {
        queryClient.invalidateQueries({
          queryKey: hierarchyDependencyKeys.stats(newDependency.from_entity.project_id)
        });
        queryClient.invalidateQueries({
          queryKey: hierarchyDependencyKeys.topological(newDependency.from_entity.project_id)
        });
      }
    },
    onError: (error) => {
      console.error('Failed to create dependency:', error);
      toast.error('Failed to create dependency. Please try again.');
    },
  });
}

/**
 * Hook to delete a dependency
 */
export function useDeleteDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dependencyId: string) =>
      hierarchyDependencyService.deleteDependency(dependencyId),
    onSuccess: (_, dependencyId) => {
      toast.success('Dependency deleted successfully');

      // Invalidate all dependency queries
      // Note: We don't have specific entity info here, so we invalidate broadly
      queryClient.invalidateQueries({
        queryKey: hierarchyDependencyKeys.all
      });
    },
    onError: (error) => {
      console.error('Failed to delete dependency:', error);
      toast.error('Failed to delete dependency. Please try again.');
    },
  });
}

/**
 * Hook to manage dependency filters state
 */
export function useDependencyFilters(initialFilters?: Partial<DependencyFilters>) {
  const [filters, setFilters] = React.useState<DependencyFilters>({
    showBlocked: false,
    showBlocking: false,
    showWithoutDependencies: false,
    dependencyTypes: new Set(['blocks', 'depends_on', 'related_to']),
    analysisMode: false,
    ...initialFilters
  });

  const updateFilter = React.useCallback((key: keyof DependencyFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const toggleFilter = React.useCallback((key: keyof DependencyFilters) => {
    setFilters(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const resetFilters = React.useCallback(() => {
    setFilters({
      showBlocked: false,
      showBlocking: false,
      showWithoutDependencies: false,
      dependencyTypes: new Set(['blocks', 'depends_on', 'related_to']),
      analysisMode: false
    });
  }, []);

  return {
    filters,
    updateFilter,
    toggleFilter,
    resetFilters,
    hasActiveFilters: filters.showBlocked || filters.showBlocking || filters.showWithoutDependencies || filters.analysisMode
  };
}

/**
 * Hook for filtered and sorted hierarchy nodes
 */
export function useFilteredHierarchyNodes(
  projectId: string,
  nodes: HierarchyTreeNode[],
  filters: DependencyFilters
) {
  const { data: stats } = useHierarchyDependencyStats(projectId, nodes);
  const { data: topological } = useTopologicalSort(projectId, nodes, filters.analysisMode);

  return React.useMemo(() => {
    if (!stats) return nodes;

    let filteredNodes = nodes;

    // Apply dependency filters
    if (filters.showBlocked || filters.showBlocking || filters.showWithoutDependencies) {
      filteredNodes = hierarchyDependencyService.filterNodesByDependencies(
        filteredNodes,
        stats,
        filters
      );
    }

    // Apply topological sorting if in analysis mode
    if (filters.analysisMode && topological) {
      return topological.sortedNodes.filter(node =>
        filteredNodes.some(fn => fn.nodeId === node.nodeId)
      );
    }

    return filteredNodes;
  }, [nodes, stats, topological, filters]);
}

export default {
  useHierarchyDependencyStats,
  useNodeDependencies,
  useTopologicalSort,
  useDependencySuggestions,
  useCreateDependency,
  useDeleteDependency,
  useDependencyFilters,
  useFilteredHierarchyNodes,
};