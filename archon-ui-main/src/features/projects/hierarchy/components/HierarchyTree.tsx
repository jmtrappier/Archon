import type { HierarchyTreeNode } from "../../services/hierarchyService";
import type { FilterVisibilityMode } from "../hooks/useHierarchyFilters";
import { HierarchyNode } from "./HierarchyNode";
import { TreeNodeDraggable } from "./TreeNodeDraggable";
import { useTreeDragDrop } from "../hooks/useTreeDragDrop";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

interface HierarchyTreeProps {
  nodes: HierarchyTreeNode[];
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  onSelect: (node: HierarchyTreeNode) => void;
  selectedNodeId?: string;
  matchingNodeIds: Set<string>;
  descendantMatches: Map<string, boolean>;
  visibilityMode: FilterVisibilityMode;
  projectId: string;
  enableDragDrop?: boolean;
}

const hasMatch = (node: HierarchyTreeNode, matchingNodeIds: Set<string>, descendantMatches: Map<string, boolean>): boolean =>
  matchingNodeIds.has(node.nodeId) || descendantMatches.get(node.nodeId) === true;

const canRenderNode = (
  node: HierarchyTreeNode,
  visibilityMode: FilterVisibilityMode,
  matchingNodeIds: Set<string>,
  descendantMatches: Map<string, boolean>,
): boolean => {
  if (node.type === "project") {
    return true;
  }

  if (visibilityMode === "hide") {
    return hasMatch(node, matchingNodeIds, descendantMatches);
  }

  return true;
};

const renderTree = (
  nodes: HierarchyTreeNode[],
  props: {
    expandedNodes: Set<string>;
    onToggle: (nodeId: string) => void;
    onSelect: (node: HierarchyTreeNode) => void;
    selectedNodeId?: string;
    matchingNodeIds: Set<string>;
    descendantMatches: Map<string, boolean>;
    visibilityMode: FilterVisibilityMode;
    enableDragDrop?: boolean;
    onMove?: (source: any, target: any) => Promise<void>;
    onReorder?: (nodeId: string, nodeType: string, newOrder: number) => Promise<void>;
    canDrop?: (source: any, target: any) => boolean;
  },
  depth = 0,
): JSX.Element[] => {
  return nodes.flatMap((node) => {
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isExpanded = node.type === "project" || props.expandedNodes.has(node.nodeId);
    const shouldRender = canRenderNode(node, props.visibilityMode, props.matchingNodeIds, props.descendantMatches);

    if (!shouldRender) {
      return [];
    }

    const isDimmed = !props.matchingNodeIds.has(node.nodeId) && props.visibilityMode === "dim";

    const nodeElement = (
      <HierarchyNode
        key={node.nodeId}
        node={node}
        depth={depth}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggle={() => props.onToggle(node.nodeId)}
        onSelect={() => props.onSelect(node)}
        isSelected={props.selectedNodeId === node.nodeId}
        visibilityMode={props.visibilityMode}
        isDimmed={isDimmed}
      />
    );

    const currentNode = props.enableDragDrop ? (
      <TreeNodeDraggable
        key={node.nodeId}
        node={node}
        onMove={props.onMove}
        onReorder={(nodeId, newOrder) => props.onReorder?.(nodeId, node.type, newOrder)}
        canDrop={props.canDrop}
        isDraggingEnabled={props.enableDragDrop}
      >
        {nodeElement}
      </TreeNodeDraggable>
    ) : (
      nodeElement
    );

    if (!hasChildren || !isExpanded) {
      return [currentNode];
    }

    return [
      currentNode,
      ...renderTree(node.children, props, depth + 1),
    ];
  });
};

export const HierarchyTree: React.FC<HierarchyTreeProps> = ({
  nodes,
  expandedNodes,
  onToggle,
  onSelect,
  selectedNodeId,
  matchingNodeIds,
  descendantMatches,
  visibilityMode,
  projectId,
  enableDragDrop = false,
}) => {
  const { handleMove, handleReorder, canDrop } = useTreeDragDrop(projectId);

  if (!nodes.length) {
    return <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">No hierarchy data available.</div>;
  }

  const treeContent = (
    <div role="tree" aria-multiselectable={false} className="space-y-1 tree-scrollbar overflow-auto max-h-[calc(100vh-16rem)]">
      {renderTree(nodes, {
        expandedNodes,
        onToggle,
        onSelect,
        selectedNodeId,
        matchingNodeIds,
        descendantMatches,
        visibilityMode,
        enableDragDrop,
        onMove: handleMove,
        onReorder: handleReorder,
        canDrop,
      })}
    </div>
  );

  if (enableDragDrop) {
    return (
      <DndProvider backend={HTML5Backend}>
        {treeContent}
      </DndProvider>
    );
  }

  return treeContent;
};
