import type { HierarchyStatus, Priority } from "../types";

// Item types for drag and drop - reuse from epic styles but extend
export const StoryItemTypes = {
  STORY: "STORY",
  TASK: "TASK",
  SUBTASK: "SUBTASK",
} as const;

// Story status colors with modern palette (same as Epic for consistency)
export function getStoryStatusColor(status: HierarchyStatus): string {
  switch (status) {
    case "todo":
      return "#6B7280"; // Slate-500
    case "doing":
      return "#3B82F6"; // Blue-500
    case "review":
      return "#F59E0B"; // Amber-500
    case "waiting":
      return "#8B5CF6"; // Violet-500
    case "done":
      return "#10B981"; // Emerald-500
    default:
      return "#6B7280"; // Default slate
  }
}

// Story priority colors (consistent with Epic)
export function getStoryPriorityColor(priority: Priority): string {
  switch (priority) {
    case "low":
      return "#10B981"; // Emerald-500
    case "medium":
      return "#3B82F6"; // Blue-500
    case "high":
      return "#F59E0B"; // Amber-500
    case "critical":
      return "#EF4444"; // Red-500
    default:
      return "#3B82F6"; // Default medium
  }
}

// Story status background colors (for badges)
export function getStoryStatusBgColor(status: HierarchyStatus): string {
  const baseColor = getStoryStatusColor(status);
  return `${baseColor}20`; // 20% opacity
}

// Story status border colors (for badges)
export function getStoryStatusBorderColor(status: HierarchyStatus): string {
  const baseColor = getStoryStatusColor(status);
  return `${baseColor}30`; // 30% opacity
}

// Story glow effect based on priority
export function getStoryPriorityGlow(priority: Priority): string {
  const color = getStoryPriorityColor(priority);
  return `shadow-[0_0_8px_${color}30]`;
}

// Story card glow based on status
export function getStoryStatusGlow(status: HierarchyStatus): string {
  const color = getStoryStatusColor(status);
  return `shadow-[0_0_6px_${color}25]`;
}

// Get gradient for story progress bars
export function getStoryProgressGradient(status: HierarchyStatus, priority: Priority): string {
  const statusColor = getStoryStatusColor(status);
  const priorityColor = getStoryPriorityColor(priority);
  return `linear-gradient(90deg, ${statusColor}, ${priorityColor})`;
}

// Status ordering for display (left to right in kanban)
export const STORY_STATUS_ORDER: HierarchyStatus[] = ["todo", "doing", "review", "waiting", "done"];

// Priority ordering (highest to lowest)
export const STORY_PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low"];

// Story size classes based on content
export function getStorySizeClass(hasDescription: boolean, isExpanded: boolean): string {
  if (isExpanded) {
    return "min-h-[200px]";
  }
  if (hasDescription) {
    return "min-h-[160px]";
  }
  return "min-h-[120px]";
}

// Story hover effects (similar to Epic but slightly smaller)
export const STORY_HOVER_EFFECTS = {
  card: "group-hover:border-blue-400/80 dark:group-hover:border-blue-500/60 group-hover:shadow-[0_0_16px_rgba(59,130,246,0.4)]",
  indicator: "group-hover:w-[5px] group-hover:opacity-100",
  actions: "opacity-0 group-hover:opacity-100",
} as const;

// Story transition classes
export const STORY_TRANSITIONS = {
  all: "transition-all duration-200 ease-in-out",
  fast: "transition-all duration-150 ease-in-out",
  slow: "transition-all duration-300 ease-in-out",
  progress: "transition-all duration-500 ease-out",
} as const;

// Glassmorphism styles for stories (slightly different from Epic)
export const STORY_GLASSMORPHISM = {
  card: "bg-gradient-to-b from-white/85 to-white/60 dark:from-white/12 dark:to-black/35 backdrop-blur-lg",
  overlay: "bg-white/8 dark:bg-black/15 backdrop-blur-md",
  button: "bg-white/15 dark:bg-white/8 backdrop-blur-sm",
} as const;

// Story animation keyframes
export const STORY_ANIMATIONS = {
  fadeIn: "animate-in fade-in duration-200",
  fadeOut: "animate-out fade-out duration-150",
  slideIn: "animate-in slide-in-from-left-4 duration-200",
  slideOut: "animate-out slide-out-to-right-4 duration-150",
  scaleIn: "animate-in zoom-in-95 duration-200",
  scaleOut: "animate-out zoom-out-95 duration-150",
} as const;

// Story-specific styling helpers
export function getStoryEpicBadgeColor(epicTitle: string): string {
  // Generate a consistent color based on epic title
  const hash = epicTitle.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  const colors = [
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#EC4899', // Pink
    '#84CC16', // Lime
  ];

  return colors[Math.abs(hash) % colors.length];
}

// Story compact mode styling
export const STORY_COMPACT_MODE = {
  card: "min-h-[80px] p-2",
  title: "text-xs font-medium line-clamp-1",
  description: "text-xs opacity-75 line-clamp-1",
  badges: "gap-1",
  badge: "text-[10px] px-1 py-0.5",
} as const;

// Story MVP flag styling
export const STORY_MVP_STYLES = {
  flag: "bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/25",
  glow: "shadow-[0_0_12px_rgba(239,68,68,0.4)]",
} as const;