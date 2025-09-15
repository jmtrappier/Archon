/**
 * Project Hooks
 *
 * All React hooks for the projects feature.
 * Includes:
 * - Data fetching hooks (useProjects, useTasks, useDocuments)
 * - Mutation hooks (useCreateProject, useUpdateTask, etc.)
 * - UI state hooks (useProjectSelection, useTaskFilters)
 * - Business logic hooks (useTaskDragDrop, useDocumentEditor)
 */

export {
  projectKeys,
  useCreateProject,
  useDeleteProject,
  useProject,
  useProjectFeatures,
  useProjects,
  useTaskCounts,
  useUpdateProject,
} from "./useProjectQueries";
