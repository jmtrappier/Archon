import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSmartPolling } from "../../../ui/hooks";
import { useToast } from "../../../ui/hooks/useToast";
import { epicKeys } from "../../epics/hooks/useEpicQueries";
import { storyService } from "../services/storyService";
import type {
  CreateStoryRequest,
  Story,
  UpdateStoryRequest,
  StoryQueryParams,
  MoveStoryBetweenEpicsRequest,
  HierarchyStatus
} from "../types";

// Query keys factory for stories
export const storyKeys = {
  all: (epicId: string) => ["epic", epicId, "stories"] as const,
  byProject: (projectId: string) => ["project", projectId, "stories"] as const,
  detail: (storyId: string) => ["story", storyId] as const,
  tasks: (storyId: string) => ["story", storyId, "tasks"] as const,
  progress: (storyId: string) => ["story", storyId, "progress"] as const,
};

// Fetch stories for a specific epic
export function useEpicStories(epicId: string | undefined, params?: StoryQueryParams, enabled = true) {
  const { refetchInterval } = useSmartPolling(5000); // 5 second base interval for faster MCP updates

  return useQuery<Story[]>({
    queryKey: epicId ? storyKeys.all(epicId) : ["epic-stories-undefined"],
    queryFn: async () => {
      if (!epicId) throw new Error("No epic ID");
      return storyService.getStoriesByEpic(epicId, params);
    },
    enabled: !!epicId && enabled,
    refetchInterval, // Smart interval based on page visibility/focus
    refetchOnWindowFocus: true, // Refetch immediately when tab gains focus (ETag makes this cheap)
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

// Fetch stories for a project (across all epics)
export function useProjectStories(projectId: string | undefined, params?: StoryQueryParams, enabled = true) {
  const { refetchInterval } = useSmartPolling(5000);

  return useQuery<Story[]>({
    queryKey: projectId ? storyKeys.byProject(projectId) : ["project-stories-undefined"],
    queryFn: async () => {
      if (!projectId) throw new Error("No project ID");
      return storyService.getStoriesByProject(projectId, params);
    },
    enabled: !!projectId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });
}

// Fetch a specific story
export function useStory(storyId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(10000); // Longer interval for individual story

  return useQuery<Story>({
    queryKey: storyId ? storyKeys.detail(storyId) : ["story-undefined"],
    queryFn: async () => {
      if (!storyId) throw new Error("No story ID");
      return storyService.getStory(storyId);
    },
    enabled: !!storyId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 15000, // Individual stories change less frequently
  });
}

// Fetch tasks for a specific story
export function useStoryTasks(storyId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(5000);

  return useQuery<any[]>({
    queryKey: storyId ? storyKeys.tasks(storyId) : ["story-tasks-undefined"],
    queryFn: async () => {
      if (!storyId) throw new Error("No story ID");
      return storyService.getStoryTasks(storyId);
    },
    enabled: !!storyId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });
}

// Fetch story progress
export function useStoryProgress(storyId: string | undefined, enabled = true) {
  const { refetchInterval } = useSmartPolling(10000);

  return useQuery<number>({
    queryKey: storyId ? storyKeys.progress(storyId) : ["story-progress-undefined"],
    queryFn: async () => {
      if (!storyId) throw new Error("No story ID");
      return storyService.calculateStoryProgress(storyId);
    },
    enabled: !!storyId && enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
    staleTime: 15000,
  });
}

// Create story mutation with optimistic updates
export function useCreateStory() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (storyData: CreateStoryRequest) => storyService.createStory(storyData),
    onMutate: async (newStoryData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: storyKeys.all(newStoryData.epic_id) });

      // Snapshot the previous value
      const previousStories = queryClient.getQueryData(storyKeys.all(newStoryData.epic_id));

      // Create optimistic story with temporary ID
      const tempId = `temp-story-${Date.now()}`;
      const optimisticStory: Story = {
        id: tempId, // Temporary ID until real one comes back
        ...newStoryData,
        status: "todo", // Default status
        progress: 0, // Default progress
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Ensure all required fields have defaults
        priority: newStoryData.priority ?? "medium",
        mvp_flag: newStoryData.mvp_flag ?? false,
      } as Story;

      // Optimistically add the new story
      queryClient.setQueryData(storyKeys.all(newStoryData.epic_id), (old: Story[] | undefined) => {
        if (!old) return [optimisticStory];
        return [...old, optimisticStory];
      });

      return { previousStories, tempId };
    },
    onError: (error, variables, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to create story:", error, { variables });
      // Rollback on error
      if (context?.previousStories) {
        queryClient.setQueryData(storyKeys.all(variables.epic_id), context.previousStories);
      }
      showToast(`Failed to create story: ${errorMessage}`, "error");
    },
    onSuccess: (data, variables, context) => {
      // Replace optimistic story with real one from server
      queryClient.setQueryData(storyKeys.all(variables.epic_id), (old: Story[] | undefined) => {
        if (!old) return [data];
        // Replace only the specific temp story with real one
        return old
          .map((story) => (story.id === context?.tempId ? data : story))
          .filter(
            (story, index, self) =>
              // Remove any duplicates just in case
              index === self.findIndex((s) => s.id === story.id),
          );
      });
      showToast("Story created successfully", "success");
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch to ensure consistency after operation completes
      queryClient.invalidateQueries({ queryKey: storyKeys.all(variables.epic_id) });
    },
  });
}

// Update story mutation with optimistic updates
export function useUpdateStory(epicId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Story, Error, { storyId: string; updates: UpdateStoryRequest }, { previousStories?: Story[] }>({
    mutationFn: ({ storyId, updates }: { storyId: string; updates: UpdateStoryRequest }) =>
      storyService.updateStory(storyId, updates),
    onMutate: async ({ storyId, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: storyKeys.all(epicId) });

      // Snapshot the previous value
      const previousStories = queryClient.getQueryData<Story[]>(storyKeys.all(epicId));

      // Optimistically update
      queryClient.setQueryData<Story[]>(storyKeys.all(epicId), (old) => {
        if (!old) return old;
        return old.map((story) => (story.id === storyId ? { ...story, ...updates } : story));
      });

      // Also update individual story cache if it exists
      queryClient.setQueryData<Story>(storyKeys.detail(storyId), (old) => {
        if (!old) return old;
        return { ...old, ...updates };
      });

      return { previousStories };
    },
    onError: (error, variables, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to update story:", error, { variables });
      // Rollback on error
      if (context?.previousStories) {
        queryClient.setQueryData(storyKeys.all(epicId), context.previousStories);
      }
      showToast(`Failed to update story: ${errorMessage}`, "error");
      // Refetch on error to ensure consistency
      queryClient.invalidateQueries({ queryKey: storyKeys.all(epicId) });
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(variables.storyId) });
    },
    onSuccess: (data, { updates }) => {
      // Merge server response to keep timestamps and computed fields in sync
      queryClient.setQueryData<Story[]>(storyKeys.all(epicId), (old) =>
        old ? old.map((s) => (s.id === data.id ? data : s)) : old,
      );
      queryClient.setQueryData<Story>(storyKeys.detail(data.id), data);

      // Only show toast for significant status changes
      if (updates.status) {
        showToast(`Story moved to ${updates.status}`, "success");
      }
    },
  });
}

// Update story status mutation (for drag & drop)
export function useUpdateStoryStatus(epicId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Story, Error, { storyId: string; status: HierarchyStatus }>({
    mutationFn: ({ storyId, status }) => storyService.updateStoryStatus(storyId, status),
    onMutate: async ({ storyId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: storyKeys.all(epicId) });

      // Optimistically update
      queryClient.setQueryData<Story[]>(storyKeys.all(epicId), (old) => {
        if (!old) return old;
        return old.map((story) => (story.id === storyId ? { ...story, status } : story));
      });

      queryClient.setQueryData<Story>(storyKeys.detail(storyId), (old) => {
        if (!old) return old;
        return { ...old, status };
      });
    },
    onError: (error, variables) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to update story status:", error, { variables });
      showToast(`Failed to update story status: ${errorMessage}`, "error");
      queryClient.invalidateQueries({ queryKey: storyKeys.all(epicId) });
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(variables.storyId) });
    },
    onSuccess: (data, { status }) => {
      queryClient.setQueryData<Story[]>(storyKeys.all(epicId), (old) =>
        old ? old.map((s) => (s.id === data.id ? data : s)) : old,
      );
      queryClient.setQueryData<Story>(storyKeys.detail(data.id), data);
      showToast(`Story moved to ${status}`, "success");
    },
  });
}

// Move story between epics mutation
export function useMoveStoryBetweenEpics() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Story, Error, MoveStoryBetweenEpicsRequest>({
    mutationFn: (moveRequest: MoveStoryBetweenEpicsRequest) =>
      storyService.moveStoryBetweenEpics(moveRequest),
    onSuccess: (data, { from_epic_id, to_epic_id }) => {
      // Invalidate caches for both epics
      queryClient.invalidateQueries({ queryKey: storyKeys.all(from_epic_id) });
      queryClient.invalidateQueries({ queryKey: storyKeys.all(to_epic_id) });
      queryClient.setQueryData<Story>(storyKeys.detail(data.id), data);
      showToast("Story moved between epics successfully", "success");
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(`Failed to move story: ${errorMessage}`, "error");
    },
  });
}

// Delete story mutation
export function useDeleteStory(epicId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<void, Error, string, { previousStories?: Story[] }>({
    mutationFn: (storyId: string) => storyService.deleteStory(storyId),
    onMutate: async (storyId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: storyKeys.all(epicId) });

      // Snapshot the previous value
      const previousStories = queryClient.getQueryData<Story[]>(storyKeys.all(epicId));

      // Optimistically remove the story
      queryClient.setQueryData<Story[]>(storyKeys.all(epicId), (old) => {
        if (!old) return old;
        return old.filter((story) => story.id !== storyId);
      });

      // Also remove individual story cache
      queryClient.removeQueries({ queryKey: storyKeys.detail(storyId) });

      return { previousStories };
    },
    onError: (error, storyId, context) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to delete story:", error, { storyId });
      // Rollback on error
      if (context?.previousStories) {
        queryClient.setQueryData(storyKeys.all(epicId), context.previousStories);
      }
      showToast(`Failed to delete story: ${errorMessage}`, "error");
    },
    onSuccess: () => {
      showToast("Story deleted successfully", "success");
    },
  });
}

// Archive/unarchive story mutation
export function useArchiveStory(epicId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Story, Error, { storyId: string; archive: boolean }>({
    mutationFn: ({ storyId, archive }) => storyService.archiveStory(storyId, archive),
    onSuccess: (data, { archive }) => {
      queryClient.setQueryData<Story[]>(storyKeys.all(epicId), (old) =>
        old ? old.map((s) => (s.id === data.id ? data : s)) : old,
      );
      queryClient.setQueryData<Story>(storyKeys.detail(data.id), data);
      showToast(`Story ${archive ? 'archived' : 'unarchived'} successfully`, "success");
    },
    onError: (error, { archive }) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(`Failed to ${archive ? 'archive' : 'unarchive'} story: ${errorMessage}`, "error");
    },
  });
}

// Reorder stories in epic mutation
export function useReorderStoriesInEpic(epicId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation<Story[], Error, string[]>({
    mutationFn: (orderedStoryIds: string[]) =>
      storyService.reorderStoriesInEpic(epicId, orderedStoryIds),
    onMutate: async (orderedStoryIds) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: storyKeys.all(epicId) });

      // Get current stories
      const previousStories = queryClient.getQueryData<Story[]>(storyKeys.all(epicId));

      // Optimistically reorder
      if (previousStories) {
        const reorderedStories = orderedStoryIds
          .map(id => previousStories.find(story => story.id === id))
          .filter(Boolean) as Story[];
        queryClient.setQueryData(storyKeys.all(epicId), reorderedStories);
      }

      return { previousStories };
    },
    onError: (error, variables, context) => {
      console.error("Failed to reorder stories:", error);
      // Rollback on error
      if (context?.previousStories) {
        queryClient.setQueryData(storyKeys.all(epicId), context.previousStories);
      }
      showToast("Failed to reorder stories", "error");
    },
    onSuccess: () => {
      showToast("Stories reordered successfully", "success");
    },
  });
}