import type { HierarchyStatus, Priority } from "../types";

// Item types for drag and drop
export const ItemTypes = {
  EPIC: "EPIC",
  STORY: "STORY",
  TASK: "TASK",
  SUBTASK: "SUBTASK",
} as const;

// Epic status colors with modern palette
export function getEpicStatusColor(status: HierarchyStatus): string {
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

// Epic priority colors
export function getEpicPriorityColor(priority: Priority): string {
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

// Epic status background colors (for badges)
export function getEpicStatusBgColor(status: HierarchyStatus): string {
  const baseColor = getEpicStatusColor(status);
  return `${baseColor}20`; // 20% opacity
}

// Epic status border colors (for badges)
export function getEpicStatusBorderColor(status: HierarchyStatus): string {
  const baseColor = getEpicStatusColor(status);
  return `${baseColor}30`; // 30% opacity
}

// Epic glow effect based on priority
export function getEpicPriorityGlow(priority: Priority): string {
  const color = getEpicPriorityColor(priority);
  return `shadow-[0_0_8px_${color}30]`;
}

// Epic card glow based on status
export function getEpicStatusGlow(status: HierarchyStatus): string {
  const color = getEpicStatusColor(status);
  return `shadow-[0_0_6px_${color}25]`;
}

// Get gradient for epic progress bars
export function getEpicProgressGradient(status: HierarchyStatus, priority: Priority): string {
  const statusColor = getEpicStatusColor(status);
  const priorityColor = getEpicPriorityColor(priority);
  return `linear-gradient(90deg, ${statusColor}, ${priorityColor})`;
}

// Status ordering for display (left to right in kanban)
export const EPIC_STATUS_ORDER: HierarchyStatus[] = ["todo", "doing", "review", "waiting", "done"];

// Priority ordering (highest to lowest)
export const EPIC_PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low"];

// Epic size classes based on content
export function getEpicSizeClass(hasDescription: boolean, isExpanded: boolean): string {
  if (isExpanded) {
    return "min-h-[220px]";
  }
  if (hasDescription) {
    return "min-h-[180px]";
  }
  return "min-h-[140px]";
}

// Epic hover effects
export const EPIC_HOVER_EFFECTS = {
  card: "group-hover:border-indigo-400/80 dark:group-hover:border-indigo-500/60 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]",
  indicator: "group-hover:w-[5px] group-hover:opacity-100",
  actions: "opacity-0 group-hover:opacity-100",
} as const;

// Epic transition classes
export const EPIC_TRANSITIONS = {
  all: "transition-all duration-200 ease-in-out",
  fast: "transition-all duration-150 ease-in-out",
  slow: "transition-all duration-300 ease-in-out",
  progress: "transition-all duration-500 ease-out",
} as const;

// Glassmorphism styles for epics
export const EPIC_GLASSMORPHISM = {
  card: "bg-gradient-to-b from-white/90 to-white/70 dark:from-white/15 dark:to-black/40 backdrop-blur-lg",
  overlay: "bg-white/10 dark:bg-black/20 backdrop-blur-md",
  button: "bg-white/20 dark:bg-white/10 backdrop-blur-sm",
} as const;

// Epic animation keyframes (for future use)
export const EPIC_ANIMATIONS = {
  fadeIn: "animate-in fade-in duration-200",
  fadeOut: "animate-out fade-out duration-150",
  slideIn: "animate-in slide-in-from-left-4 duration-200",
  slideOut: "animate-out slide-out-to-right-4 duration-150",
  scaleIn: "animate-in zoom-in-95 duration-200",
  scaleOut: "animate-out zoom-out-95 duration-150",
} as const;
