import { callAPIWithETag, invalidateETagCache } from "../../shared/apiWithEtag";

export interface Epic {
  id: string;
  project_id: string;
  code: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "review" | "done" | "waiting";
  priority: number;
  mvp_flag: boolean;
  progress?: number;
  story_count?: number;
  completed_stories?: number;
  created_at: string;
  updated_at: string;
}

export interface EpicsResponse {
  data: Epic[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  filters_applied: Record<string, any>;
}

export const epicService = {
  async listEpics(projectId: string): Promise<Epic[]> {
    try {
      const response = await callAPIWithETag<EpicsResponse>(
        `/api/projects/${projectId}/epics`
      );
      return response?.data || [];
    } catch (error) {
      console.error(`Failed to list epics for project ${projectId}:`, error);
      throw error;
    }
  },

  async getEpic(epicId: string): Promise<Epic> {
    try {
      const epic = await callAPIWithETag<Epic>(`/api/epics/${epicId}`);
      return epic;
    } catch (error) {
      console.error(`Failed to get epic ${epicId}:`, error);
      throw error;
    }
  },

  async createEpic(projectId: string, data: Partial<Epic>): Promise<Epic> {
    try {
      const response = await callAPIWithETag<Epic>(
        `/api/projects/${projectId}/epics`,
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      );

      // Invalidate cache
      invalidateETagCache(`/api/projects/${projectId}/epics`);

      return response;
    } catch (error) {
      console.error("Failed to create epic:", error);
      throw error;
    }
  },

  async updateEpic(epicId: string, updates: Partial<Epic>): Promise<Epic> {
    try {
      const epic = await callAPIWithETag<Epic>(`/api/epics/${epicId}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });

      // Invalidate caches
      invalidateETagCache(`/api/epics/${epicId}`);

      return epic;
    } catch (error) {
      console.error(`Failed to update epic ${epicId}:`, error);
      throw error;
    }
  },

  async deleteEpic(epicId: string): Promise<void> {
    try {
      await callAPIWithETag(`/api/epics/${epicId}`, {
        method: "DELETE",
      });

      // Invalidate cache
      invalidateETagCache(`/api/epics/${epicId}`);
    } catch (error) {
      console.error(`Failed to delete epic ${epicId}:`, error);
      throw error;
    }
  },
};