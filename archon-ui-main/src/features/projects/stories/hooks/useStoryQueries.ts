import { useQuery } from "@tanstack/react-query";

// Temporary story hooks until we implement the real ones
export const useStory = (storyId: string) => {
  return useQuery({
    queryKey: ["story", storyId],
    queryFn: () => Promise.resolve({ id: storyId, title: "Loading Story...", code: "S-01-01" }),
    enabled: !!storyId,
  });
};

export const useStories = (epicId: string) => {
  return useQuery({
    queryKey: ["stories", epicId],
    queryFn: () => Promise.resolve([]),
    enabled: !!epicId,
  });
};