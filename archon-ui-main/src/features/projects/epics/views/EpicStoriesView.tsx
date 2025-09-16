import React, { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, ArrowLeft, LayoutGrid, Filter } from "lucide-react";
import { HierarchyBreadcrumb } from "@/features/ui/components/navigation";
import { Button } from "@/features/ui/primitives/button";
import { cn, glassmorphism } from "@/features/ui/primitives/styles";
import { useToast } from "@/features/ui/hooks";
import { useProject } from "../../hooks/useProjectQueries";
import { useEpic } from "../hooks/useEpicQueries";
import { useStories } from "../../stories/hooks/useStoryQueries";
import { StoryModal } from "../../stories/components/StoryModal";
import { StoryKanbanColumn } from "../../stories/components/StoryKanbanColumn";
import type { Story } from "../../stories/types";
import type { HierarchyStatus } from "../../shared/types/hierarchy";

export const EpicStoriesView: React.FC = () => {
  const { projectId, epicId } = useParams<{ projectId: string; epicId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);

  // Fetch data
  const { data: project } = useProject(projectId!);
  const { data: epic, isLoading: epicLoading, error: epicError } = useEpic(epicId!);
  const { data: stories = [], isLoading: storiesLoading, error: storiesError } = useStories(epicId!);

  // Calculate stats
  const totalStories = stories.length;
  const completedStories = stories.filter(s => s.status === "done").length;
  const progressPercentage = totalStories > 0 ? Math.round((completedStories / totalStories) * 100) : 0;

  // Group stories by status
  const getStoriesByStatus = (status: HierarchyStatus) => {
    return stories.filter(story => story.status === status);
  };

  const handleBack = useCallback(() => {
    navigate(`/projects/${projectId}/epics/${epicId}`);
  }, [navigate, projectId, epicId]);

  const handleBackToProject = useCallback(() => {
    navigate(`/projects/${projectId}?view=board&filter=epics`);
  }, [navigate, projectId]);

  const handleAddStory = useCallback(() => {
    setEditingStory(null);
    setIsStoryModalOpen(true);
  }, []);

  const handleStoryEdit = useCallback((story: Story) => {
    setEditingStory(story);
    setIsStoryModalOpen(true);
  }, []);

  const handleStorySaved = useCallback(() => {
    setIsStoryModalOpen(false);
    setEditingStory(null);
    showToast(editingStory ? "Story updated successfully" : "Story created successfully", "success");
  }, [editingStory, showToast]);

  const handleStoryMove = useCallback((storyId: string, newStatus: HierarchyStatus) => {
    // TODO: Implement story status update
    showToast(`Moving story to ${newStatus} - Implementation needed`, "info");
  }, [showToast]);

  const handleStoryReorder = useCallback((storyId: string, targetIndex: number, status: HierarchyStatus) => {
    // TODO: Implement story reordering
    showToast(`Reordering story in ${status} - Implementation needed`, "info");
  }, [showToast]);

  if (epicLoading || storiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LayoutGrid className="h-12 w-12 text-gray-400 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading epic stories...</p>
        </div>
      </div>
    );
  }

  if (epicError || storiesError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="h-12 w-12 text-red-500 mx-auto mb-4 flex items-center justify-center">
            ⚠️
          </div>
          <p className="text-red-600 dark:text-red-400">
            Failed to load epic data
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Header */}
        <div className={cn("sticky top-0 z-10 border-b backdrop-blur-sm", glassmorphism)}>
          <div className="max-w-full mx-auto px-6 py-4">
            {/* Breadcrumb */}
            <HierarchyBreadcrumb className="mb-4">
              <button
                onClick={() => navigate(`/projects/${projectId}`)}
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                {project?.title || "Project"}
              </button>
              <span className="mx-2 text-gray-400">/</span>
              <button
                onClick={handleBack}
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                {epic?.code}: {epic?.title}
              </button>
              <span className="mx-2 text-gray-400">/</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Stories
              </span>
            </HierarchyBreadcrumb>

            {/* Epic Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Epic
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {epic?.code}: {epic?.title}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {epic?.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right text-sm">
                  <div className="text-gray-900 dark:text-white font-medium">
                    {completedStories}/{totalStories} Stories
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {progressPercentage}% Complete
                  </div>
                </div>
                <Button onClick={handleAddStory} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Story
                </Button>
                <Button onClick={handleBackToProject} variant="outline">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Project Kanban
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="max-w-full mx-auto px-6 py-6">
          {stories.length === 0 ? (
            // Empty State
            <div className="text-center py-20">
              <LayoutGrid className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No stories in this epic yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Stories break down this epic into manageable chunks of work.
                Create your first story to get started.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleAddStory} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Story
                </Button>
                <Button onClick={handleBackToProject} variant="outline">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Back to Project
                </Button>
              </div>
            </div>
          ) : (
            // Kanban Columns
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-[70vh]">
              {/* Todo Column */}
              <StoryKanbanColumn
                title="Todo"
                status="todo"
                stories={getStoriesByStatus("todo")}
                epicId={epicId!}
                onStoryMove={handleStoryMove}
                onStoryReorder={handleStoryReorder}
                onStoryEdit={handleStoryEdit}
                className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900"
              />

              {/* Doing Column */}
              <StoryKanbanColumn
                title="Doing"
                status="doing"
                stories={getStoriesByStatus("doing")}
                epicId={epicId!}
                onStoryMove={handleStoryMove}
                onStoryReorder={handleStoryReorder}
                onStoryEdit={handleStoryEdit}
                className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20"
              />

              {/* Review Column */}
              <StoryKanbanColumn
                title="Review"
                status="review"
                stories={getStoriesByStatus("review")}
                epicId={epicId!}
                onStoryMove={handleStoryMove}
                onStoryReorder={handleStoryReorder}
                onStoryEdit={handleStoryEdit}
                className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20"
              />

              {/* Done Column */}
              <StoryKanbanColumn
                title="Done"
                status="done"
                stories={getStoriesByStatus("done")}
                epicId={epicId!}
                onStoryMove={handleStoryMove}
                onStoryReorder={handleStoryReorder}
                onStoryEdit={handleStoryEdit}
                className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
              />
            </div>
          )}
        </div>
      </div>

      {/* Story Modal */}
      <StoryModal
        isOpen={isStoryModalOpen}
        epicId={epicId!}
        editingStory={editingStory}
        onClose={() => {
          setIsStoryModalOpen(false);
          setEditingStory(null);
        }}
        onSaved={handleStorySaved}
      />
    </>
  );
};