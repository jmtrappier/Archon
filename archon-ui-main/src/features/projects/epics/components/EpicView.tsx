import { Grid, List, Plus, Settings } from "lucide-react";
import type React from "react";
import { useState, useCallback, useEffect } from "react";
import { Button } from "../../../ui/primitives/button";
import { ToggleGroup, ToggleGroupItem } from "../../../ui/primitives/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/primitives/tooltip";
import { HierarchyBreadcrumb } from "../../../ui/components/navigation";
import { useHierarchyContext } from "../../../../contexts/HierarchyContext";
import { useCreateEpic, useProjectEpics, useDeleteEpic } from "../hooks/useEpicQueries";
import { useProject } from "../../hooks/useProjectQueries";
import type { Epic, CreateEpicRequest } from "../types";
import { EpicList } from "./EpicList";
import { EpicModal } from "./EpicModal";

type ViewMode = "grid" | "list";

export interface EpicViewProps {
  projectId: string;
  className?: string;
  onEpicViewStories?: (epic: Epic) => void;
  onNavigateToProject?: () => void;
}

export const EpicView: React.FC<EpicViewProps> = ({
  projectId,
  className = "",
  onEpicViewStories,
  onNavigateToProject,
}) => {
  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [deletingEpic, setDeletingEpic] = useState<Epic | null>(null);

  // Hierarchy context
  const { setProjectContext, clearFromLevel } = useHierarchyContext();

  // React Query hooks
  const { data: project } = useProject(projectId);
  const {
    data: epics = [],
    isLoading,
    error,
  } = useProjectEpics(projectId);

  const createEpic = useCreateEpic();
  const deleteEpic = useDeleteEpic(projectId);

  // Set project context when component mounts or project data changes
  useEffect(() => {
    if (project) {
      setProjectContext({
        id: project.id,
        title: project.title,
      });
      // Clear any epic/story/task context since we're at the epic list level
      clearFromLevel('epic');
    }
  }, [project, setProjectContext, clearFromLevel]);

  // Event handlers
  const handleCreateEpic = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleEpicEdit = useCallback((epic: Epic) => {
    setEditingEpic(epic);
  }, []);

  const handleEpicDelete = useCallback((epic: Epic) => {
    setDeletingEpic(epic);
  }, []);

  const handleCreateSubmit = useCallback(async (epicData: CreateEpicRequest) => {
    try {
      await createEpic.mutateAsync(epicData);
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error("Failed to create epic:", error);
      // Error is handled by the mutation with toast
    }
  }, [createEpic]);

  const handleEditSubmit = useCallback(async (epicData: Partial<Epic>) => {
    if (!editingEpic) return;

    try {
      // The updateEpic mutation will be handled by EpicModal
      setEditingEpic(null);
    } catch (error) {
      console.error("Failed to update epic:", error);
    }
  }, [editingEpic]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingEpic) return;

    try {
      await deleteEpic.mutateAsync(deletingEpic.id);
      setDeletingEpic(null);
    } catch (error) {
      console.error("Failed to delete epic:", error);
      // Error is handled by the mutation with toast
    }
  }, [deleteEpic, deletingEpic]);

  const handleCloseModals = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingEpic(null);
    setDeletingEpic(null);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-48 animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg w-24 animate-pulse" />
            <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg w-32 animate-pulse" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[180px] bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center py-12">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <p>Failed to load epics</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {error instanceof Error ? error.message : "Unknown error occurred"}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry
            </Button>
            {onNavigateToProject && (
              <Button onClick={onNavigateToProject} variant="default">
                Back to Project
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const epicCount = epics.length;
  const completedEpics = epics.filter(epic => epic.status === "done").length;
  const inProgressEpics = epics.filter(epic => epic.status === "doing").length;

  return (
    <TooltipProvider>
      <div className={`space-y-6 ${className}`}>
        {/* Hierarchy Breadcrumb */}
        <HierarchyBreadcrumb
          showHome={true}
          compact={false}
          showProgress={true}
          showIcons={true}
          enableKeyboardNavigation={true}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Epic Management
              </h1>
              {epicCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                    {epicCount} total
                  </span>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md">
                    {inProgressEpics} in progress
                  </span>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md">
                    {completedEpics} done
                  </span>
                </div>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Organize your project into major features and initiatives
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            {epicCount > 0 && (
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && setViewMode(value as ViewMode)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value="grid" aria-label="Grid view" size="sm">
                      <Grid className="h-4 w-4" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Grid View</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value="list" aria-label="List view" size="sm">
                      <List className="h-4 w-4" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>List View</p>
                  </TooltipContent>
                </Tooltip>
              </ToggleGroup>
            )}

            {/* Settings Button (future functionality) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled>
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Epic Settings (Coming Soon)</p>
              </TooltipContent>
            </Tooltip>

            {/* Create Button */}
            <Button onClick={handleCreateEpic} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Epic
            </Button>
          </div>
        </div>

        {/* Epic List/Grid */}
        <EpicList
          projectId={projectId}
          onEpicEdit={handleEpicEdit}
          onEpicDelete={handleEpicDelete}
          onEpicViewStories={onEpicViewStories}
          onCreateEpic={handleCreateEpic}
          showCreateButton={false} // We have our own create button in header
          showFilters={epicCount > 3} // Only show filters when there are enough epics
          showSorting={epicCount > 1}
        />

        {/* Progress Insights (when there are epics) */}
        {epicCount > 0 && (
          <div className="mt-8 p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Epic Progress Overview
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Track the overall progress of your project epics
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                  {completedEpics}/{epicCount}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {Math.round((completedEpics / epicCount) * 100)}% Complete
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((completedEpics / epicCount) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        <EpicModal
          isOpen={isCreateModalOpen || !!editingEpic || !!deletingEpic}
          onClose={handleCloseModals}
          projectId={projectId}
          mode={
            deletingEpic
              ? "delete"
              : editingEpic
              ? "edit"
              : "create"
          }
          epic={editingEpic || deletingEpic || undefined}
          onSubmit={editingEpic ? handleEditSubmit : handleCreateSubmit}
          onDeleteConfirm={handleDeleteConfirm}
          isLoading={createEpic.isPending || deleteEpic.isPending}
        />
      </div>
    </TooltipProvider>
  );
};