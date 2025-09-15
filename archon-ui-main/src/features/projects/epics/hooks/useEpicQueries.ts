import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { epicService } from "../services/epicService";
import { useToast } from "@/features/ui/hooks";

// Query keys
export const epicKeys = {
  all: ["epics"] as const,
  lists: () => [...epicKeys.all, "list"] as const,
  list: (projectId: string) => [...epicKeys.lists(), projectId] as const,
  details: () => [...epicKeys.all, "detail"] as const,
  detail: (epicId: string) => [...epicKeys.details(), epicId] as const,
};

// Get all epics for a project
export const useEpics = (projectId: string) => {
  return useQuery({
    queryKey: epicKeys.list(projectId),
    queryFn: () => epicService.listEpics(projectId),
    enabled: !!projectId,
  });
};

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