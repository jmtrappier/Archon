/**
 * Story Management Service
 * Following the exact pattern established by taskService.ts and epicService.ts
 */

import { formatZodErrors, ValidationError } from "../../shared/api";
import { callAPIWithETag, invalidateETagCache } from "../../shared/apiWithEtag";
import { validateCreateStory, validateMoveStory, validateUpdateStory } from "../schemas";
import type {
  CreateStoryRequest,
  HierarchyStatus,
  ListResponse,
  MoveStoryBetweenEpicsRequest,
  Story,
  StoryCounts,
  StoryQueryParams,
  StoryWithEpic,
  UpdateStoryRequest,
} from "../types";

export const storyService = {
  /**
   * Get all stories for an epic
   */
  async getStoriesByEpic(epicId: string, params?: StoryQueryParams): Promise<Story[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.append("search", params.search);
      if (params?.status) queryParams.append("status", params.status);
      if (params?.priority) queryParams.append("priority", params.priority);
      if (params?.mvp_only) queryParams.append("mvp_only", params.mvp_only.toString());
      if (params?.include_archived) queryParams.append("include_archived", params.include_archived.toString());
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.offset) queryParams.append("offset", params.offset.toString());

      const queryString = queryParams.toString();
      const url = `/api/epics/${epicId}/stories${queryString ? `?${queryString}` : ""}`;

      const stories = await callAPIWithETag<Story[]>(url);
      return stories;
    } catch (error) {
      console.error(`Failed to get stories for epic ${epicId}:`, error);
      throw error;
    }
  },

  /**
   * Get all stories for a project (across all epics) with Epic context
   */
  async getStoriesByProject(projectId: string, params?: StoryQueryParams): Promise<StoryWithEpic[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.append("search", params.search);
      if (params?.status) queryParams.append("status", params.status);
      if (params?.priority) queryParams.append("priority", params.priority);
      if (params?.mvp_only) queryParams.append("mvp_only", params.mvp_only.toString());
      if (params?.include_archived) queryParams.append("include_archived", params.include_archived.toString());
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.offset) queryParams.append("offset", params.offset.toString());

      const queryString = queryParams.toString();
      const url = `/api/projects/${projectId}/stories${queryString ? `?${queryString}` : ""}`;

      const stories = await callAPIWithETag<StoryWithEpic[]>(url);
      return stories;
    } catch (error) {
      console.error(`Failed to get stories for project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Get a specific story by ID with Epic context
   */
  async getStory(storyId: string): Promise<StoryWithEpic> {
    try {
      const story = await callAPIWithETag<StoryWithEpic>(`/api/stories/${storyId}`);
      return story;
    } catch (error) {
      console.error(`Failed to get story ${storyId}:`, error);
      throw error;
    }
  },

  /**
   * Create a new story
   */
  async createStory(storyData: CreateStoryRequest): Promise<Story> {
    // Validate input
    const validation = validateCreateStory(storyData);
    if (!validation.success) {
      throw new ValidationError(formatZodErrors(validation.error));
    }

    try {
      const requestData = validation.data;

      const story = await callAPIWithETag<Story>("/api/stories", {
        method: "POST",
        body: JSON.stringify(requestData),
      });

      // Invalidate story list cache for the epic
      invalidateETagCache(`/api/epics/${storyData.epic_id}/stories`);
      invalidateETagCache("/api/stories/counts");

      return story;
    } catch (error) {
      console.error("Failed to create story:", error);
      throw error;
    }
  },

  /**
   * Update an existing story
   */
  async updateStory(storyId: string, updates: UpdateStoryRequest): Promise<Story> {
    // Validate input
    const validation = validateUpdateStory(updates);
    if (!validation.success) {
      throw new ValidationError(formatZodErrors(validation.error));
    }

    try {
      const story = await callAPIWithETag<Story>(`/api/stories/${storyId}`, {
        method: "PUT",
        body: JSON.stringify(validation.data),
      });

      // Invalidate related caches
      invalidateETagCache("/api/stories/counts");

      return story;
    } catch (error) {
      console.error(`Failed to update story ${storyId}:`, error);
      throw error;
    }
  },

  /**
   * Update story status (for drag & drop operations)
   */
  async updateStoryStatus(storyId: string, status: HierarchyStatus): Promise<Story> {
    try {
      const story = await callAPIWithETag<Story>(`/api/stories/${storyId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      // Invalidate story counts cache when status changes
      invalidateETagCache("/api/stories/counts");

      return story;
    } catch (error) {
      console.error(`Failed to update story status ${storyId}:`, error);
      throw error;
    }
  },

  /**
   * Move story between epics
   */
  async moveStoryBetweenEpics(moveRequest: MoveStoryBetweenEpicsRequest): Promise<Story> {
    // Validate input
    const validation = validateMoveStory(moveRequest);
    if (!validation.success) {
      throw new ValidationError(formatZodErrors(validation.error));
    }

    try {
      const story = await callAPIWithETag<Story>(`/api/stories/${moveRequest.story_id}/move`, {
        method: "PUT",
        body: JSON.stringify({
          to_epic_id: moveRequest.to_epic_id,
        }),
      });

      // Invalidate caches for both epics
      invalidateETagCache(`/api/epics/${moveRequest.from_epic_id}/stories`);
      invalidateETagCache(`/api/epics/${moveRequest.to_epic_id}/stories`);
      invalidateETagCache("/api/stories/counts");

      return story;
    } catch (error) {
      console.error(`Failed to move story ${moveRequest.story_id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a story
   */
  async deleteStory(storyId: string): Promise<void> {
    try {
      await callAPIWithETag<void>(`/api/stories/${storyId}`, {
        method: "DELETE",
      });

      // Invalidate story counts cache after deletion
      invalidateETagCache("/api/stories/counts");
    } catch (error) {
      console.error(`Failed to delete story ${storyId}:`, error);
      throw error;
    }
  },

  /**
   * Update story priority
   */
  async updateStoryPriority(storyId: string, priority: "low" | "medium" | "high" | "critical"): Promise<Story> {
    try {
      const story = await this.updateStory(storyId, { priority });
      return story;
    } catch (error) {
      console.error(`Failed to update story priority for ${storyId}:`, error);
      throw error;
    }
  },

  /**
   * Calculate story progress based on its tasks
   */
  async calculateStoryProgress(storyId: string): Promise<number> {
    try {
      const response = await callAPIWithETag<{ progress: number }>(`/api/stories/${storyId}/progress`);
      return response.progress;
    } catch (error) {
      console.error(`Failed to calculate story progress for ${storyId}:`, error);
      throw error;
    }
  },

  /**
   * Get story counts for all epics in a single batch request
   * Optimized endpoint to avoid N+1 query problem
   */
  async getStoryCountsForAllEpics(): Promise<Record<string, StoryCounts>> {
    try {
      const response = await callAPIWithETag<Record<string, StoryCounts>>("/api/epics/story-counts");
      return response || {};
    } catch (error) {
      console.error("Failed to get story counts for all epics:", error);
      throw error;
    }
  },

  /**
   * Get tasks for a specific story (delegation to task service)
   */
  async getStoryTasks(storyId: string): Promise<any[]> {
    try {
      // This will delegate to task service
      const tasks = await callAPIWithETag<any[]>(`/api/stories/${storyId}/tasks`);
      return tasks;
    } catch (error) {
      console.error(`Failed to get tasks for story ${storyId}:`, error);
      throw error;
    }
  },

  /**
   * Archive/unarchive a story (soft delete)
   */
  async archiveStory(storyId: string, archive: boolean = true): Promise<Story> {
    try {
      const story = await callAPIWithETag<Story>(`/api/stories/${storyId}/archive`, {
        method: "PUT",
        body: JSON.stringify({ archived: archive }),
      });

      // Invalidate caches after archiving
      invalidateETagCache("/api/stories/counts");

      return story;
    } catch (error) {
      console.error(`Failed to ${archive ? "archive" : "unarchive"} story ${storyId}:`, error);
      throw error;
    }
  },

  /**
   * Toggle MVP flag for a story
   */
  async toggleStoryMvpFlag(storyId: string, mvpFlag: boolean): Promise<Story> {
    try {
      const story = await this.updateStory(storyId, { mvp_flag: mvpFlag });
      return story;
    } catch (error) {
      console.error(`Failed to toggle MVP flag for story ${storyId}:`, error);
      throw error;
    }
  },

  /**
   * Reorder stories within an epic
   */
  async reorderStoriesInEpic(epicId: string, orderedStoryIds: string[]): Promise<Story[]> {
    try {
      const stories = await callAPIWithETag<Story[]>(`/api/epics/${epicId}/stories/reorder`, {
        method: "PUT",
        body: JSON.stringify({ story_ids: orderedStoryIds }),
      });

      // Invalidate epic's story cache
      invalidateETagCache(`/api/epics/${epicId}/stories`);

      return stories;
    } catch (error) {
      console.error(`Failed to reorder stories in epic ${epicId}:`, error);
      throw error;
    }
  },

  /**
   * Alias for getStoriesByEpic for backward compatibility
   */
  async listStories(epicId: string, params?: StoryQueryParams): Promise<Story[]> {
    return this.getStoriesByEpic(epicId, params);
  },
};
