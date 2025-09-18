/**
 * Dependency Management Service
 * Following the exact pattern established by epicService.ts and taskService.ts
 */

import { formatZodErrors, ValidationError } from "../../shared/api";
import { callAPIWithETag, invalidateETagCache } from "../../shared/apiWithEtag";
import type {
  BatchDependencyRequest,
  BatchDependencyResponse,
  CreateDependencyRequest,
  Dependency,
  DependencyEntityType,
  DependencyGraph,
  DependencyListResponse,
  DependencyQueryParams,
  DependencyStatus,
  DependencyType,
  DependencyValidation,
  GraphQueryParams,
  UpdateDependencyRequest,
} from "../types";

export const dependencyService = {
  /**
   * Get all dependencies for a project
   */
  async getDependenciesByProject(
    projectId: string,
    params?: DependencyQueryParams
  ): Promise<DependencyListResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.entity_type) queryParams.append("entity_type", params.entity_type);
      if (params?.entity_id) queryParams.append("entity_id", params.entity_id);
      if (params?.dependency_type) queryParams.append("dependency_type", params.dependency_type);
      if (params?.status) queryParams.append("status", params.status);
      if (params?.include_entities) queryParams.append("include_entities", params.include_entities.toString());
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.offset) queryParams.append("offset", params.offset.toString());

      const queryString = queryParams.toString();
      const url = `/api/projects/${projectId}/dependencies${queryString ? `?${queryString}` : ""}`;

      const response = await callAPIWithETag<DependencyListResponse>(url);
      return response;
    } catch (error) {
      console.error(`Failed to get dependencies for project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Get dependencies for a specific entity (epic/story/task)
   */
  async getDependenciesForEntity(
    entityType: DependencyEntityType,
    entityId: string,
    params?: Omit<DependencyQueryParams, "entity_type" | "entity_id">
  ): Promise<DependencyListResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.dependency_type) queryParams.append("dependency_type", params.dependency_type);
      if (params?.status) queryParams.append("status", params.status);
      if (params?.include_entities) queryParams.append("include_entities", params.include_entities.toString());
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.offset) queryParams.append("offset", params.offset.toString());

      const queryString = queryParams.toString();
      const url = `/api/${entityType}s/${entityId}/dependencies${queryString ? `?${queryString}` : ""}`;

      const response = await callAPIWithETag<DependencyListResponse>(url);
      return response;
    } catch (error) {
      console.error(`Failed to get dependencies for ${entityType} ${entityId}:`, error);
      throw error;
    }
  },

  /**
   * Get a specific dependency by ID
   */
  async getDependency(dependencyId: string): Promise<Dependency> {
    try {
      const dependency = await callAPIWithETag<Dependency>(`/api/dependencies/${dependencyId}`);
      return dependency;
    } catch (error) {
      console.error(`Failed to get dependency ${dependencyId}:`, error);
      throw error;
    }
  },

  /**
   * Create a new dependency
   */
  async createDependency(dependencyData: CreateDependencyRequest): Promise<Dependency> {
    try {
      // Basic client-side validation
      if (!dependencyData.from_id || !dependencyData.to_id) {
        throw new ValidationError("From and To entities are required");
      }
      if (dependencyData.from_id === dependencyData.to_id && dependencyData.from_type === dependencyData.to_type) {
        throw new ValidationError("Cannot create dependency from entity to itself");
      }

      const dependency = await callAPIWithETag<Dependency>("/api/dependencies", {
        method: "POST",
        body: JSON.stringify(dependencyData),
      });

      // Invalidate related caches
      this.invalidateDependencyCaches(dependency);

      return dependency;
    } catch (error) {
      console.error("Failed to create dependency:", error);
      throw error;
    }
  },

  /**
   * Update an existing dependency
   */
  async updateDependency(dependencyId: string, updates: UpdateDependencyRequest): Promise<Dependency> {
    try {
      const dependency = await callAPIWithETag<Dependency>(`/api/dependencies/${dependencyId}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });

      // Invalidate related caches
      this.invalidateDependencyCaches(dependency);

      return dependency;
    } catch (error) {
      console.error(`Failed to update dependency ${dependencyId}:`, error);
      throw error;
    }
  },

  /**
   * Delete a dependency
   */
  async deleteDependency(dependencyId: string): Promise<void> {
    try {
      // Get dependency first to know which caches to invalidate
      const dependency = await this.getDependency(dependencyId);

      await callAPIWithETag<void>(`/api/dependencies/${dependencyId}`, {
        method: "DELETE",
      });

      // Invalidate related caches
      this.invalidateDependencyCaches(dependency);
    } catch (error) {
      console.error(`Failed to delete dependency ${dependencyId}:`, error);
      throw error;
    }
  },

  /**
   * Validate a dependency before creation
   */
  async validateDependency(dependencyData: CreateDependencyRequest): Promise<DependencyValidation> {
    try {
      const validation = await callAPIWithETag<DependencyValidation>("/api/dependencies/validate", {
        method: "POST",
        body: JSON.stringify(dependencyData),
      });

      return validation;
    } catch (error) {
      console.error("Failed to validate dependency:", error);
      throw error;
    }
  },

  /**
   * Create multiple dependencies in batch
   */
  async createDependenciesBatch(batchRequest: BatchDependencyRequest): Promise<BatchDependencyResponse> {
    try {
      const response = await callAPIWithETag<BatchDependencyResponse>("/api/dependencies/batch", {
        method: "POST",
        body: JSON.stringify(batchRequest),
      });

      // Invalidate caches for all created dependencies
      response.created.forEach((dependency) => {
        this.invalidateDependencyCaches(dependency);
      });

      return response;
    } catch (error) {
      console.error("Failed to create dependencies in batch:", error);
      throw error;
    }
  },

  /**
   * Get dependency graph for visualization
   */
  async getDependencyGraph(params: GraphQueryParams): Promise<DependencyGraph> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append("project_id", params.project_id);
      if (params.entity_types?.length) {
        params.entity_types.forEach(type => queryParams.append("entity_types", type));
      }
      if (params.max_depth) queryParams.append("max_depth", params.max_depth.toString());
      if (params.include_subtasks !== undefined) queryParams.append("include_subtasks", params.include_subtasks.toString());
      if (params.focus_entity_id) queryParams.append("focus_entity_id", params.focus_entity_id);
      if (params.focus_entity_type) queryParams.append("focus_entity_type", params.focus_entity_type);

      const queryString = queryParams.toString();
      const url = `/api/dependencies/graph${queryString ? `?${queryString}` : ""}`;

      const graph = await callAPIWithETag<DependencyGraph>(url);
      return graph;
    } catch (error) {
      console.error("Failed to get dependency graph:", error);
      throw error;
    }
  },

  /**
   * Get dependency statistics for a project
   */
  async getDependencyStats(projectId: string): Promise<{
    total: number;
    by_type: Record<DependencyType, number>;
    by_status: Record<DependencyStatus, number>;
    conflicts: number;
  }> {
    try {
      const stats = await callAPIWithETag<{
        total: number;
        by_type: Record<DependencyType, number>;
        by_status: Record<DependencyStatus, number>;
        conflicts: number;
      }>(`/api/projects/${projectId}/dependencies/stats`);

      return stats;
    } catch (error) {
      console.error(`Failed to get dependency stats for project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Check for circular dependencies
   */
  async checkCircularDependencies(projectId: string): Promise<{
    hasCircular: boolean;
    cycles: Array<{
      entities: Array<{ type: DependencyEntityType; id: string; title: string }>;
      dependencies: string[];
    }>;
  }> {
    try {
      const result = await callAPIWithETag<{
        hasCircular: boolean;
        cycles: Array<{
          entities: Array<{ type: DependencyEntityType; id: string; title: string }>;
          dependencies: string[];
        }>;
      }>(`/api/projects/${projectId}/dependencies/circular`);

      return result;
    } catch (error) {
      console.error(`Failed to check circular dependencies for project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Get suggestions for potential dependencies based on hierarchy and status
   */
  async getSuggestedDependencies(
    entityType: DependencyEntityType,
    entityId: string,
    limit = 10
  ): Promise<Array<{
    target_type: DependencyEntityType;
    target_id: string;
    target_title: string;
    suggested_type: DependencyType;
    confidence: number;
    reason: string;
  }>> {
    try {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
      });

      const url = `/api/${entityType}s/${entityId}/dependencies/suggestions?${queryParams.toString()}`;
      const suggestions = await callAPIWithETag<Array<{
        target_type: DependencyEntityType;
        target_id: string;
        target_title: string;
        suggested_type: DependencyType;
        confidence: number;
        reason: string;
      }>>(url);

      return suggestions;
    } catch (error) {
      console.error(`Failed to get dependency suggestions for ${entityType} ${entityId}:`, error);
      throw error;
    }
  },

  /**
   * Helper to invalidate dependency-related caches
   */
  invalidateDependencyCaches(dependency: Dependency): void {
    // Invalidate project dependency cache
    if (dependency.from_entity?.project_id) {
      invalidateETagCache(`/api/projects/${dependency.from_entity.project_id}/dependencies`);
      invalidateETagCache(`/api/projects/${dependency.from_entity.project_id}/dependencies/stats`);
      invalidateETagCache(`/api/dependencies/graph`);
    }

    // Invalidate entity-specific caches
    invalidateETagCache(`/api/${dependency.from_type}s/${dependency.from_id}/dependencies`);
    invalidateETagCache(`/api/${dependency.to_type}s/${dependency.to_id}/dependencies`);

    // Invalidate suggestions caches
    invalidateETagCache(`/api/${dependency.from_type}s/${dependency.from_id}/dependencies/suggestions`);
    invalidateETagCache(`/api/${dependency.to_type}s/${dependency.to_id}/dependencies/suggestions`);

    // Invalidate circular dependency checks
    if (dependency.from_entity?.project_id) {
      invalidateETagCache(`/api/projects/${dependency.from_entity.project_id}/dependencies/circular`);
    }
  },
};

export default dependencyService;
