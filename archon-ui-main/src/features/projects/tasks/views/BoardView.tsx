import { useState } from "react";
import type { Epic } from "../../epics/types";
import type { StoryCounts } from "../../stories/types";
import { KanbanColumn } from "../components/KanbanColumn";
import type { Task } from "../types";

interface BoardViewProps {
  tasks: Task[];
  epics: Epic[];
  projectId: string;
  dataType: 'epics' | 'tasks' | 'mixed';
  storyCounts?: Record<string, StoryCounts>;
  onTaskMove: (taskId: string, newStatus: Task["status"]) => void;
  onTaskReorder: (taskId: string, targetIndex: number, status: Task["status"]) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (task: Task) => void;
  onEpicEdit?: (epic: Epic) => void;
  onEpicDelete?: (epic: Epic) => void;
  onEpicViewStories?: (epic: Epic) => void;
}

export const BoardView = ({
  tasks,
  epics,
  projectId,
  dataType,
  storyCounts,
  onTaskMove,
  onTaskReorder,
  onTaskEdit,
  onTaskDelete,
  onEpicEdit,
  onEpicDelete,
  onEpicViewStories,
}: BoardViewProps) => {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // Get items by status - handles both EPICs and Tasks
  const getItemsByStatus = (status: Task["status"] | Epic["status"]) => {
    let items: (Task | Epic)[] = [];

    if (dataType === 'epics' || dataType === 'mixed') {
      const epicItems = epics.filter((epic) => epic.status === status).sort((a, b) => (a.priority || 0) - (b.priority || 0));
      items = [...items, ...epicItems];
    }

    if (dataType === 'tasks' || dataType === 'mixed') {
      const taskItems = tasks.filter((task) => task.status === status).sort((a, b) => a.task_order - b.task_order);
      items = [...items, ...taskItems];
    }

    return items;
  };

  // Show empty state when no items to display
  const hasItems = () => {
    if (dataType === 'epics') return epics.length > 0;
    if (dataType === 'tasks') return tasks.length > 0;
    return epics.length > 0 || tasks.length > 0;
  };

  // Column configuration - works for both EPICs and Tasks
  const columns: Array<{ status: Task["status"]; title: string }> = [
    { status: "todo", title: "Todo" },
    { status: "doing", title: "Doing" },
    { status: "review", title: "Review" },
    { status: "done", title: "Done" },
  ];

  // Display appropriate empty state message
  const getEmptyMessage = () => {
    if (dataType === 'epics') return "No EPICs found";
    if (dataType === 'tasks') return "No tasks found";
    return "No EPICs or tasks found";
  };

  return (
    <div className="flex flex-col h-full min-h-[70vh] relative">
      {!hasItems() ? (
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <p className="text-lg font-medium">{getEmptyMessage()}</p>
            <p className="text-sm mt-2">Create some {dataType === 'epics' ? 'EPICs' : dataType === 'tasks' ? 'tasks' : 'items'} to get started</p>
          </div>
        </div>
      ) : (
        /* Board Columns Grid */
        <div className="grid grid-cols-4 gap-1 flex-1 p-2">
          {columns.map(({ status, title }) => (
            <KanbanColumn
              key={status}
              status={status}
              title={title}
              tasks={dataType === 'epics' ? [] : getItemsByStatus(status) as Task[]}
              epics={dataType === 'tasks' ? [] : getItemsByStatus(status) as Epic[]}
              items={dataType === 'mixed' ? getItemsByStatus(status) : []}
              projectId={projectId}
              dataType={dataType}
              storyCounts={storyCounts}
              onTaskMove={onTaskMove}
              onTaskReorder={onTaskReorder}
              onTaskEdit={onTaskEdit}
              onTaskDelete={onTaskDelete}
              onEpicEdit={onEpicEdit}
              onEpicDelete={onEpicDelete}
              onEpicViewStories={onEpicViewStories}
              hoveredTaskId={hoveredTaskId}
              onTaskHover={setHoveredTaskId}
            />
          ))}
        </div>
      )}
    </div>
  );
};