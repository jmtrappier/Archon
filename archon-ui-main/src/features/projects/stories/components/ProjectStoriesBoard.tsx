import { useMemo } from "react";
import type { HierarchyStatus, Story } from "../types";
import { StoryKanbanColumn } from "./StoryKanbanColumn";

const STORY_COLUMNS: Array<{
  status: HierarchyStatus;
  title: string;
  className: string;
}> = [
  {
    status: "todo",
    title: "Todo",
    className: "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900",
  },
  {
    status: "doing",
    title: "Doing",
    className: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20",
  },
  {
    status: "review",
    title: "Review",
    className: "bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/20 dark:to-yellow-900/20",
  },
  {
    status: "waiting",
    title: "Waiting",
    className: "bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900/20 dark:to-indigo-900/20",
  },
  {
    status: "done",
    title: "Done",
    className: "bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/20 dark:to-green-900/20",
  },
];

export interface ProjectStoriesBoardProps {
  stories: Story[];
  onStoryMove?: (storyId: string, status: HierarchyStatus) => void;
  onStoryReorder?: (storyId: string, targetIndex: number, status: HierarchyStatus) => void;
  onStoryEdit?: (story: Story) => void;
}

export const ProjectStoriesBoard = ({
  stories,
  onStoryMove,
  onStoryReorder,
  onStoryEdit,
}: ProjectStoriesBoardProps) => {
  const storiesByStatus = useMemo(() => {
    return STORY_COLUMNS.reduce<Record<HierarchyStatus, Story[]>>(
      (acc, column) => {
        acc[column.status] = stories.filter((story) => story.status === column.status);
        return acc;
      },
      {
        todo: [],
        doing: [],
        review: [],
        waiting: [],
        done: [],
      },
    );
  }, [stories]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 min-h-[70vh]">
      {STORY_COLUMNS.map(({ status, title, className }) => (
        <StoryKanbanColumn
          key={status}
          title={title}
          status={status}
          stories={storiesByStatus[status]}
          onStoryMove={onStoryMove}
          onStoryReorder={onStoryReorder}
          onStoryEdit={onStoryEdit}
          className={className}
        />
      ))}
    </div>
  );
};
