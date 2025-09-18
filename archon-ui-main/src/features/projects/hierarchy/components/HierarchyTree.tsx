import type { HierarchyTreeNode } from "../../services/hierarchyService";
import type { FilterVisibilityMode } from "../hooks/useHierarchyFilters";
import { HierarchyNode } from "./HierarchyNode";

interface HierarchyTreeProps {
  nodes: HierarchyTreeNode[];
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  onSelect: (node: HierarchyTreeNode) => void;
  selectedNodeId?: string;
  matchingNodeIds: Set<string>;
  descendantMatches: Map<string, boolean>;
  visibilityMode: FilterVisibilityMode;
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

    const currentNode = (
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
}) => {
  if (!nodes.length) {
    return <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">No hierarchy data available.</div>;
  }

  return (
    <div role="tree" aria-multiselectable={false} className="space-y-1">
      {renderTree(nodes, { expandedNodes, onToggle, onSelect, selectedNodeId, matchingNodeIds, descendantMatches, visibilityMode })}
    </div>
  );
};
