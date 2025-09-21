import { useCallback, useEffect, useMemo, useState } from "react";
import type { Epic, Story, Task } from "../../shared/types";
import type { HierarchyTreeNode } from "../../services/hierarchyService";
import { HierarchyDetailsPanel, HierarchyFilterBar, HierarchyTree } from "../../hierarchy/components";
import { useHierarchyData, type HierarchyFiltersMetadata } from "../../hierarchy/hooks/useHierarchyData";
import { useHierarchyFilters } from "../../hierarchy/hooks/useHierarchyFilters";
import type { HierarchyViewMode } from "../../hierarchy/hooks/useHierarchyData";
import type { FilterVisibilityMode } from "../../hierarchy/hooks/useHierarchyFilters";

interface TreeViewProps {
  projectId: string;
  onEpicClick?: (epic: Epic) => void;
  onStoryClick?: (story: Story) => void;
  onTaskClick?: (task: Task) => void;
}

const LOCAL_STORAGE_KEY = (projectId: string) => `hierarchy-expanded-${projectId}`;

const buildDescendantMap = (nodes: HierarchyTreeNode[], matchingIds: Set<string>): Map<string, boolean> => {
  const map = new Map<string, boolean>();

  const visit = (node: HierarchyTreeNode): boolean => {
    const childMatch = node.children?.some((child) => visit(child)) ?? false;
    const isSelfMatch = matchingIds.has(node.nodeId);
    const result = isSelfMatch || childMatch;
    map.set(node.nodeId, result);
    return result;
  };

  nodes.forEach((node) => visit(node));

  return map;
};

export const TreeView: React.FC<TreeViewProps> = ({ projectId, onEpicClick, onStoryClick, onTaskClick }) => {
  const [filtersMetadata, setFiltersMetadata] = useState<HierarchyFiltersMetadata | undefined>(undefined);
  const filterHelpers = useHierarchyFilters(filtersMetadata);
  const { filters: filterState } = filterHelpers;

  const { tree, flatNodes, metadata, isLoading, isError, error } = useHierarchyData({
    projectId,
    includeArchived: filterState.includeArchived,
    includeTasks: true, // Explicitly include tasks and subtasks
  });

  useEffect(() => {
    if (metadata) {
      setFiltersMetadata(metadata);
    }
  }, [metadata]);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY(projectId));
    if (!stored) {
      return new Set<string>();
    }
    try {
      return new Set<string>(JSON.parse(stored));
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY(projectId), JSON.stringify(Array.from(expandedNodes)));
  }, [expandedNodes, projectId]);

  useEffect(() => {
    // Ensure project root is expanded by default
    if (tree[0] && !expandedNodes.has(tree[0].nodeId)) {
      setExpandedNodes((prev) => {
        if (prev.has(tree[0].nodeId)) return prev;
        return new Set([...prev, tree[0].nodeId]);
      });
    }
  }, [tree, expandedNodes]);

  const [selectedNode, setSelectedNode] = useState<HierarchyTreeNode | undefined>();

  useEffect(() => {
    if (!selectedNode && tree[0]) {
      const firstNonProject = tree[0].children?.[0] ?? tree[0];
      setSelectedNode(firstNonProject);
    }
  }, [tree, selectedNode]);

  useEffect(() => {
    if (selectedNode) {
      const exists = flatNodes.find((node) => node.nodeId === selectedNode.nodeId);
      if (!exists && tree[0]) {
        const fallback = tree[0].children?.[0] ?? tree[0];
        setSelectedNode(fallback);
      }
    }
  }, [selectedNode, flatNodes, tree]);

  const filteredNodes = useMemo(() => filterHelpers.applyFilters(flatNodes), [filterHelpers, flatNodes]);
  const matchingIds = useMemo(() => new Set(filteredNodes.map((node) => node.nodeId)), [filteredNodes]);
  const descendantMatches = useMemo(() => buildDescendantMap(tree, matchingIds), [tree, matchingIds]);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set([...prev]);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleSelectNode = useCallback(
    (node: HierarchyTreeNode) => {
      setSelectedNode(node);
    },
    [],
  );

  const handleOpenDetails = useCallback(
    (node: HierarchyTreeNode) => {
      console.log("🌳 TreeView.handleOpenDetails called", {
        nodeType: node.type,
        nodeId: node.id,
        nodeTitle: node.title,
        nodeStatus: node.status,
        nodePriority: node.priority,
        nodeAssignee: node.assignee
      });

      const raw = node.raw;
      if (node.type === "epic" && onEpicClick) {
        console.log("🌳 TreeView calling onEpicClick", { epic: raw });
        onEpicClick(raw as Epic);
      } else if (node.type === "story" && onStoryClick) {
        console.log("🌳 TreeView calling onStoryClick", { story: raw });
        onStoryClick(raw as Story);
      } else if ((node.type === "task" || node.type === "subtask") && onTaskClick) {
        console.log("🌳 TreeView calling onTaskClick", { task: raw });
        onTaskClick(raw as Task);
      }
    },
    [onEpicClick, onStoryClick, onTaskClick],
  );

  const handleOpenKanban = useCallback(
    (node: HierarchyTreeNode) => {
      if (node.type === "epic" && onEpicClick) {
        onEpicClick(node.raw as Epic);
      } else if (node.type === "story" && onStoryClick) {
        onStoryClick(node.raw as Story);
      } else if ((node.type === "task" || node.type === "subtask") && onTaskClick) {
        onTaskClick(node.raw as Task);
      }
    },
    [onEpicClick, onStoryClick, onTaskClick],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 p-10 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Loading hierarchy…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
        Failed to load hierarchy: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  const visibilityMode: FilterVisibilityMode = filterState.visibilityMode;
  const viewMode: HierarchyViewMode = filterState.viewMode;

  return (
    <div className="flex flex-col gap-4 lg:pr-96">
      <div className="space-y-4">
        <HierarchyFilterBar metadata={metadata} filterHelpers={filterHelpers} />
        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/60">
          <HierarchyTree
            nodes={tree}
            expandedNodes={expandedNodes}
            onToggle={toggleNode}
            onSelect={handleSelectNode}
            selectedNodeId={selectedNode?.nodeId}
            matchingNodeIds={matchingIds}
            descendantMatches={descendantMatches}
            visibilityMode={visibilityMode}
            projectId={projectId}
            enableDragDrop={true}
          />
        </div>
      </div>

      <div className="lg:fixed lg:top-4 lg:right-4 lg:w-80 lg:h-[calc(100vh-2rem)] lg:overflow-hidden">
        <HierarchyDetailsPanel
          node={selectedNode}
          projectId={projectId}
          viewMode={viewMode}
          onOpenDetails={handleOpenDetails}
          onOpenKanban={handleOpenKanban}
        />
      </div>
    </div>
  );
};
