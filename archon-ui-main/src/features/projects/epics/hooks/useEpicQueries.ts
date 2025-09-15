import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSmartPolling } from "../../../ui/hooks";
import { useToast } from "../../../ui/hooks/useToast";
import { projectKeys } from "../../hooks/useProjectQueries";
import { epicService } from "../services/epicService";
import type { CreateEpicRequest, Epic, UpdateEpicRequest, EpicQueryParams, HierarchyStatus } from "../types";

// Query keys factory for epics
export const epicKeys = {
  all: (projectId: string) => ["projects", projectId, "epics"] as const,
  detail: (epicId: string) => ["epic", epicId] as const,
  stories: (epicId: string) => ["epic", epicId, "stories"] as const,
  progress: (epicId: string) => ["epic", epicId, "progress"] as const,
};

// Fetch epics for a specific project
export function useProjectEpics(projectId: string | undefined, params?: EpicQueryParams, enabled = true) {
  const { refetchInterval } = useSmartPolling(5000); // 5 second base interval for faster MCP updates

  return useQuery<Epic[]>({
    queryKey: projectId ? epicKeys.all(projectId) : ["epics-undefined"],
    queryFn: async () => {
      if (!projectId) throw new Error("No project ID");
      return epicService.getEpicsByProject(projectId, params);
    },
    enabled: !!projectId && enabled,
    refetchInterval, // Smart interval based on page visibility/focus
    refetchOnWindowFocus: true, // Refetch immediately when tab gains focus (ETag makes this cheap)
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

// Fetch a specific epic
export function useEpic(epicId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(10000); // Longer interval for individual epic

  return useQuery<Epic>({
    queryKey: epicId ? epicKeys.detail(epicId) : ["epic-undefined"],
    queryFn: async () => {
      if (!epicId) throw new Error("No epic ID");
      return epicService.getEpic(epicId);
    },
    enabled: !!epicId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 15000, // Individual epics change less frequently
  });
}

// Fetch stories for a specific epic
export function useEpicStories(epicId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(5000);

  return useQuery<any[]>({
    queryKey: epicId ? epicKeys.stories(epicId) : ["epic-stories-undefined"],
    queryFn: async () => {
      if (!epicId) throw new Error("No epic ID");
      return epicService.getEpicStories(epicId);
    },
    enabled: !!epicId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });
}

// Fetch epic progress
export function useEpicProgress(epicId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(10000);

  return useQuery<number>({
    queryKey: epicId ? epicKeys.progress(epicId) : ["epic-progress-undefined"],
    queryFn: async () => {
      if (!epicId) throw new Error("No epic ID");
      return epicService.calculateEpicProgress(epicId);
    },
    enabled: !!epicId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 15000,
  });
}

// Create epic mutation with optimistic updates
export function useCreateEpic() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (epicData: CreateEpicRequest) => epicService.createEpic(epicData),
    onMutate: async (newEpicData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: epicKeys.all(newEpicData.project_id) });

      // Snapshot the previous value
      const previousEpics = queryClient.getQueryData(epicKeys.all(newEpicData.project_id));

      // Create optimistic epic with temporary ID
      const tempId = `temp-epic-${Date.now()}`;
      const optimisticEpic: Epic = {
        id: tempId, // Temporary ID until real one comes back
        ...newEpicData,
        status: "todo", // Default status
        progress: 0, // Default progress
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Ensure all required fields have defaults
        priority: newEpicData.priority ?? "medium",
        mvp_flag: newEpicData.mvp_flag ?? false,
      } as Epic;

      // Optimistically add the new epic
      queryClient.setQueryData(epicKeys.all(newEpicData.project_id), (old: Epic[] | undefined) => {
        if (!old) return [optimisticEpic];
        return [...old, optimisticEpic];
      });

      return { previousEpics, tempId };
    },
    onError: (error, variables, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to create epic:", error, { variables });
      // Rollback on error
      if (context?.previousEpics) {
        queryClient.setQueryData(epicKeys.all(variables.project_id), context.previousEpics);
      }
      showToast(`Failed to create epic: ${errorMessage}`, "error");
    },
    onSuccess: (data, variables, context) => {
      // Replace optimistic epic with real one from server
      queryClient.setQueryData(epicKeys.all(variables.project_id), (old: Epic[] | undefined) => {
        if (!old) return [data];
        // Replace only the specific temp epic with real one
        return old
          .map((epic) => (epic.id === context?.tempId ? data : epic))
          .filter(
            (epic, index, self) =>
              // Remove any duplicates just in case
              index === self.findIndex((e) => e.id === epic.id),
          );
      });
      showToast("Epic created successfully", "success");
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch to ensure consistency after operation completes
      queryClient.invalidateQueries({ queryKey: epicKeys.all(variables.project_id) });
    },
  });
}

// Update epic mutation with optimistic updates
export function useUpdateEpic(projectId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Epic, Error, { epicId: string; updates: UpdateEpicRequest }, { previousEpics?: Epic[] }>({
    mutationFn: ({ epicId, updates }: { epicId: string; updates: UpdateEpicRequest }) =>
      epicService.updateEpic(epicId, updates),
    onMutate: async ({ epicId, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: epicKeys.all(projectId) });

      // Snapshot the previous value
      const previousEpics = queryClient.getQueryData<Epic[]>(epicKeys.all(projectId));

      // Optimistically update
      queryClient.setQueryData<Epic[]>(epicKeys.all(projectId), (old) => {
        if (!old) return old;
        return old.map((epic) => (epic.id === epicId ? { ...epic, ...updates } : epic));
      });

      // Also update individual epic cache if it exists
      queryClient.setQueryData<Epic>(epicKeys.detail(epicId), (old) => {
        if (!old) return old;
        return { ...old, ...updates };
      });

      return { previousEpics };
    },
    onError: (error, variables, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to update epic:", error, { variables });
      // Rollback on error
      if (context?.previousEpics) {
        queryClient.setQueryData(epicKeys.all(projectId), context.previousEpics);
      }
      showToast(`Failed to update epic: ${errorMessage}`, "error");
      // Refetch on error to ensure consistency
      queryClient.invalidateQueries({ queryKey: epicKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: epicKeys.detail(variables.epicId) });
    },
    onSuccess: (data, { updates }) => {
      // Merge server response to keep timestamps and computed fields in sync
      queryClient.setQueryData<Epic[]>(epicKeys.all(projectId), (old) =>
        old ? old.map((e) => (e.id === data.id ? data : e)) : old,
      );
      queryClient.setQueryData<Epic>(epicKeys.detail(data.id), data);

      // Only show toast for significant status changes
      if (updates.status) {
        showToast(`Epic moved to ${updates.status}`, "success");
      }
    },
  });
}

// Update epic status mutation (for drag & drop)
export function useUpdateEpicStatus(projectId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Epic, Error, { epicId: string; status: HierarchyStatus }>({
    mutationFn: ({ epicId, status }) => epicService.updateEpicStatus(epicId, status),
    onMutate: async ({ epicId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: epicKeys.all(projectId) });

      // Optimistically update
      queryClient.setQueryData<Epic[]>(epicKeys.all(projectId), (old) => {
        if (!old) return old;
        return old.map((epic) => (epic.id === epicId ? { ...epic, status } : epic));
      });

      queryClient.setQueryData<Epic>(epicKeys.detail(epicId), (old) => {
        if (!old) return old;
        return { ...old, status };
      });
    },
    onError: (error, variables) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to update epic status:", error, { variables });
      showToast(`Failed to update epic status: ${errorMessage}`, "error");
      queryClient.invalidateQueries({ queryKey: epicKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: epicKeys.detail(variables.epicId) });
    },
    onSuccess: (data, { status }) => {
      queryClient.setQueryData<Epic[]>(epicKeys.all(projectId), (old) =>
        old ? old.map((e) => (e.id === data.id ? data : e)) : old,
      );
      queryClient.setQueryData<Epic>(epicKeys.detail(data.id), data);
      showToast(`Epic moved to ${status}`, "success");
    },
  });
}

// Delete epic mutation
export function useDeleteEpic(projectId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<void, Error, string, { previousEpics?: Epic[] }>({
    mutationFn: (epicId: string) => epicService.deleteEpic(epicId),
    onMutate: async (epicId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: epicKeys.all(projectId) });

      // Snapshot the previous value
      const previousEpics = queryClient.getQueryData<Epic[]>(epicKeys.all(projectId));

      // Optimistically remove the epic
      queryClient.setQueryData<Epic[]>(epicKeys.all(projectId), (old) => {
        if (!old) return old;
        return old.filter((epic) => epic.id !== epicId);
      });

      // Also remove individual epic cache
      queryClient.removeQueries({ queryKey: epicKeys.detail(epicId) });

      return { previousEpics };
    },
    onError: (error, epicId, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to delete epic:", error, { epicId });
      // Rollback on error
      if (context?.previousEpics) {
        queryClient.setQueryData(epicKeys.all(projectId), context.previousEpics);
      }
      showToast(`Failed to delete epic: ${errorMessage}`, "error");
    },
    onSuccess: () => {
      showToast("Epic deleted successfully", "success");
    },
  });
}

// Archive/unarchive epic mutation
export function useArchiveEpic(projectId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Epic, Error, { epicId: string; archive: boolean }>({
    mutationFn: ({ epicId, archive }) => epicService.archiveEpic(epicId, archive),
    onSuccess: (data, { archive }) => {
      queryClient.setQueryData<Epic[]>(epicKeys.all(projectId), (old) =>
        old ? old.map((e) => (e.id === data.id ? data : e)) : old,
      );
      queryClient.setQueryData<Epic>(epicKeys.detail(data.id), data);
      showToast(`Epic ${archive ? 'archived' : 'unarchived'} successfully`, "success");
    },
    onError: (error, { archive }) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(`Failed to ${archive ? 'archive' : 'unarchive'} epic: ${errorMessage}`, "error");
    },
  });
}