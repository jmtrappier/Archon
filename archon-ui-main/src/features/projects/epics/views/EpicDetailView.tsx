import React, { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, FileText, AlertCircle, LayoutGrid } from "lucide-react";
import { HierarchyLayout } from "../../hierarchy/components/HierarchyLayout";
import { ProgressCard } from "../../hierarchy/components/ProgressCard";
import { HierarchyBreadcrumb } from "@/features/ui/components/navigation";
import { useProject } from "../../hooks/useProjectQueries";
import { useEpic } from "../hooks/useEpicQueries";
import { useStories } from "../../stories/hooks/useStoryQueries";
import { StoryModal } from "../../stories/components/StoryModal";
import { Button } from "@/features/ui/primitives/button";
import { useToast } from "@/features/ui/hooks";

export const EpicDetailView: React.FC = () => {
  const { projectId, epicId } = useParams<{ projectId: string; epicId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<any>(null);
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set());

  // Fetch data
  const { data: project } = useProject(projectId!);
  const { data: epic, isLoading: epicLoading, error: epicError } = useEpic(epicId!);
  const { data: stories = [], isLoading: storiesLoading, error: storiesError } = useStories(epicId!);

  // Calculate stats
  const totalStories = stories.length;
  const completedStories = stories.filter(s => s.status === "done").length;
  const totalTasks = stories.reduce((sum, s) => sum + (s.task_count || 0), 0);
  const completedTasks = stories.reduce((sum, s) => sum + (s.completed_tasks || 0), 0);

  const handleBack = useCallback(() => {
    navigate(`/projects/${projectId}`);
  }, [navigate, projectId]);

  const handleViewKanban = useCallback(() => {
    navigate(`/projects/${projectId}?view=board&filter=epics`);
  }, [navigate, projectId]);

  const handleStoryClick = useCallback((storyId: string) => {
    navigate(`/projects/${projectId}/epics/${epicId}/stories/${storyId}`);
  }, [navigate, projectId, epicId]);

  const handleStoryEdit = useCallback((story: any) => {
    setEditingStory(story);
    setIsStoryModalOpen(true);
  }, []);

  const handleStoryDelete = useCallback(async (storyId: string) => {
    if (confirm("Are you sure you want to delete this story? This will also delete all its tasks.")) {
      try {
        // TODO: Implement story deletion
        showToast("Story deletion not yet implemented", "info");
      } catch (error) {
        showToast("Failed to delete story", "error");
      }
    }
  }, [showToast]);

  const handleAddStory = useCallback(() => {
    setEditingStory(null);
    setIsStoryModalOpen(true);
  }, []);

  const handleStorySaved = useCallback(() => {
    setIsStoryModalOpen(false);
    setEditingStory(null);
    showToast(editingStory ? "Story updated successfully" : "Story created successfully", "success");
  }, [editingStory, showToast]);

  const handleStorySelect = useCallback((storyId: string, selected: boolean) => {
    setSelectedStories(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(storyId);
      } else {
        newSet.delete(storyId);
      }
      return newSet;
    });
  }, []);

  if (epicLoading || storiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading epic...</p>
        </div>
      </div>
    );
  }

  if (epicError || storiesError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">
            Failed to load epic data
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <HierarchyLayout
        level="epic"
        title={`${epic?.code}: ${epic?.title}`}
        subtitle={epic?.description}
        progress={epic?.progress || 0}
        breadcrumb={
          <HierarchyBreadcrumb>
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {project?.title || "Project"}
            </button>
            <span className="mx-2 text-gray-400">/</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {epic?.code}: {epic?.title}
            </span>
          </HierarchyBreadcrumb>
        }
        onBack={handleBack}
        onAddNew={handleAddStory}
        addNewLabel="New Story"
        stats={[
          { label: "Stories", value: totalStories },
          { label: "Completed", value: completedStories },
          { label: "Tasks", value: totalTasks },
          { label: "Tasks Done", value: completedTasks },
        ]}
      >
        {/* Empty State */}
        {stories.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No stories yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Stories are features or requirements that deliver value to users.
              Create your first story to break down this epic.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={handleAddStory} className="">
                <Plus className="h-4 w-4 mr-2" />
                Create First Story
              </Button>
              <Button onClick={handleViewKanban} variant="outline" className="">
                <LayoutGrid className="h-4 w-4 mr-2" />
                View Project Kanban
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Bulk Actions Bar */}
            {selectedStories.size > 0 && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {selectedStories.size} stor{selectedStories.size !== 1 ? "ies" : "y"} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedStories(new Set())}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      showToast("Bulk operations not yet implemented", "info");
                    }}
                  >
                    Delete Selected
                  </Button>
                </div>
              </div>
            )}

            {/* Stories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stories.map((story) => (
                <ProgressCard
                  key={story.id}
                  level="story"
                  code={story.code}
                  title={story.title}
                  description={story.description}
                  status={story.status}
                  progress={story.progress || 0}
                  priority={story.priority}
                  childCount={{
                    total: story.task_count || 0,
                    completed: story.completed_tasks || 0,
                    label: "Tasks",
                  }}
                  onClick={() => handleStoryClick(story.id)}
                  onEdit={() => handleStoryEdit(story)}
                  onDelete={() => handleStoryDelete(story.id)}
                  isSelected={selectedStories.has(story.id)}
                  onSelect={(selected) => handleStorySelect(story.id, selected)}
                />
              ))}
            </div>
          </>
        )}
      </HierarchyLayout>

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