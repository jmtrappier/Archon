/**
 * Dependency React Query Hooks
 * Following the exact pattern established by useEpicQueries.ts and useTaskQueries.ts
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dependencyService } from "../services";
import type {
  Dependency,
  CreateDependencyRequest,
  UpdateDependencyRequest,
  DependencyListResponse,
  DependencyQueryParams,
  DependencyGraph,
  GraphQueryParams,
  BatchDependencyRequest,
  BatchDependencyResponse,
  DependencyEntityType,
  DependencyValidation,
} from "../types";

// Query keys for caching
export const dependencyKeys = {
  all: ["dependencies"] as const,
  lists: () => [...dependencyKeys.all, "list"] as const,
  list: (projectId: string, params?: DependencyQueryParams) => [
    ...dependencyKeys.lists(),
    projectId,
    params,
  ] as const,
  details: () => [...dependencyKeys.all, "detail"] as const,
  detail: (dependencyId: string) => [...dependencyKeys.details(), dependencyId] as const,
  entity: (entityType: DependencyEntityType, entityId: string) => [
    ...dependencyKeys.all,
    "entity",
    entityType,
    entityId,
  ] as const,
  graph: (params: GraphQueryParams) => [...dependencyKeys.all, "graph", params] as const,
  stats: (projectId: string) => [...dependencyKeys.all, "stats", projectId] as const,
  circular: (projectId: string) => [...dependencyKeys.all, "circular", projectId] as const,
  suggestions: (entityType: DependencyEntityType, entityId: string) => [
    ...dependencyKeys.all,
    "suggestions",
    entityType,
    entityId,
  ] as const,
} as const;

/**
 * Hook to get dependencies for a project
 */
export function useDependenciesByProject(
  projectId: string,
  params?: DependencyQueryParams,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: dependencyKeys.list(projectId, params),
    queryFn: () => dependencyService.getDependenciesByProject(projectId, params),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30000, // 30 seconds
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * Hook to get dependencies for a specific entity
 */
export function useDependenciesForEntity(
  entityType: DependencyEntityType,
  entityId: string,
  params?: Omit<DependencyQueryParams, "entity_type" | "entity_id">,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: dependencyKeys.entity(entityType, entityId),
    queryFn: () => dependencyService.getDependenciesForEntity(entityType, entityId, params),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30000,
  });
}

/**
 * Hook to get a specific dependency
 */
export function useDependency(
  dependencyId: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: dependencyKeys.detail(dependencyId),
    queryFn: () => dependencyService.getDependency(dependencyId),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30000,
  });
}

/**
 * Hook to get dependency graph for visualization
 */
export function useDependencyGraph(
  params: GraphQueryParams,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: dependencyKeys.graph(params),
    queryFn: () => dependencyService.getDependencyGraph(params),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 60000, // 1 minute for graph data
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * Hook to get dependency statistics
 */
export function useDependencyStats(
  projectId: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: dependencyKeys.stats(projectId),
    queryFn: () => dependencyService.getDependencyStats(projectId),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 60000,
  });
}

/**
 * Hook to check for circular dependencies
 */
export function useCircularDependencies(
  projectId: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: dependencyKeys.circular(projectId),
    queryFn: () => dependencyService.checkCircularDependencies(projectId),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 60000,
  });
}

/**
 * Hook to get suggested dependencies
 */
export function useSuggestedDependencies(
  entityType: DependencyEntityType,
  entityId: string,
  limit = 10,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: dependencyKeys.suggestions(entityType, entityId),
    queryFn: () => dependencyService.getSuggestedDependencies(entityType, entityId, limit),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 300000, // 5 minutes for suggestions
  });
}

/**
 * Hook to create a new dependency
 */
export function useCreateDependency(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dependencyData: CreateDependencyRequest) =>
      dependencyService.createDependency(dependencyData),
    onSuccess: (newDependency) => {
      // Invalidate and refetch dependency lists
      queryClient.invalidateQueries({ queryKey: dependencyKeys.lists() });

      // Invalidate graph queries
      queryClient.invalidateQueries({ queryKey: [...dependencyKeys.all, "graph"] });

      // Invalidate entity-specific queries
      queryClient.invalidateQueries({
        queryKey: dependencyKeys.entity(newDependency.from_type, newDependency.from_id),
      });
      queryClient.invalidateQueries({
        queryKey: dependencyKeys.entity(newDependency.to_type, newDependency.to_id),
      });

      // Invalidate stats and circular dependency checks
      queryClient.invalidateQueries({ queryKey: dependencyKeys.stats(projectId) });
      queryClient.invalidateQueries({ queryKey: dependencyKeys.circular(projectId) });

      // Invalidate suggestions
      queryClient.invalidateQueries({
        queryKey: [...dependencyKeys.all, "suggestions"],
      });
    },
    onError: (error) => {
      console.error("Failed to create dependency:", error);
    },
  });
}

/**
 * Hook to update a dependency
 */
export function useUpdateDependency(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dependencyId, updates }: { dependencyId: string; updates: UpdateDependencyRequest }) =>
      dependencyService.updateDependency(dependencyId, updates),
    onSuccess: (updatedDependency) => {
      // Update the dependency in the cache
      queryClient.setQueryData(
        dependencyKeys.detail(updatedDependency.id),
        updatedDependency
      );

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: dependencyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: [...dependencyKeys.all, "graph"] });
      queryClient.invalidateQueries({ queryKey: dependencyKeys.stats(projectId) });

      // Invalidate entity queries
      queryClient.invalidateQueries({
        queryKey: dependencyKeys.entity(updatedDependency.from_type, updatedDependency.from_id),
      });
      queryClient.invalidateQueries({
        queryKey: dependencyKeys.entity(updatedDependency.to_type, updatedDependency.to_id),
      });
    },
    onError: (error) => {
      console.error("Failed to update dependency:", error);
    },
  });
}

/**
 * Hook to delete a dependency
 */
export function useDeleteDependency(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dependencyId: string) => dependencyService.deleteDependency(dependencyId),
    onSuccess: (_, dependencyId) => {
      // Remove the dependency from cache
      queryClient.removeQueries({ queryKey: dependencyKeys.detail(dependencyId) });

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: dependencyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: [...dependencyKeys.all, "graph"] });
      queryClient.invalidateQueries({ queryKey: dependencyKeys.stats(projectId) });
      queryClient.invalidateQueries({ queryKey: dependencyKeys.circular(projectId) });

      // Invalidate all entity queries - we don't know which entities were involved
      queryClient.invalidateQueries({
        queryKey: [...dependencyKeys.all, "entity"],
      });

      // Invalidate suggestions
      queryClient.invalidateQueries({
        queryKey: [...dependencyKeys.all, "suggestions"],
      });
    },
    onError: (error) => {
      console.error("Failed to delete dependency:", error);
    },
  });
}

/**
 * Hook to validate a dependency before creation
 */
export function useValidateDependency() {
  return useMutation({
    mutationFn: (dependencyData: CreateDependencyRequest) =>
      dependencyService.validateDependency(dependencyData),
    onError: (error) => {
      console.error("Failed to validate dependency:", error);
    },
  });
}

/**
 * Hook to create multiple dependencies in batch
 */
export function useCreateDependenciesBatch(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (batchRequest: BatchDependencyRequest) =>
      dependencyService.createDependenciesBatch(batchRequest),
    onSuccess: (response) => {
      // Invalidate all related queries if any dependencies were created
      if (response.created.length > 0) {
        queryClient.invalidateQueries({ queryKey: dependencyKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...dependencyKeys.all, "graph"] });
        queryClient.invalidateQueries({ queryKey: dependencyKeys.stats(projectId) });
        queryClient.invalidateQueries({ queryKey: dependencyKeys.circular(projectId) });

        // Invalidate entity queries for all involved entities
        response.created.forEach(dep => {
          queryClient.invalidateQueries({
            queryKey: dependencyKeys.entity(dep.from_type, dep.from_id),
          });
          queryClient.invalidateQueries({
            queryKey: dependencyKeys.entity(dep.to_type, dep.to_id),
          });
        });

        // Invalidate suggestions
        queryClient.invalidateQueries({
          queryKey: [...dependencyKeys.all, "suggestions"],
        });
      }
    },
    onError: (error) => {
      console.error("Failed to create dependencies in batch:", error);
    },
  });
}

/**
 * Hook to get dependencies with automatic refetching based on entity changes
 */
export function useRealtimeDependencies(
  projectId: string,
  params?: DependencyQueryParams,
  options?: {
    refetchInterval?: number;
    enabled?: boolean;
  }
) {
  return useDependenciesByProject(projectId, params, {
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval ?? 30000, // Auto-refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

/**
 * Hook to get graph data with automatic refresh
 */
export function useRealtimeDependencyGraph(
  params: GraphQueryParams,
  options?: {
    refetchInterval?: number;
    enabled?: boolean;
  }
) {
  return useDependencyGraph(params, {
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval ?? 60000, // Auto-refresh every minute
    staleTime: 20000, // Consider graph data stale after 20 seconds
  });
}