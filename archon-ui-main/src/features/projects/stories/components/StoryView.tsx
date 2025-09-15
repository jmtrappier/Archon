import { ArrowLeft, BookOpen, Grid, List, LayoutGrid, Settings, Download, Filter } from "lucide-react";
import type React from "react";
import { useState, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/primitives/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../ui/primitives/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/primitives/tooltip";
import { useToast } from "../../../ui/hooks/useToast";
import { useEpic } from "../../epics/hooks/useEpicQueries";
import { useEpicStories, useDeleteStory } from "../hooks/useStoryQueries";
import type { Story, StoryWithEpic } from "../types";
import { StoryList } from "./StoryList";

export interface StoryViewProps {
  epicId?: string;
  projectId?: string;
  className?: string;
}

type ViewMode = 'grid' | 'list' | 'kanban';

export const StoryView: React.FC<StoryViewProps> = ({
  epicId: propEpicId,
  projectId: propProjectId,
  className = "",
}) => {
  const navigate = useNavigate();
  const params = useParams();
  const { showToast } = useToast();

  // Get IDs from props or URL params
  const epicId = propEpicId || params.epicId;
  const projectId = propProjectId || params.projectId;

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [compactMode, setCompactMode] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | StoryWithEpic | null>(null);

  // Fetch data
  const { data: epic, isLoading: epicLoading, error: epicError } = useEpic(epicId);
  const { data: stories = [], isLoading: storiesLoading, error: storiesError } = useEpicStories(epicId);
  const deleteStory = useDeleteStory(epicId!);

  // Navigation
  const handleBackToEpics = useCallback(() => {
    if (projectId) {
      navigate(`/projects/${projectId}/epics`);
    } else {
      navigate(-1);
    }
  }, [navigate, projectId]);

  const handleBackToProject = useCallback(() => {
    if (projectId) {
      navigate(`/projects/${projectId}`);
    } else {
      navigate(-1);
    }
  }, [navigate, projectId]);

  // Story CRUD handlers
  const handleCreateStory = useCallback(() => {
    setSelectedStory(null);
    setShowCreateModal(true);
  }, []);

  const handleEditStory = useCallback((story: Story | StoryWithEpic) => {
    setSelectedStory(story);
    setShowEditModal(true);
  }, []);

  const handleDeleteStory = useCallback(async (story: Story | StoryWithEpic) => {
    try {
      await deleteStory.mutateAsync(story.id);
      showToast(`Story "${story.title}" deleted successfully`, "success");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete story";
      showToast(errorMessage, "error");
    }
  }, [deleteStory, showToast]);

  const handleViewTasks = useCallback((story: Story | StoryWithEpic) => {
    if (projectId) {
      navigate(`/projects/${projectId}/stories/${story.id}/tasks`);
    }
  }, [navigate, projectId]);

  // View mode handlers
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  const handleToggleCompactMode = useCallback(() => {
    setCompactMode(!compactMode);
  }, [compactMode]);

  // Statistics
  const stats = {
    total: stories.length,
    todo: stories.filter(s => s.status === 'todo').length,
    doing: stories.filter(s => s.status === 'doing').length,
    review: stories.filter(s => s.status === 'review').length,
    waiting: stories.filter(s => s.status === 'waiting').length,
    done: stories.filter(s => s.status === 'done').length,
    mvp: stories.filter(s => s.mvp_flag).length,
    completion: stories.length > 0 ? Math.round((stories.filter(s => s.status === 'done').length / stories.length) * 100) : 0,
  };

  // Loading state
  if (epicLoading || storiesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state
  if (epicError || storiesError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <p>Error loading story data</p>
        <Button onClick={() => navigate(-1)} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  // No epic found
  if (!epic) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p>Epic not found</p>
        <Button onClick={() => navigate(-1)} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={`space-y-6 ${className}`}>
        {/* Header Section */}
        <div className="space-y-4">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToProject}
              className="gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Project
            </Button>
            <span>/</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToEpics}
              className="hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Epics
            </Button>
            <span>/</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {epic.title}
            </span>
          </div>

          {/* Epic Info and Controls */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <BookOpen className="w-6 h-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Stories for "{epic.title}"
                </h1>
              </div>
              {epic.description && (
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
                  {epic.description}
                </p>
              )}
            </div>

            {/* View Controls */}
            <div className="flex items-center space-x-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleViewModeChange('grid')}
                      className="h-8 w-8 p-0"
                    >
                      <Grid className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Grid View</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleViewModeChange('list')}
                      className="h-8 w-8 p-0"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>List View</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleViewModeChange('kanban')}
                      className="h-8 w-8 p-0"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Kanban View</TooltipContent>
                </Tooltip>
              </div>

              {/* Additional Controls */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={compactMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleToggleCompactMode}
                    className="h-8 w-8 p-0"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Compact Mode</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Todo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.todo}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">Doing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.doing}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-600">Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.review}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-violet-600">Waiting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-600">{stats.waiting}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600">Done</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.done}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">MVP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.mvp}</div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Epic Progress</span>
                <span className="font-medium text-gray-900 dark:text-white">{stats.completion}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${stats.completion}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content - Story List */}
        <Card>
          <CardContent className="p-6">
            <StoryList
              epicId={epicId!}
              onCreateStory={handleCreateStory}
              onEditStory={handleEditStory}
              onDeleteStory={handleDeleteStory}
              onViewTasks={handleViewTasks}
              compact={compactMode}
              viewMode={viewMode}
              showEpicContext={false}
            />
          </CardContent>
        </Card>

        {/* Modals would go here - implement in next step */}
      </div>
    </TooltipProvider>
  );
};