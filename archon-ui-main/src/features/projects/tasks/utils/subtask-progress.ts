/**
 * Utility functions for calculating task progress based on subtasks
 */

import type { Task } from "../types";

/**
 * Calculate progress percentage based on subtasks completion
 * @param subtasks Array of subtasks
 * @returns Progress percentage (0-100)
 */
export function calculateTaskProgress(subtasks: Task[]): number {
  // Add extra safety checks for non-array subtasks
  if (!subtasks || !Array.isArray(subtasks) || subtasks.length === 0) {
    return 0;
  }

  const completedSubtasks = subtasks.filter(
    (subtask) => subtask.status === "done"
  );

  return Math.round((completedSubtasks.length / subtasks.length) * 100);
}

/**
 * Get subtask counts for display
 * @param subtasks Array of subtasks
 * @returns Object with total and completed counts
 */
export function getSubtaskCounts(subtasks: Task[]): {
  total: number;
  completed: number;
} {
  // Add extra safety checks for non-array subtasks
  if (!subtasks || !Array.isArray(subtasks) || subtasks.length === 0) {
    return { total: 0, completed: 0 };
  }

  return {
    total: subtasks.length,
    completed: subtasks.filter((subtask) => subtask.status === "done").length,
  };
}

/**
 * Enhance task with subtask progress information
 * @param task Task to enhance
 * @param subtasks Array of subtasks for this task
 * @returns Enhanced task with progress info
 */
export function enhanceTaskWithSubtasks(task: Task, subtasks: Task[]): Task {
  const counts = getSubtaskCounts(subtasks);

  return {
    ...task,
    subtasks,
    progress: calculateTaskProgress(subtasks),
    subtask_count: counts.total,
    completed_subtasks: counts.completed,
  };
}

/**
 * Get status-based progress color
 * @param progress Progress percentage
 * @returns Tailwind color class
 */
export function getProgressColor(progress: number): string {
  if (progress === 0) return "bg-gray-200 dark:bg-gray-700";
  if (progress < 25) return "bg-red-400";
  if (progress < 50) return "bg-orange-400";
  if (progress < 75) return "bg-yellow-400";
  if (progress < 100) return "bg-blue-400";
  return "bg-green-400";
}

/**
 * Get progress text color for contrast
 * @param progress Progress percentage
 * @returns Tailwind text color class
 */
export function getProgressTextColor(progress: number): string {
  if (progress === 0) return "text-gray-500 dark:text-gray-400";
  if (progress < 25) return "text-white";
  if (progress < 50) return "text-white";
  if (progress < 75) return "text-white";
  if (progress < 100) return "text-white";
  return "text-white";
}