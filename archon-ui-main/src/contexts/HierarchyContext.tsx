import type React from "react";
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Epic, Story, Task } from "../features/projects/shared/types/hierarchy";

// Hierarchy Context Types
export interface HierarchyContextData {
  project?: {
    id: string;
    title: string;
  };
  epic?: {
    id: string;
    title: string;
    progress?: number;
  };
  story?: {
    id: string;
    title: string;
    progress?: number;
  };
  task?: {
    id: string;
    title: string;
    progress?: number;
  };
  subtask?: {
    id: string;
    title: string;
    progress?: number;
  };
}

export interface BreadcrumbSegment {
  level: 'project' | 'epic' | 'story' | 'task' | 'subtask';
  id: string;
  title: string;
  progress?: number;
  url: string;
  clickable: boolean;
}

export interface HierarchyContextValue {
  // Current hierarchy context
  context: HierarchyContextData;

  // Navigation methods
  navigateToProject: (projectId: string) => void;
  navigateToEpic: (projectId: string, epicId: string) => void;
  navigateToStory: (projectId: string, epicId: string, storyId: string) => void;
  navigateToTask: (projectId: string, epicId: string, storyId: string, taskId: string) => void;

  // Context update methods
  setProjectContext: (project: { id: string; title: string }) => void;
  setEpicContext: (epic: { id: string; title: string; progress?: number }) => void;
  setStoryContext: (story: { id: string; title: string; progress?: number }) => void;
  setTaskContext: (task: { id: string; title: string; progress?: number }) => void;
  setSubtaskContext: (subtask: { id: string; title: string; progress?: number }) => void;

  // Clear context methods
  clearContext: () => void;
  clearFromLevel: (level: 'epic' | 'story' | 'task' | 'subtask') => void;

  // Breadcrumb generation
  getBreadcrumbs: () => BreadcrumbSegment[];

  // URL parsing utilities
  parseCurrentUrl: () => HierarchyContextData;
  isCurrentLevel: (level: string) => boolean;
}

// Create context with undefined default (will be provided by Provider)
const HierarchyContext = createContext<HierarchyContextValue | undefined>(undefined);

// Custom hook to use hierarchy context
export const useHierarchyContext = (): HierarchyContextValue => {
  const context = useContext(HierarchyContext);
  if (!context) {
    throw new Error('useHierarchyContext must be used within a HierarchyProvider');
  }
  return context;
};

// URL pattern constants
export const URL_PATTERNS = {
  projects: '/projects',
  project: '/projects/:projectId',
  epics: '/projects/:projectId/epics',
  epic: '/projects/:projectId/epics/:epicId',
  stories: '/projects/:projectId/epics/:epicId/stories',
  story: '/projects/:projectId/epics/:epicId/stories/:storyId',
  tasks: '/projects/:projectId/epics/:epicId/stories/:storyId/tasks',
  task: '/projects/:projectId/epics/:epicId/stories/:storyId/tasks/:taskId',
} as const;

// Hierarchy Provider Props
export interface HierarchyProviderProps {
  children: ReactNode;
}

// Hierarchy Provider Component
export const HierarchyProvider: React.FC<HierarchyProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const params = useParams();

  // State to hold current hierarchy context
  const [context, setContext] = useState<HierarchyContextData>({});

  // Navigation methods
  const navigateToProject = useCallback((projectId: string) => {
    navigate(`/projects/${projectId}`);
  }, [navigate]);

  const navigateToEpic = useCallback((projectId: string, epicId: string) => {
    navigate(`/projects/${projectId}/epics/${epicId}`);
  }, [navigate]);

  const navigateToStory = useCallback((projectId: string, epicId: string, storyId: string) => {
    navigate(`/projects/${projectId}/epics/${epicId}/stories/${storyId}`);
  }, [navigate]);

  const navigateToTask = useCallback((projectId: string, epicId: string, storyId: string, taskId: string) => {
    navigate(`/projects/${projectId}/epics/${epicId}/stories/${storyId}/tasks/${taskId}`);
  }, [navigate]);

  // Context update methods
  const setProjectContext = useCallback((project: { id: string; title: string }) => {
    setContext(prev => ({ ...prev, project }));
  }, []);

  const setEpicContext = useCallback((epic: { id: string; title: string; progress?: number }) => {
    setContext(prev => ({ ...prev, epic }));
  }, []);

  const setStoryContext = useCallback((story: { id: string; title: string; progress?: number }) => {
    setContext(prev => ({ ...prev, story }));
  }, []);

  const setTaskContext = useCallback((task: { id: string; title: string; progress?: number }) => {
    setContext(prev => ({ ...prev, task }));
  }, []);

  const setSubtaskContext = useCallback((subtask: { id: string; title: string; progress?: number }) => {
    setContext(prev => ({ ...prev, subtask }));
  }, []);

  // Clear context methods
  const clearContext = useCallback(() => {
    setContext({});
  }, []);

  const clearFromLevel = useCallback((level: 'epic' | 'story' | 'task' | 'subtask') => {
    setContext(prev => {
      const newContext = { ...prev };

      switch (level) {
        case 'epic':
          delete newContext.epic;
          delete newContext.story;
          delete newContext.task;
          delete newContext.subtask;
          break;
        case 'story':
          delete newContext.story;
          delete newContext.task;
          delete newContext.subtask;
          break;
        case 'task':
          delete newContext.task;
          delete newContext.subtask;
          break;
        case 'subtask':
          delete newContext.subtask;
          break;
      }

      return newContext;
    });
  }, []);

  // Parse current URL to determine context
  const parseCurrentUrl = useCallback((): HierarchyContextData => {
    const { projectId, epicId, storyId, taskId } = params;

    const urlContext: HierarchyContextData = {};

    if (projectId && context.project?.id === projectId) {
      urlContext.project = context.project;
    }

    if (epicId && context.epic?.id === epicId) {
      urlContext.epic = context.epic;
    }

    if (storyId && context.story?.id === storyId) {
      urlContext.story = context.story;
    }

    if (taskId && context.task?.id === taskId) {
      urlContext.task = context.task;
    }

    return urlContext;
  }, [params, context]);

  // Check if we're currently at a specific level
  const isCurrentLevel = useCallback((level: string): boolean => {
    const { projectId, epicId, storyId, taskId } = params;

    switch (level) {
      case 'project':
        return !!projectId && !epicId && !storyId && !taskId;
      case 'epic':
        return !!epicId && !storyId && !taskId;
      case 'story':
        return !!storyId && !taskId;
      case 'task':
        return !!taskId;
      default:
        return false;
    }
  }, [params]);

  // Generate breadcrumb segments from current context and URL
  const getBreadcrumbs = useCallback((): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [];
    const { projectId, epicId, storyId, taskId } = params;

    // Always show project if we have context or are in a project
    if (context.project || projectId) {
      segments.push({
        level: 'project',
        id: context.project?.id || projectId || '',
        title: context.project?.title || 'Project',
        url: `/projects/${context.project?.id || projectId}`,
        clickable: true,
      });
    }

    // Show epic if we have context or are in an epic
    if ((context.epic || epicId) && projectId) {
      segments.push({
        level: 'epic',
        id: context.epic?.id || epicId || '',
        title: context.epic?.title || 'Epic',
        progress: context.epic?.progress,
        url: `/projects/${projectId}/epics/${context.epic?.id || epicId}`,
        clickable: true,
      });
    }

    // Show story if we have context or are in a story
    if ((context.story || storyId) && projectId && (context.epic?.id || epicId)) {
      segments.push({
        level: 'story',
        id: context.story?.id || storyId || '',
        title: context.story?.title || 'Story',
        progress: context.story?.progress,
        url: `/projects/${projectId}/epics/${context.epic?.id || epicId}/stories/${context.story?.id || storyId}`,
        clickable: true,
      });
    }

    // Show task if we have context or are in a task
    if ((context.task || taskId) && projectId && (context.epic?.id || epicId) && (context.story?.id || storyId)) {
      segments.push({
        level: 'task',
        id: context.task?.id || taskId || '',
        title: context.task?.title || 'Task',
        progress: context.task?.progress,
        url: `/projects/${projectId}/epics/${context.epic?.id || epicId}/stories/${context.story?.id || storyId}/tasks/${context.task?.id || taskId}`,
        clickable: true,
      });
    }

    // Show subtask if we have context (subtasks don't have separate URLs)
    if (context.subtask) {
      segments.push({
        level: 'subtask',
        id: context.subtask.id,
        title: context.subtask.title,
        progress: context.subtask.progress,
        url: '', // Subtasks don't have separate URLs
        clickable: false,
      });
    }

    return segments;
  }, [context, params]);

  // Create the context value
  const contextValue: HierarchyContextValue = {
    context,
    navigateToProject,
    navigateToEpic,
    navigateToStory,
    navigateToTask,
    setProjectContext,
    setEpicContext,
    setStoryContext,
    setTaskContext,
    setSubtaskContext,
    clearContext,
    clearFromLevel,
    getBreadcrumbs,
    parseCurrentUrl,
    isCurrentLevel,
  };

  return (
    <HierarchyContext.Provider value={contextValue}>
      {children}
    </HierarchyContext.Provider>
  );
};

// Utility hooks for specific hierarchy levels
export const useProjectContext = () => {
  const { context, setProjectContext } = useHierarchyContext();
  return {
    project: context.project,
    setProject: setProjectContext,
  };
};

export const useEpicContext = () => {
  const { context, setEpicContext } = useHierarchyContext();
  return {
    epic: context.epic,
    setEpic: setEpicContext,
  };
};

export const useStoryContext = () => {
  const { context, setStoryContext } = useHierarchyContext();
  return {
    story: context.story,
    setStory: setStoryContext,
  };
};

export const useTaskContext = () => {
  const { context, setTaskContext } = useHierarchyContext();
  return {
    task: context.task,
    setTask: setTaskContext,
  };
};

export const useNavigation = () => {
  const { navigateToProject, navigateToEpic, navigateToStory, navigateToTask } = useHierarchyContext();
  return {
    navigateToProject,
    navigateToEpic,
    navigateToStory,
    navigateToTask,
  };
};