import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { epicService } from "../services/epicService";
import { storyService } from "../../stories/services/storyService";
import { useToast } from "@/features/ui/hooks";

// Query keys
export const epicKeys = {
  all: ["epics"] as const,
  lists: () => [...epicKeys.all, "list"] as const,
  list: (projectId: string) => [...epicKeys.lists(), projectId] as const,
  details: () => [...epicKeys.all, "detail"] as const,
  detail: (epicId: string) => [...epicKeys.details(), epicId] as const,
  storyCounts: () => [...epicKeys.all, "story-counts"] as const,
};

// Get all epics for a project
export const useEpics = (projectId: string) => {
  return useQuery({
    queryKey: epicKeys.list(projectId),
    queryFn: () => epicService.listEpics(projectId),
    enabled: !!projectId,
  });
};

// Alias for backward compatibility
export const useProjectEpics = useEpics;

// Get a single epic
export const useEpic = (epicId: string) => {
  return useQuery({
    queryKey: epicKeys.detail(epicId),
    queryFn: () => epicService.getEpic(epicId),
    enabled: !!epicId,
  });
};

// Create epic mutation
export const useCreateEpic = (projectId: string) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: any) => epicService.createEpic(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: epicKeys.list(projectId) });
      showToast("Epic created successfully", "success");
    },
    onError: (error: any) => {
      showToast(error.message || "Failed to create epic", "error");
    },
  });
};

// Update epic mutation
export const useUpdateEpic = (projectId: string) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ epicId, updates }: { epicId: string; updates: any }) =>
      epicService.updateEpic(epicId, updates),
    onSuccess: (_, { epicId }) => {
      queryClient.invalidateQueries({ queryKey: epicKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: epicKeys.detail(epicId) });
      showToast("Epic updated successfully", "success");
    },
    onError: (error: any) => {
      showToast(error.message || "Failed to update epic", "error");
    },
  });
};

// Update epic status mutation
export const useUpdateEpicStatus = (projectId: string) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ epicId, status }: { epicId: string; status: string }) =>
      epicService.updateEpic(epicId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: epicKeys.list(projectId) });
      showToast("Epic status updated", "success");
    },
    onError: (error: any) => {
      showToast(error.message || "Failed to update epic status", "error");
    },
  });
};

// Delete epic mutation
export const useDeleteEpic = (projectId: string) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (epicId: string) => epicService.deleteEpic(epicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: epicKeys.list(projectId) });
      showToast("Epic deleted successfully", "success");
    },
    onError: (error: any) => {
      showToast(error.message || "Failed to delete epic", "error");
    },
  });
};

// Get story counts for all epics
export const useStoryCountsForAllEpics = () => {
  return useQuery({
    queryKey: epicKeys.storyCounts(),
    queryFn: () => storyService.getStoryCountsForAllEpics(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
};