import { useState, useCallback } from "react";
import { useDrag, useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import type { HierarchyTreeNode } from "../../services/hierarchyService";
import { useToast } from "@/features/ui/hooks/useToast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/ui/primitives/alert-dialog";

export const TreeNodeItemTypes = {
  PROJECT: "project",
  EPIC: "epic",
  STORY: "story",
  TASK: "task",
  SUBTASK: "subtask",
} as const;

interface DraggedTreeNode {
  nodeId: string;
  type: keyof typeof TreeNodeItemTypes;
  parentId?: string;
  projectId?: string;
  epicId?: string;
  storyId?: string;
  taskId?: string;
  title: string;
  order?: number;
  raw?: Record<string, unknown>;
}

interface TreeNodeDraggableProps {
  node: HierarchyTreeNode;
  children: React.ReactNode;
  onMove?: (sourceNode: DraggedTreeNode, targetNode: DraggedTreeNode) => Promise<void>;
  onReorder?: (nodeId: string, newOrder: number) => Promise<void>;
  canDrop?: (source: DraggedTreeNode, target: DraggedTreeNode) => boolean;
  isDraggingEnabled?: boolean;
}

const defaultCanDrop = (source: DraggedTreeNode, target: DraggedTreeNode): boolean => {
  // Projects cannot be moved
  if (source.type === "project" || target.type === "project") {
    return false;
  }

  // Same level reordering
  if (source.type === target.type && source.parentId === target.parentId) {
    return true;
  }

  // Story → Epic
  if (source.type === "story" && target.type === "epic") {
    return true;
  }

  // Task → Story
  if (source.type === "task" && target.type === "story") {
    return true;
  }

  // Subtask → Task
  if (source.type === "subtask" && target.type === "task") {
    return true;
  }

  // Task → Task (for subtask conversion)
  if (source.type === "task" && target.type === "task" && source.nodeId !== target.nodeId) {
    return true;
  }

  return false;
};

export const TreeNodeDraggable: React.FC<TreeNodeDraggableProps> = ({
  node,
  children,
  onMove,
  onReorder,
  canDrop = defaultCanDrop,
  isDraggingEnabled = true,
}) => {
  const { showToast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    source?: DraggedTreeNode;
    target?: DraggedTreeNode;
    message?: string;
  }>({ isOpen: false });

  const draggedItem: DraggedTreeNode = {
    nodeId: node.nodeId,
    type: node.type as keyof typeof TreeNodeItemTypes,
    parentId: node.parentId || undefined,
    title: node.title,
    order: undefined, // Will be determined by position in parent's children array
    raw: node.raw, // Include raw data for UUID access
  };

  // Add hierarchy context based on raw data
  const rawData = node.raw as any;
  if (node.type === "epic") {
    draggedItem.projectId = rawData.project_id;
  } else if (node.type === "story") {
    draggedItem.epicId = rawData.epic_id;
  } else if (node.type === "task") {
    draggedItem.storyId = rawData.story_id;
  } else if (node.type === "subtask") {
    draggedItem.taskId = rawData.parent_task_id;
  }

  const [{ isDragging }, dragRef] = useDrag({
    type: `TREE_NODE_${node.type.toUpperCase()}`,
    item: draggedItem,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: isDraggingEnabled && node.type !== "project",
  });

  const [{ isOver, canDropHere }, dropRef] = useDrop({
    accept: Object.values(TreeNodeItemTypes).map((type) => `TREE_NODE_${type.toUpperCase()}`),
    drop: async (item: DraggedTreeNode, monitor) => {
      if (monitor.didDrop()) return;

      const target: DraggedTreeNode = {
        nodeId: node.nodeId,
        type: node.type as keyof typeof TreeNodeItemTypes,
        parentId: node.parentId || undefined,
        title: node.title,
        order: undefined,
        raw: node.raw, // Include raw data for UUID access
      };

      // Check if it's a valid drop
      if (!canDrop(item, target)) {
        showToast(`Cannot move ${item.type} to ${target.type}`, "error");
        return;
      }

      // Same parent reordering
      if (item.parentId === target.parentId && item.type === target.type) {
        if (onReorder && target.order !== undefined) {
          try {
            await onReorder(item.nodeId, target.order);
            showToast(`${item.title} position updated`, "success");
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Unknown error", "error");
          }
        }
        return;
      }

      // Different parent - needs confirmation
      const getConfirmMessage = () => {
        if (item.type === "story" && target.type === "epic") {
          return `Move story "${item.title}" to epic "${target.title}"?`;
        }
        if (item.type === "task" && target.type === "story") {
          return `Move task "${item.title}" to story "${target.title}"?`;
        }
        if (item.type === "task" && target.type === "task") {
          return `Convert task "${item.title}" to subtask of "${target.title}"?`;
        }
        if (item.type === "subtask" && target.type === "task") {
          return `Move subtask "${item.title}" to task "${target.title}"?`;
        }
        return `Move ${item.type} "${item.title}" to ${target.type} "${target.title}"?`;
      };

      setConfirmDialog({
        isOpen: true,
        source: item,
        target,
        message: getConfirmMessage(),
      });
    },
    canDrop: (item: DraggedTreeNode) => canDrop(item, draggedItem),
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDropHere: monitor.canDrop(),
    }),
  });

  const handleConfirmMove = useCallback(async () => {
    const { source, target } = confirmDialog;
    if (!source || !target || !onMove) {
      setConfirmDialog({ isOpen: false });
      return;
    }

    try {
      await onMove(source, target);
      showToast(`${source.title} moved successfully`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unknown error", "error");
    } finally {
      setConfirmDialog({ isOpen: false });
    }
  }, [confirmDialog, onMove, showToast]);

  const combinedRef = (el: HTMLDivElement | null) => {
    dragRef(el);
    dropRef(el);
  };

  return (
    <>
      <div
        ref={combinedRef}
        className={cn(
          "relative transition-all duration-200",
          isDragging && "opacity-50",
          isOver && canDropHere && "ring-2 ring-blue-500 ring-offset-2",
          isOver && !canDropHere && "ring-2 ring-red-500 ring-offset-2"
        )}
      >
        {children}
        {isOver && canDropHere && (
          <div className="absolute inset-0 pointer-events-none bg-blue-500/10 rounded-lg" />
        )}
      </div>

      <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog({ isOpen: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Move</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMove}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};