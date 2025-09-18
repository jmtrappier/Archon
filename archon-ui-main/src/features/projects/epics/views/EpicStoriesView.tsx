import { ArrowLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Link, useNavigate, useParams } from "react-router-dom";
import { epicService } from "@/features/projects/epics/services/epicService";
import { useProject } from "@/features/projects/hooks/useProjectQueries";
import { StoryCard } from "@/features/projects/stories/components/StoryCard";
import { StoryKanbanColumn } from "@/features/projects/stories/components/StoryKanbanColumn";
import { StoryModal } from "@/features/projects/stories/components/StoryModal";
import { storyService } from "@/features/projects/stories/services/storyService";
import type { Epic } from "@/features/projects/types/epic";
import type { Story, StoryStatus } from "@/features/projects/types/story";
import { Button } from "@/features/ui/primitives/button";
import { cn } from "@/lib/utils";
import { useToast } from "../../../ui/hooks/useToast";

const STORY_STATUSES: { status: StoryStatus; title: string }[] = [
  { status: "todo", title: "To Do" },
  { status: "doing", title: "In Progress" },
  { status: "review", title: "Review" },
  { status: "done", title: "Done" },
];

export const EpicStoriesView = () => {
  const { projectId, epicId } = useParams<{ projectId: string; epicId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { showToast } = useToast();

  const [epic, setEpic] = useState<Epic | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [epicToUpdate, setEpicToUpdate] = useState<Epic | null>(null);

  useEffect(() => {
    const loadEpicAndStories = async () => {
      if (!epicId || !projectId) return;

      setIsLoading(true);
      try {
        // Load Epic details
        const epicData = await epicService.getEpic(epicId);
        setEpic(epicData);

        // Load Stories for this Epic
        const storiesData = await storyService.listStories(epicId);
        setStories(storiesData);
      } catch (error) {
        console.error("Failed to load epic and stories:", error);
        showToast("Failed to load epic details", "error");
      } finally {
        setIsLoading(false);
      }
    };

    loadEpicAndStories();
  }, [epicId, projectId]);

  const handleStoryMove = async (storyId: string, newStatus: StoryStatus) => {
    try {
      await storyService.updateStory(storyId, { status: newStatus });

      // Update local state optimistically
      setStories((prev) => prev.map((story) => (story.id === storyId ? { ...story, status: newStatus } : story)));

      showToast("Story status updated", "success");
    } catch (error) {
      console.error("Failed to update story status:", error);
      showToast("Failed to update story status", "error");
    }
  };

  const handleStoryReorder = async (storyId: string, targetOrder: number) => {
    try {
      await storyService.updateStory(storyId, { story_order: targetOrder });

      // Reload stories to get updated order
      const updatedStories = await storyService.listStories(epicId!);
      setStories(updatedStories);
    } catch (error) {
      console.error("Failed to reorder story:", error);
      showToast("Failed to reorder story", "error");
    }
  };

  const handleStoryEdit = (storyId: string) => {
    navigate(`/projects/${projectId}/epics/${epicId}/stories/${storyId}`);
  };

  const handleStoryCreate = async (data: any) => {
    try {
      const newStory = await storyService.createStory({
        ...data,
        epic_id: epicId,
        project_id: projectId,
      });

      setStories((prev) => [...prev, newStory]);
      showToast("Story created successfully", "success");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to create story:", error);
      showToast("Failed to create story", "error");
    }
  };

  const calculateProgress = () => {
    if (stories.length === 0) return 0;
    const doneStories = stories.filter((s) => s.status === "done").length;
    return Math.round((doneStories / stories.length) * 100);
  };

  const getStoriesByStatus = (status: StoryStatus) => {
    return stories
      .filter((story) => story.status === status)
      .sort((a, b) => (a.story_order || 0) - (b.story_order || 0));
  };

  if (isLoading || projectLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!epic || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <p className="text-gray-500">Epic not found</p>
        <Button onClick={() => navigate(`/projects/${projectId}`)}>Back to Project</Button>
      </div>
    );
  }

  const progress = calculateProgress();

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50/50 via-white to-gray-100/30 dark:from-gray-900/50 dark:via-gray-900 dark:to-gray-800/30">
        <div className="container mx-auto px-4 py-6">
          {/* Header with Epic info */}
          <div className="mb-6 space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Link
                to={`/projects/${projectId}`}
                className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {project.title}
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-gray-700 dark:text-gray-300 font-medium">{epic.title}</span>
            </div>

            {/* Epic Header */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/projects/${projectId}`)}
                      className="hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Project Kanban
                    </Button>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{epic.title}</h1>
                  {epic.description && (
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-2">{epic.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">
                      {stories.length} {stories.length === 1 ? "Story" : "Stories"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Progress:</span>
                      <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">{progress}%</span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:from-cyan-600 hover:to-purple-600"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Story
                </Button>
              </div>
            </div>
          </div>

          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STORY_STATUSES.map((column) => (
              <StoryKanbanColumn
                key={column.status}
                status={column.status}
                title={column.title}
                stories={getStoriesByStatus(column.status)}
                epicId={epicId}
                onStoryMove={handleStoryMove}
                onStoryReorder={handleStoryReorder}
                onStoryEdit={handleStoryEdit}
                className="min-h-[400px]"
              />
            ))}
          </div>

          {/* Story Creation Modal */}
          {isModalOpen && (
            <StoryModal epicId={epicId} onSubmit={handleStoryCreate} onClose={() => setIsModalOpen(false)} />
          )}
        </div>
      </div>
    </DndProvider>
  );
};
