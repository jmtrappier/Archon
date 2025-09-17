import { useRef } from "react";
import { useDrop } from "react-dnd";
import { cn } from "../../../ui/primitives/styles";
import { StoryCard } from "./StoryCard";
import { StoryItemTypes } from "../utils/story-styles";
import type { Story } from "../types";
import type { HierarchyStatus } from "../../shared/types/hierarchy";

interface StoryKanbanColumnProps {
  status: HierarchyStatus;
  title: string;
  stories: Story[];
  epicId?: string;
  onStoryMove?: (storyId: string, newStatus: HierarchyStatus) => void;
  onStoryReorder?: (storyId: string, targetIndex: number, status: HierarchyStatus) => void;
  onStoryEdit?: (story: Story) => void;
  className?: string;
}

const getColumnColor = (status: HierarchyStatus) => {
  switch (status) {
    case "todo":
      return "text-gray-700 dark:text-gray-300";
    case "doing":
      return "text-blue-700 dark:text-blue-300";
    case "review":
      return "text-yellow-700 dark:text-yellow-300";
    case "done":
      return "text-green-700 dark:text-green-300";
    default:
      return "text-gray-700 dark:text-gray-300";
  }
};

const getColumnGlow = (status: HierarchyStatus) => {
  switch (status) {
    case "todo":
      return "bg-gradient-to-r from-transparent via-gray-400/30 to-transparent";
    case "doing":
      return "bg-gradient-to-r from-transparent via-blue-400/30 to-transparent";
    case "review":
      return "bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent";
    case "done":
      return "bg-gradient-to-r from-transparent via-green-400/30 to-transparent";
    default:
      return "bg-gradient-to-r from-transparent via-gray-400/30 to-transparent";
  }
};

export const StoryKanbanColumn = ({
  status,
  title,
  stories,
  epicId,
  onStoryMove,
  onStoryReorder,
  onStoryEdit,
  className,
}: StoryKanbanColumnProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop({
    accept: StoryItemTypes.STORY,
    drop: (item: { id: string; status: HierarchyStatus }) => {
      if (item.status !== status) {
        onStoryMove?.(item.id, status);
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  drop(ref);

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col h-full rounded-lg border border-gray-200/50 dark:border-gray-700/50",
        "bg-gradient-to-b from-white/20 to-transparent dark:from-black/30 dark:to-transparent",
        "backdrop-blur-sm",
        "transition-all duration-200",
        isOver && "bg-gradient-to-b from-cyan-500/5 to-purple-500/5 dark:from-cyan-400/10 dark:to-purple-400/10",
        isOver && "border-t-2 border-t-cyan-400/50 dark:border-t-cyan-400/70",
        isOver &&
          "shadow-[inset_0_2px_20px_rgba(34,211,238,0.15)] dark:shadow-[inset_0_2px_30px_rgba(34,211,238,0.25)]",
        isOver && "backdrop-blur-md",
        className
      )}
    >
      {/* Column Header */}
      <div
        className={cn(
          "text-center py-3 sticky top-0 z-10",
          "bg-gradient-to-b from-white/80 to-white/60 dark:from-black/80 dark:to-black/60",
          "backdrop-blur-md",
          "border-b border-gray-200/50 dark:border-gray-700/50",
          "relative rounded-t-lg",
        )}
      >
        <h3 className={cn("font-mono text-sm font-medium", getColumnColor(status))}>
          {title} ({stories.length})
        </h3>
        {/* Column header glow effect */}
        <div
          className={cn("absolute bottom-0 left-[15%] right-[15%] w-[70%] mx-auto h-[1px]", getColumnGlow(status))}
        />
      </div>

      {/* Stories Container */}
      <div className="px-2 flex-1 overflow-y-auto space-y-2 py-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
        {stories.length === 0 ? (
          <div className={cn("text-center py-8 text-gray-400 dark:text-gray-600 text-sm", "opacity-60")}>
            No stories
          </div>
        ) : (
          stories.map((story, index) => (
            <StoryCard
              key={story.id}
              story={story}
              index={index}
              epicId={epicId ?? story.epic_id}
              onStoryReorder={onStoryReorder}
              onEdit={onStoryEdit}
              showEpicContext={false}
              compact={false}
            />
          ))
        )}
      </div>
    </div>
  );
};