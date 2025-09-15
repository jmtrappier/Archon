/**
 * Hierarchy Navigation Utilities
 *
 * Utilities for parsing URLs, generating hierarchy paths, and managing navigation state
 * in the PROJECT → EPIC → STORY → TASK → SUBTASK hierarchy.
 */

import type { BreadcrumbSegment, HierarchyContextData } from "../contexts/HierarchyContext";

// URL Pattern Types
export type HierarchyLevel = 'projects' | 'project' | 'epic' | 'story' | 'task' | 'subtask';

// URL parsing result
export interface ParsedUrl {
  level: HierarchyLevel;
  projectId?: string;
  epicId?: string;
  storyId?: string;
  taskId?: string;
  isValid: boolean;
}

// URL patterns for matching
const URL_PATTERNS = {
  projects: /^\/projects\/?$/,
  project: /^\/projects\/([^/]+)\/?$/,
  epic: /^\/projects\/([^/]+)\/epics\/([^/]+)\/?$/,
  story: /^\/projects\/([^/]+)\/epics\/([^/]+)\/stories\/([^/]+)\/?$/,
  task: /^\/projects\/([^/]+)\/epics\/([^/]+)\/stories\/([^/]+)\/tasks\/([^/]+)\/?$/,
};

/**
 * Parse a URL path to extract hierarchy information
 */
export const parseHierarchyUrl = (path: string): ParsedUrl => {
  // Remove query parameters and fragments
  const cleanPath = path.split('?')[0].split('#')[0];

  // Check each pattern
  for (const [level, pattern] of Object.entries(URL_PATTERNS)) {
    const match = cleanPath.match(pattern);
    if (match) {
      const result: ParsedUrl = {
        level: level as HierarchyLevel,
        isValid: true,
      };

      // Extract IDs based on the pattern
      if (match.length > 1) result.projectId = match[1];
      if (match.length > 2) result.epicId = match[2];
      if (match.length > 3) result.storyId = match[3];
      if (match.length > 4) result.taskId = match[4];

      return result;
    }
  }

  // No pattern matched
  return {
    level: 'projects',
    isValid: false,
  };
};

/**
 * Generate URL for a specific hierarchy level
 */
export const generateHierarchyUrl = (
  level: HierarchyLevel,
  ids: {
    projectId?: string;
    epicId?: string;
    storyId?: string;
    taskId?: string;
  }
): string => {
  const { projectId, epicId, storyId, taskId } = ids;

  switch (level) {
    case 'projects':
      return '/projects';

    case 'project':
      if (!projectId) throw new Error('Project ID required for project URL');
      return `/projects/${projectId}`;

    case 'epic':
      if (!projectId || !epicId) throw new Error('Project ID and Epic ID required for epic URL');
      return `/projects/${projectId}/epics/${epicId}`;

    case 'story':
      if (!projectId || !epicId || !storyId) {
        throw new Error('Project ID, Epic ID, and Story ID required for story URL');
      }
      return `/projects/${projectId}/epics/${epicId}/stories/${storyId}`;

    case 'task':
      if (!projectId || !epicId || !storyId || !taskId) {
        throw new Error('All IDs required for task URL');
      }
      return `/projects/${projectId}/epics/${epicId}/stories/${storyId}/tasks/${taskId}`;

    default:
      throw new Error(`Unknown hierarchy level: ${level}`);
  }
};

/**
 * Validate if IDs are sufficient for a given hierarchy level
 */
export const validateHierarchyIds = (
  level: HierarchyLevel,
  ids: {
    projectId?: string;
    epicId?: string;
    storyId?: string;
    taskId?: string;
  }
): boolean => {
  const { projectId, epicId, storyId, taskId } = ids;

  switch (level) {
    case 'projects':
      return true;

    case 'project':
      return !!projectId;

    case 'epic':
      return !!projectId && !!epicId;

    case 'story':
      return !!projectId && !!epicId && !!storyId;

    case 'task':
      return !!projectId && !!epicId && !!storyId && !!taskId;

    default:
      return false;
  }
};

/**
 * Get the parent level of a hierarchy level
 */
export const getParentLevel = (level: HierarchyLevel): HierarchyLevel | null => {
  switch (level) {
    case 'project':
      return 'projects';
    case 'epic':
      return 'project';
    case 'story':
      return 'epic';
    case 'task':
      return 'story';
    default:
      return null;
  }
};

/**
 * Get all ancestor levels for a given level
 */
export const getAncestorLevels = (level: HierarchyLevel): HierarchyLevel[] => {
  const ancestors: HierarchyLevel[] = [];
  let currentLevel: HierarchyLevel | null = level;

  while (currentLevel) {
    const parent = getParentLevel(currentLevel);
    if (parent) {
      ancestors.unshift(parent);
    }
    currentLevel = parent;
  }

  return ancestors;
};

/**
 * Create breadcrumb segments from context and current URL
 */
export const createBreadcrumbSegments = (
  context: HierarchyContextData,
  currentPath: string
): BreadcrumbSegment[] => {
  const parsed = parseHierarchyUrl(currentPath);
  const segments: BreadcrumbSegment[] = [];

  if (!parsed.isValid) {
    return segments;
  }

  // Add project segment
  if (parsed.projectId || context.project) {
    const projectId = parsed.projectId || context.project?.id;
    const projectTitle = context.project?.title || 'Project';

    if (projectId) {
      segments.push({
        level: 'project',
        id: projectId,
        title: projectTitle,
        url: generateHierarchyUrl('project', { projectId }),
        clickable: true,
      });
    }
  }

  // Add epic segment
  if ((parsed.epicId || context.epic) && parsed.projectId) {
    const epicId = parsed.epicId || context.epic?.id;
    const epicTitle = context.epic?.title || 'Epic';
    const epicProgress = context.epic?.progress;

    if (epicId) {
      segments.push({
        level: 'epic',
        id: epicId,
        title: epicTitle,
        progress: epicProgress,
        url: generateHierarchyUrl('epic', {
          projectId: parsed.projectId,
          epicId
        }),
        clickable: true,
      });
    }
  }

  // Add story segment
  if ((parsed.storyId || context.story) && parsed.projectId && parsed.epicId) {
    const storyId = parsed.storyId || context.story?.id;
    const storyTitle = context.story?.title || 'Story';
    const storyProgress = context.story?.progress;

    if (storyId) {
      segments.push({
        level: 'story',
        id: storyId,
        title: storyTitle,
        progress: storyProgress,
        url: generateHierarchyUrl('story', {
          projectId: parsed.projectId,
          epicId: parsed.epicId,
          storyId,
        }),
        clickable: true,
      });
    }
  }

  // Add task segment
  if ((parsed.taskId || context.task) && parsed.projectId && parsed.epicId && parsed.storyId) {
    const taskId = parsed.taskId || context.task?.id;
    const taskTitle = context.task?.title || 'Task';
    const taskProgress = context.task?.progress;

    if (taskId) {
      segments.push({
        level: 'task',
        id: taskId,
        title: taskTitle,
        progress: taskProgress,
        url: generateHierarchyUrl('task', {
          projectId: parsed.projectId,
          epicId: parsed.epicId,
          storyId: parsed.storyId,
          taskId,
        }),
        clickable: true,
      });
    }
  }

  // Add subtask segment (if in context, subtasks don't have URLs)
  if (context.subtask) {
    segments.push({
      level: 'subtask',
      id: context.subtask.id,
      title: context.subtask.title,
      progress: context.subtask.progress,
      url: '', // Subtasks are shown inline, no separate URL
      clickable: false,
    });
  }

  return segments;
};

/**
 * Check if a URL represents a deeper level than another
 */
export const isDeepgerLevel = (urlA: string, urlB: string): boolean => {
  const parsedA = parseHierarchyUrl(urlA);
  const parsedB = parseHierarchyUrl(urlB);

  const levelOrder: HierarchyLevel[] = ['projects', 'project', 'epic', 'story', 'task'];
  const levelAIndex = levelOrder.indexOf(parsedA.level);
  const levelBIndex = levelOrder.indexOf(parsedB.level);

  return levelAIndex > levelBIndex;
};

/**
 * Get the hierarchy depth of a URL
 */
export const getHierarchyDepth = (path: string): number => {
  const parsed = parseHierarchyUrl(path);

  switch (parsed.level) {
    case 'projects':
      return 0;
    case 'project':
      return 1;
    case 'epic':
      return 2;
    case 'story':
      return 3;
    case 'task':
      return 4;
    case 'subtask':
      return 5;
    default:
      return 0;
  }
};

/**
 * Truncate text for breadcrumb display
 */
export const truncateTitle = (title: string, maxLength: number = 20): string => {
  if (title.length <= maxLength) {
    return title;
  }

  return `${title.slice(0, maxLength - 3)}...`;
};

/**
 * Get appropriate icon for hierarchy level
 */
export const getHierarchyIcon = (level: string): string => {
  switch (level) {
    case 'project':
      return '📁';
    case 'epic':
      return '🎯';
    case 'story':
      return '📝';
    case 'task':
      return '☑️';
    case 'subtask':
      return '▪️';
    default:
      return '•';
  }
};

/**
 * Get hierarchy level display name
 */
export const getHierarchyDisplayName = (level: string): string => {
  switch (level) {
    case 'projects':
      return 'Projects';
    case 'project':
      return 'Project';
    case 'epic':
      return 'Epic';
    case 'story':
      return 'Story';
    case 'task':
      return 'Task';
    case 'subtask':
      return 'Subtask';
    default:
      return 'Unknown';
  }
};

/**
 * Generate accessible label for breadcrumb segment
 */
export const getAccessibleLabel = (segment: BreadcrumbSegment): string => {
  const levelName = getHierarchyDisplayName(segment.level);
  const progressText = segment.progress !== undefined
    ? ` (${segment.progress}% complete)`
    : '';

  return `Navigate to ${levelName}: ${segment.title}${progressText}`;
};