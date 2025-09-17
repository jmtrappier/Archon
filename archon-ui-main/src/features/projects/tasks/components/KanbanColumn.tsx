import { useRef } from "react";
import { useDrop } from "react-dnd";
import { cn } from "../../../ui/primitives/styles";
import { EpicCard } from "../../epics/components/EpicCard";
import type { Epic } from "../../epics/types";
import type { Task } from "../types";
import { getColumnColor, getColumnGlow, ItemTypes } from "../utils/task-styles";
import { HierarchicalItemTypes } from "./HierarchicalDragDrop";
import { TaskCard } from "./TaskCard";

interface KanbanColumnProps {
  status: Task["status"];
  title: string;
  tasks: Task[];
  epics?: Epic[];
  items?: (Task | Epic)[];
  projectId: string;
  dataType?: 'epics' | 'tasks' | 'mixed';
  onTaskMove: (taskId: string, newStatus: Task["status"]) => void;
  onTaskReorder: (taskId: string, targetIndex: number, status: Task["status"]) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (task: Task) => void;
  onEpicEdit?: (epic: Epic) => void;
  onEpicDelete?: (epic: Epic) => void;
  onEpicViewStories?: (epic: Epic) => void;
  hoveredTaskId: string | null;
  onTaskHover: (taskId: string | null) => void;
}

export const KanbanColumn = ({
  status,
  title,
  tasks,
  epics = [],
  items = [],
  projectId,
  dataType = 'tasks',
  onTaskMove,
  onTaskReorder,
  onTaskEdit,
  onTaskDelete,
  onEpicEdit,
  onEpicDelete,
  onEpicViewStories,
  hoveredTaskId,
  onTaskHover,
}: KanbanColumnProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop({
    accept: [HierarchicalItemTypes.TASK, HierarchicalItemTypes.EPIC],
    drop: (item: { id: string; status: Task["status"] | Epic["status"]; type?: string }) => {
      if (item.status !== status) {
        if (item.type === 'epic') {
          // Handle epic moves - for now, call onTaskMove as it handles all status changes
          onTaskMove(item.id, status);
        } else {
          // Handle task moves
          onTaskMove(item.id, status);
        }
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  drop(ref);

  // Helper function to render items based on data type
  const renderItems = () => {
    if (dataType === 'epics') {
      return epics.map((epic, index) => (
        <EpicCard
          key={epic.id}
          epic={epic}
          index={index}
          projectId={projectId}
          onEpicReorder={() => {}} // TODO: Implement epic reordering
          onEdit={onEpicEdit}
          onDelete={onEpicDelete}
          onViewStories={onEpicViewStories}
        />
      ));
    }

    if (dataType === 'tasks') {
      return tasks.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          index={index}
          projectId={projectId}
          onTaskReorder={onTaskReorder}
          onTaskEdit={onTaskEdit}
          onTaskDelete={onTaskDelete}
          hoveredTaskId={hoveredTaskId}
          onTaskHover={onTaskHover}
        />
      ));
    }

    if (dataType === 'mixed') {
      return items.map((item, index) => {
        if ('task_order' in item) {
          // It's a Task
          const task = item as Task;
          return (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              projectId={projectId}
              onTaskReorder={onTaskReorder}
              onTaskEdit={onTaskEdit}
              onTaskDelete={onTaskDelete}
              hoveredTaskId={hoveredTaskId}
              onTaskHover={onTaskHover}
            />
          );
        } else {
          // It's an Epic
          const epic = item as Epic;
          return (
            <EpicCard
              key={epic.id}
              epic={epic}
              index={index}
              projectId={projectId}
              onEpicReorder={() => {}} // TODO: Implement epic reordering
              onEdit={onEpicEdit}
              onDelete={onEpicDelete}
            />
          );
        }
      });
    }

    return null;
  };

  const getItemCount = () => {
    if (dataType === 'epics') return epics.length;
    if (dataType === 'tasks') return tasks.length;
    if (dataType === 'mixed') return items.length;
    return 0;
  };

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col h-full",
        "bg-gradient-to-b from-white/20 to-transparent dark:from-black/30 dark:to-transparent",
        "backdrop-blur-sm",
        "transition-all duration-200",
        isOver && "bg-gradient-to-b from-cyan-500/5 to-purple-500/5 dark:from-cyan-400/10 dark:to-purple-400/10",
        isOver && "border-t-2 border-t-cyan-400/50 dark:border-t-cyan-400/70",
        isOver &&
          "shadow-[inset_0_2px_20px_rgba(34,211,238,0.15)] dark:shadow-[inset_0_2px_30px_rgba(34,211,238,0.25)]",
        isOver && "backdrop-blur-md",
      )}
    >
      {/* Column Header with Glassmorphism */}
      <div
        className={cn(
          "text-center py-3 sticky top-0 z-10",
          "bg-gradient-to-b from-white/80 to-white/60 dark:from-black/80 dark:to-black/60",
          "backdrop-blur-md",
          "border-b border-gray-200/50 dark:border-gray-700/50",
          "relative",
        )}
      >
        <h3 className={cn("font-mono text-sm font-medium", getColumnColor(status))}>{title} ({getItemCount()})</h3>
        {/* Column header glow effect */}
        <div
          className={cn("absolute bottom-0 left-[15%] right-[15%] w-[70%] mx-auto h-[1px]", getColumnGlow(status))}
        />
      </div>

      {/* Items Container */}
      <div className="px-2 flex-1 overflow-y-auto space-y-2 py-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
        {getItemCount() === 0 ? (
          <div className={cn("text-center py-8 text-gray-400 dark:text-gray-600 text-sm", "opacity-60")}>
            No {dataType === 'epics' ? 'EPICs' : dataType === 'tasks' ? 'tasks' : 'items'}
          </div>
        ) : (
          renderItems()
        )}
      </div>
    </div>
  );
};
