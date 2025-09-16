import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { HierarchyStatus } from "../types";

// API base URL
const API_BASE = "http://localhost:8181";

// API helper function
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export const useStory = (storyId: string) => {
  return useQuery({
    queryKey: ["story", storyId],
    queryFn: () => apiCall(`/api/stories/${storyId}`),
    enabled: !!storyId,
  });
};

export const useStories = (epicId: string) => {
  return useQuery({
    queryKey: ["stories", epicId],
    queryFn: async () => {
      const response = await apiCall(`/api/epics/${epicId}/stories`);
      // Extract stories array from the response object
      return response.stories || [];
    },
    enabled: !!epicId,
  });
};

export const useProjectStories = (projectId: string) => {
  return useQuery({
    queryKey: ["project-stories", projectId],
    queryFn: async () => {
      const response = await apiCall(`/api/stories?project_id=${projectId}`);
      // Extract stories array from the response object
      return response.stories || [];
    },
    enabled: !!projectId,
  });
};

export const useCreateStory = (epicId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyData: {
      title: string;
      description: string;
      priority: string;
      status: HierarchyStatus;
      mvp_flag: boolean;
    }) => {
      return apiCall(`/api/epics/${epicId}/stories`, {
        method: "POST",
        body: JSON.stringify(storyData),
      });
    },
    onSuccess: () => {
      // Invalidate and refetch story queries
      queryClient.invalidateQueries({ queryKey: ["stories", epicId] });
      queryClient.invalidateQueries({ queryKey: ["project-stories"] });
      queryClient.invalidateQueries({ queryKey: ["stories"] });
    },
  });
};

export const useUpdateStory = (epicId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storyId, updates }: {
      storyId: string;
      updates: {
        title?: string;
        description?: string;
        priority?: string;
        status?: HierarchyStatus;
        mvp_flag?: boolean;
      }
    }) => {
      return apiCall(`/api/stories/${storyId}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      // Invalidate and refetch story queries
      queryClient.invalidateQueries({ queryKey: ["stories", epicId] });
      queryClient.invalidateQueries({ queryKey: ["project-stories"] });
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      queryClient.invalidateQueries({ queryKey: ["story"] });
    },
  });
};

export const useUpdateStoryStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storyId, status }: { storyId: string; status: HierarchyStatus }) => {
      return apiCall(`/api/stories/${storyId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      // Invalidate and refetch story queries
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      queryClient.invalidateQueries({ queryKey: ["project-stories"] });
      queryClient.invalidateQueries({ queryKey: ["story"] });
    },
  });
};