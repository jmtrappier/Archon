import React, { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Package2, AlertCircle } from "lucide-react";
import { HierarchyLayout } from "../hierarchy/components/HierarchyLayout";
import { ProgressCard } from "../hierarchy/components/ProgressCard";
import { useProject } from "../hooks/useProjectQueries";
import { useEpics } from "../epics/hooks/useEpicQueries";
import { EpicModal } from "../epics/components/EpicModal";
import { Button } from "@/features/ui/primitives/button";
import { useToast } from "@/features/ui/hooks";

export const ProjectDashboard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isEpicModalOpen, setIsEpicModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<any>(null);
  const [selectedEpics, setSelectedEpics] = useState<Set<string>>(new Set());

  // Fetch project and epics data
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId!);
  const { data: epics = [], isLoading: epicsLoading, error: epicsError } = useEpics(projectId!);

  // Calculate overall stats
  const totalEpics = epics.length;
  const completedEpics = epics.filter(e => e.status === "done").length;
  const totalStories = epics.reduce((sum, e) => sum + (e.story_count || 0), 0);
  const completedStories = epics.reduce((sum, e) => sum + (e.completed_stories || 0), 0);
  const overallProgress = totalStories > 0
    ? Math.round((completedStories / totalStories) * 100)
    : 0;

  const handleEpicClick = useCallback((epicId: string) => {
    navigate(`/projects/${projectId}/epics/${epicId}`);
  }, [navigate, projectId]);

  const handleEpicEdit = useCallback((epic: any) => {
    setEditingEpic(epic);
    setIsEpicModalOpen(true);
  }, []);

  const handleEpicDelete = useCallback(async (epicId: string) => {
    if (confirm("Are you sure you want to delete this epic? This will also delete all its stories and tasks.")) {
      try {
        // TODO: Implement epic deletion
        showToast("Epic deletion not yet implemented", "info");
      } catch (error) {
        showToast("Failed to delete epic", "error");
      }
    }
  }, [showToast]);

  const handleAddEpic = useCallback(() => {
    setEditingEpic(null);
    setIsEpicModalOpen(true);
  }, []);

  const handleEpicSaved = useCallback(() => {
    setIsEpicModalOpen(false);
    setEditingEpic(null);
    showToast(editingEpic ? "Epic updated successfully" : "Epic created successfully", "success");
  }, [editingEpic, showToast]);

  const handleEpicSelect = useCallback((epicId: string, selected: boolean) => {
    setSelectedEpics(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(epicId);
      } else {
        newSet.delete(epicId);
      }
      return newSet;
    });
  }, []);

  if (projectLoading || epicsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package2 className="h-12 w-12 text-gray-400 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (projectError || epicsError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">
            Failed to load project data
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <HierarchyLayout
        level="project"
        title={project?.title || "Project"}
        subtitle={project?.description}
        progress={overallProgress}
        onAddNew={handleAddEpic}
        addNewLabel="New Epic"
        stats={[
          { label: "Epics", value: totalEpics },
          { label: "Stories", value: totalStories },
          { label: "Completed", value: completedStories },
        ]}
      >
        {/* Empty State */}
        {epics.length === 0 ? (
          <div className="text-center py-12">
            <Package2 className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No epics yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Epics are large features or initiatives that contain multiple user stories.
              Create your first epic to get started.
            </p>
            <Button onClick={handleAddEpic} className="mx-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create First Epic
            </Button>
          </div>
        ) : (
          <>
            {/* Bulk Actions Bar */}
            {selectedEpics.size > 0 && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {selectedEpics.size} epic{selectedEpics.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedEpics(new Set())}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      // TODO: Implement bulk delete
                      showToast("Bulk operations not yet implemented", "info");
                    }}
                  >
                    Delete Selected
                  </Button>
                </div>
              </div>
            )}

            {/* Epics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {epics.map((epic) => (
                <ProgressCard
                  key={epic.id}
                  level="epic"
                  code={epic.code}
                  title={epic.title}
                  description={epic.description}
                  status={epic.status}
                  progress={epic.progress || 0}
                  priority={epic.priority}
                  childCount={{
                    total: epic.story_count || 0,
                    completed: epic.completed_stories || 0,
                    label: "Stories",
                  }}
                  onClick={() => handleEpicClick(epic.id)}
                  onEdit={() => handleEpicEdit(epic)}
                  onDelete={() => handleEpicDelete(epic.id)}
                  isSelected={selectedEpics.has(epic.id)}
                  onSelect={(selected) => handleEpicSelect(epic.id, selected)}
                />
              ))}
            </div>
          </>
        )}
      </HierarchyLayout>

      {/* Epic Modal */}
      <EpicModal
        isOpen={isEpicModalOpen}
        projectId={projectId!}
        editingEpic={editingEpic}
        onClose={() => {
          setIsEpicModalOpen(false);
          setEditingEpic(null);
        }}
        onSaved={handleEpicSaved}
      />
    </>
  );
};