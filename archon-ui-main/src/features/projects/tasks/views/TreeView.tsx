import React, { useState, useEffect, useMemo } from "react";
import { ChevronRight, ChevronDown, Hash, BookOpen, CheckSquare, Square, AlertCircle, Clock, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { glassmorphism } from "@/features/ui/primitives/styles";
import type { Epic, Story, Task } from "@/types/project";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/features/ui/primitives/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/features/ui/primitives/tooltip";

interface TreeViewProps {
  projectId: string;
  epics: Epic[];
  stories: Story[];
  tasks: Task[];
  subtasks: Task[];
  isLoading: boolean;
  onTaskClick?: (task: Task) => void;
  onEpicClick?: (epic: Epic) => void;
  onStoryClick?: (story: Story) => void;
}

interface TreeNodeData {
  id: string;
  title: string;
  type: "epic" | "story" | "task" | "subtask";
  status: string;
  priority?: string;
  assignee?: string;
  progress?: number;
  children?: TreeNodeData[];
  data: Epic | Story | Task;
}

const statusColors: Record<string, string> = {
  todo: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
  doing: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  review: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  done: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  waiting: "bg-rose-500/20 text-rose-600 dark:text-rose-400",
};

const priorityIcons: Record<string, JSX.Element> = {
  critical: <AlertCircle className="w-3 h-3 text-red-500" />,
  high: <ChevronRight className="w-3 h-3 text-orange-500 rotate-[-90deg]" />,
  medium: <ChevronRight className="w-3 h-3 text-yellow-500 rotate-0" />,
  low: <ChevronRight className="w-3 h-3 text-green-500 rotate-90" />,
};

const TreeNode: React.FC<{
  node: TreeNodeData;
  level: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onNodeClick: (node: TreeNodeData) => void;
}> = ({ node, level, expanded, onToggleExpand, onNodeClick }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);

  // Calculate progress based on children
  const progress = useMemo(() => {
    if (!hasChildren) {
      return node.status === "done" ? 100 : node.status === "doing" ? 50 : 0;
    }

    const completedChildren = node.children!.filter(c =>
      c.status === "done" || (c.progress && c.progress === 100)
    ).length;

    return Math.round((completedChildren / node.children!.length) * 100);
  }, [node, hasChildren]);

  // Get the appropriate icon based on type
  const getIcon = () => {
    switch (node.type) {
      case "epic":
        return <Hash className="w-4 h-4" />;
      case "story":
        return <BookOpen className="w-4 h-4" />;
      case "task":
      case "subtask":
        return node.status === "done"
          ? <CheckSquare className="w-4 h-4" />
          : <Square className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all duration-200",
          "hover:bg-white/10 dark:hover:bg-gray-800/30",
          level > 0 && "border-l-2 border-gray-300/20 dark:border-gray-700/30"
        )}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) {
            onToggleExpand(node.id);
          }
          onNodeClick(node);
        }}
      >
        {/* Expand/Collapse Icon */}
        {hasChildren && (
          <div
            className="flex-shrink-0 p-0.5 hover:bg-white/20 dark:hover:bg-gray-700/30 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </div>
        )}
        {!hasChildren && <div className="w-5" />}

        {/* Type Icon */}
        <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
          {getIcon()}
        </div>

        {/* Title */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="truncate font-medium text-gray-800 dark:text-gray-200">
            {node.title}
          </span>

          {/* Priority Icon */}
          {node.priority && priorityIcons[node.priority] && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-shrink-0">
                    {priorityIcons[node.priority]}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Priority: {node.priority}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Status Badge */}
        <Badge
          className={cn(
            "flex-shrink-0 text-xs px-2 py-0.5",
            statusColors[node.status] || statusColors.todo
          )}
        >
          {node.status}
        </Badge>

        {/* Progress Bar (for items with children) */}
        {hasChildren && (
          <div className="flex-shrink-0 flex items-center gap-2">
            <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
              {progress}%
            </span>
          </div>
        )}

        {/* Assignee */}
        {node.assignee && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                  {node.assignee.substring(0, 1).toUpperCase()}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Assigned to: {node.assignee}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Stats (for epics/stories) */}
        {hasChildren && (
          <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
            {node.children!.filter(c => c.status === "done").length}/{node.children!.length}
          </div>
        )}
      </div>

      {/* Render Children */}
      {hasChildren && isExpanded && (
        <div className="mt-1">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TreeView: React.FC<TreeViewProps> = ({
  projectId,
  epics,
  stories,
  tasks,
  subtasks,
  isLoading,
  onTaskClick,
  onEpicClick,
  onStoryClick,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  // Load expanded state from localStorage
  useEffect(() => {
    const savedExpanded = localStorage.getItem(`treeview-expanded-${projectId}`);
    if (savedExpanded) {
      try {
        setExpanded(new Set(JSON.parse(savedExpanded)));
      } catch (error) {
        console.error("Failed to load expanded state:", error);
      }
    }
  }, [projectId]);

  // Save expanded state to localStorage
  useEffect(() => {
    localStorage.setItem(
      `treeview-expanded-${projectId}`,
      JSON.stringify(Array.from(expanded))
    );
  }, [expanded, projectId]);

  // Build tree structure
  const treeData = useMemo(() => {
    const tree: TreeNodeData[] = [];

    // Build hierarchy: EPICs -> Stories -> Tasks -> Subtasks
    epics.forEach((epic) => {
      const epicNode: TreeNodeData = {
        id: epic.id,
        title: epic.title,
        type: "epic",
        status: epic.status,
        priority: epic.priority,
        data: epic,
        children: [],
      };

      // Add stories to epic
      const epicStories = stories.filter((story) => story.epic_id === epic.id);
      epicStories.forEach((story) => {
        const storyNode: TreeNodeData = {
          id: story.id,
          title: story.title,
          type: "story",
          status: story.status,
          priority: story.priority,
          data: story,
          children: [],
        };

        // Add tasks to story
        const storyTasks = tasks.filter((task) => task.story_id === story.id);
        storyTasks.forEach((task) => {
          const taskNode: TreeNodeData = {
            id: task.id,
            title: task.title,
            type: "task",
            status: task.status,
            assignee: task.assignee,
            data: task,
            children: [],
          };

          // Add subtasks to task
          const taskSubtasks = subtasks.filter((subtask) => subtask.parent_task_id === task.id);
          taskSubtasks.forEach((subtask) => {
            taskNode.children!.push({
              id: subtask.id,
              title: subtask.title,
              type: "subtask",
              status: subtask.status,
              assignee: subtask.assignee,
              data: subtask,
            });
          });

          storyNode.children!.push(taskNode);
        });

        epicNode.children!.push(storyNode);
      });

      tree.push(epicNode);
    });

    // Add orphan tasks (tasks without stories)
    const orphanTasks = tasks.filter((task) => !task.story_id && !task.parent_task_id);
    orphanTasks.forEach((task) => {
      const taskNode: TreeNodeData = {
        id: task.id,
        title: task.title,
        type: "task",
        status: task.status,
        assignee: task.assignee,
        data: task,
        children: [],
      };

      // Add subtasks
      const taskSubtasks = subtasks.filter((subtask) => subtask.parent_task_id === task.id);
      taskSubtasks.forEach((subtask) => {
        taskNode.children!.push({
          id: subtask.id,
          title: subtask.title,
          type: "subtask",
          status: subtask.status,
          assignee: subtask.assignee,
          data: subtask,
        });
      });

      tree.push(taskNode);
    });

    return tree;
  }, [epics, stories, tasks, subtasks]);

  // Filter tree based on search and filters
  const filteredTree = useMemo(() => {
    const filterNode = (node: TreeNodeData): TreeNodeData | null => {
      // Check if node matches filters
      let matches = true;

      if (searchQuery) {
        matches = matches && node.title.toLowerCase().includes(searchQuery.toLowerCase());
      }

      if (filterStatus !== "all") {
        matches = matches && node.status === filterStatus;
      }

      if (filterAssignee !== "all") {
        matches = matches && node.assignee === filterAssignee;
      }

      // Filter children recursively
      const filteredChildren = node.children
        ? node.children.map(filterNode).filter(Boolean) as TreeNodeData[]
        : [];

      // Include node if it matches or has matching children
      if (matches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        };
      }

      return null;
    };

    return treeData.map(filterNode).filter(Boolean) as TreeNodeData[];
  }, [treeData, searchQuery, filterStatus, filterAssignee]);

  const handleToggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleNodeClick = (node: TreeNodeData) => {
    switch (node.type) {
      case "epic":
        if (onEpicClick) onEpicClick(node.data as Epic);
        break;
      case "story":
        if (onStoryClick) onStoryClick(node.data as Story);
        break;
      case "task":
      case "subtask":
        if (onTaskClick) onTaskClick(node.data as Task);
        break;
    }
  };

  const handleExpandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: TreeNodeData[]) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          allIds.add(node.id);
          collectIds(node.children);
        }
      });
    };
    collectIds(filteredTree);
    setExpanded(allIds);
  };

  const handleCollapseAll = () => {
    setExpanded(new Set());
  };

  // Get unique assignees for filter
  const assignees = useMemo(() => {
    const set = new Set<string>();
    [...tasks, ...subtasks].forEach((task) => {
      if (task.assignee) set.add(task.assignee);
    });
    return Array.from(set);
  }, [tasks, subtasks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div
        className={cn(
          "p-4 rounded-xl",
          glassmorphism.background.subtle,
          glassmorphism.border.default,
          glassmorphism.shadow.medium
        )}
      >
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm flex-1 min-w-[200px]",
              "bg-white/50 dark:bg-gray-800/50",
              "border border-gray-300/30 dark:border-gray-700/30",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            )}
          />

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              "bg-white/50 dark:bg-gray-800/50",
              "border border-gray-300/30 dark:border-gray-700/30",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            )}
          >
            <option value="all">All Status</option>
            <option value="todo">Todo</option>
            <option value="doing">Doing</option>
            <option value="review">Review</option>
            <option value="waiting">Waiting</option>
            <option value="done">Done</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              "bg-white/50 dark:bg-gray-800/50",
              "border border-gray-300/30 dark:border-gray-700/30",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            )}
          >
            <option value="all">All Assignees</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>

          {/* Expand/Collapse All */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleExpandAll}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm",
                "bg-blue-500/20 text-blue-600 dark:text-blue-400",
                "hover:bg-blue-500/30 transition-colors"
              )}
            >
              Expand All
            </button>
            <button
              onClick={handleCollapseAll}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm",
                "bg-gray-500/20 text-gray-600 dark:text-gray-400",
                "hover:bg-gray-500/30 transition-colors"
              )}
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Tree Container */}
      <div
        className={cn(
          "p-4 rounded-xl overflow-auto",
          glassmorphism.background.subtle,
          glassmorphism.border.default,
          glassmorphism.shadow.medium
        )}
      >
        {filteredTree.length > 0 ? (
          <div className="space-y-1">
            {filteredTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                level={0}
                expanded={expanded}
                onToggleExpand={handleToggleExpand}
                onNodeClick={handleNodeClick}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            No items found matching your filters
          </div>
        )}
      </div>
    </div>
  );
};