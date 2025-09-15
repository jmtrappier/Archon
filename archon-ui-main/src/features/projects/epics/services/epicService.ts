/**
 * Epic Management Service
 * Following the exact pattern established by taskService.ts
 */

import { formatZodErrors, ValidationError } from "../../shared/api";
import { callAPIWithETag, invalidateETagCache } from "../../shared/apiWithEtag";
import { validateCreateEpic, validateUpdateEpic } from "../schemas";
import type {
  Epic,
  CreateEpicRequest,
  UpdateEpicRequest,
  EpicCounts,
  EpicQueryParams,
  ListResponse,
  HierarchyStatus
} from "../types";

export const epicService = {
  /**
   * Get all epics for a project
   */
  async getEpicsByProject(projectId: string, params?: EpicQueryParams): Promise<Epic[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.append('search', params.search);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.priority) queryParams.append('priority', params.priority);
      if (params?.mvp_only) queryParams.append('mvp_only', params.mvp_only.toString());
      if (params?.include_archived) queryParams.append('include_archived', params.include_archived.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());

      const queryString = queryParams.toString();
      const url = `/api/projects/${projectId}/epics${queryString ? `?${queryString}` : ''}`;

      const epics = await callAPIWithETag<Epic[]>(url);
      return epics;
    } catch (error) {
      console.error(`Failed to get epics for project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Get a specific epic by ID
   */
  async getEpic(epicId: string): Promise<Epic> {
    try {
      const epic = await callAPIWithETag<Epic>(`/api/epics/${epicId}`);
      return epic;
    } catch (error) {
      console.error(`Failed to get epic ${epicId}:`, error);
      throw error;
    }
  },

  /**
   * Create a new epic
   */
  async createEpic(epicData: CreateEpicRequest): Promise<Epic> {
    // Validate input
    const validation = validateCreateEpic(epicData);
    if (!validation.success) {
      throw new ValidationError(formatZodErrors(validation.error));
    }

    try {
      const requestData = validation.data;

      const epic = await callAPIWithETag<Epic>("/api/epics", {
        method: "POST",
        body: JSON.stringify(requestData),
      });

      // Invalidate epic list cache for the project
      invalidateETagCache(`/api/projects/${epicData.project_id}/epics`);
      invalidateETagCache("/api/epics/counts");

      return epic;
    } catch (error) {
      console.error("Failed to create epic:", error);
      throw error;
    }
  },

  /**
   * Update an existing epic
   */
  async updateEpic(epicId: string, updates: UpdateEpicRequest): Promise<Epic> {
    // Validate input
    const validation = validateUpdateEpic(updates);
    if (!validation.success) {
      throw new ValidationError(formatZodErrors(validation.error));
    }

    try {
      const epic = await callAPIWithETag<Epic>(`/api/epics/${epicId}`, {
        method: "PUT",
        body: JSON.stringify(validation.data),
      });

      // Invalidate related caches
      invalidateETagCache("/api/epics/counts");

      return epic;
    } catch (error) {
      console.error(`Failed to update epic ${epicId}:`, error);
      throw error;
    }
  },

  /**
   * Update epic status (for drag & drop operations)
   */
  async updateEpicStatus(epicId: string, status: HierarchyStatus): Promise<Epic> {
    try {
      const epic = await callAPIWithETag<Epic>(`/api/epics/${epicId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      // Invalidate epic counts cache when status changes
      invalidateETagCache("/api/epics/counts");

      return epic;
    } catch (error) {
      console.error(`Failed to update epic status ${epicId}:`, error);
      throw error;
    }
  },

  /**
   * Delete an epic
   */
  async deleteEpic(epicId: string): Promise<void> {
    try {
      await callAPIWithETag<void>(`/api/epics/${epicId}`, {
        method: "DELETE",
      });

      // Invalidate epic counts cache after deletion
      invalidateETagCache("/api/epics/counts");
    } catch (error) {
      console.error(`Failed to delete epic ${epicId}:`, error);
      throw error;
    }
  },

  /**
   * Update epic priority for better organization
   */
  async updateEpicPriority(epicId: string, priority: "low" | "medium" | "high" | "critical"): Promise<Epic> {
    try {
      const epic = await this.updateEpic(epicId, { priority });
      return epic;
    } catch (error) {
      console.error(`Failed to update epic priority for ${epicId}:`, error);
      throw error;
    }
  },

  /**
   * Calculate epic progress based on its stories
   */
  async calculateEpicProgress(epicId: string): Promise<number> {
    try {
      const response = await callAPIWithETag<{ progress: number }>(`/api/epics/${epicId}/progress`);
      return response.progress;
    } catch (error) {
      console.error(`Failed to calculate epic progress for ${epicId}:`, error);
      throw error;
    }
  },

  /**
   * Get epic counts for all projects in a single batch request
   * Optimized endpoint to avoid N+1 query problem
   */
  async getEpicCountsForAllProjects(): Promise<Record<string, EpicCounts>> {
    try {
      const response = await callAPIWithETag<Record<string, EpicCounts>>("/api/projects/epic-counts");
      return response || {};
    } catch (error) {
      console.error("Failed to get epic counts for all projects:", error);
      throw error;
    }
  },

  /**
   * Get stories for a specific epic (delegation to story service)
   */
  async getEpicStories(epicId: string): Promise<any[]> {
    try {
      // Delegate to story service
      const stories = await callAPIWithETag<any[]>(`/api/epics/${epicId}/stories`);
      return stories;
    } catch (error) {
      console.error(`Failed to get stories for epic ${epicId}:`, error);
      throw error;
    }
  },

  /**
   * Archive/unarchive an epic (soft delete)
   */
  async archiveEpic(epicId: string, archive: boolean = true): Promise<Epic> {
    try {
      const epic = await callAPIWithETag<Epic>(`/api/epics/${epicId}/archive`, {
        method: "PUT",
        body: JSON.stringify({ archived: archive }),
      });

      // Invalidate caches after archiving
      invalidateETagCache("/api/epics/counts");

      return epic;
    } catch (error) {
      console.error(`Failed to ${archive ? 'archive' : 'unarchive'} epic ${epicId}:`, error);
      throw error;
    }
  },
};