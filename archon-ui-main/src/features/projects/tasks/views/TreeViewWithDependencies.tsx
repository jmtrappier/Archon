/**
 * TreeViewWithDependencies - Enhanced TreeView with dependency visualization
 *
 * Extends the base TreeView with dependency badges, filters, and side panel.
 * Implements STORY 4.22 - Visualisation des Dépendances.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useHierarchyData, HierarchyViewMode } from '../../hierarchy/hooks/useHierarchyData';
import { useHierarchyFilters, FilterVisibilityMode } from '../../hierarchy/hooks/useHierarchyFilters';
import { HierarchyTree, HierarchyFilterBar } from '../../hierarchy/components';
// import { DependencyEditorModal } from '../../dependencies/components/DependencyEditorModal';
import type { Epic, Story, Task } from '../../shared/types';
import type { HierarchyTreeNode, HierarchyFiltersMetadata } from '../../services/hierarchyService';
import type { DependencyEntityType } from '../../dependencies/types/dependency';

export interface TreeViewWithDependenciesProps {
  projectId: string;
  onEpicClick?: (epic: Epic) => void;
  onStoryClick?: (story: Story) => void;
  onTaskClick?: (task: Task) => void;
  className?: string;
}

const LOCAL_STORAGE_KEY = (projectId: string) => `treeview-expanded-${projectId}`;

function buildDescendantMap(nodes: HierarchyTreeNode[], matchingIds: Set<string>): Map<string, boolean> {
  const descendantMap = new Map<string, boolean>();

  function checkDescendants(node: HierarchyTreeNode): boolean {
    if (matchingIds.has(node.nodeId)) {
      descendantMap.set(node.nodeId, true);
      return true;
    }

    let hasMatchingDescendant = false;
    if (node.children) {
      for (const child of node.children) {
        if (checkDescendants(child)) {
          hasMatchingDescendant = true;
        }
      }
    }

    descendantMap.set(node.nodeId, hasMatchingDescendant);
    return hasMatchingDescendant;
  }

  nodes.forEach(checkDescendants);
  return descendantMap;
}

export function TreeViewWithDependencies({
  projectId,
  onEpicClick,
  onStoryClick,
  onTaskClick,
  className
}: TreeViewWithDependenciesProps) {
  // Base hierarchy data
  const [filtersMetadata, setFiltersMetadata] = useState<HierarchyFiltersMetadata | undefined>(undefined);
  const filterHelpers = useHierarchyFilters(filtersMetadata);
  const { filters: filterState } = filterHelpers;

  const { tree, flatNodes, metadata, isLoading, isError, error } = useHierarchyData({
    projectId,
    includeArchived: filterState.includeArchived,
    includeTasks: true,
  });

  useEffect(() => {
    if (metadata) {
      setFiltersMetadata(metadata);
    }
  }, [metadata]);

  // Apply filtering
  const filteredNodes = useMemo(() => filterHelpers.applyFilters(flatNodes), [filterHelpers, flatNodes]);
  const matchingIds = useMemo(() => new Set(filteredNodes.map((node) => node.nodeId)), [filteredNodes]);
  const descendantMatches = useMemo(() => buildDescendantMap(tree, matchingIds), [tree, matchingIds]);

  // Tree state
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

  // Selection state
  const [selectedNode, setSelectedNode] = useState<HierarchyTreeNode | undefined>();

  // Dependency modal state
  const [dependencyModalOpen, setDependencyModalOpen] = useState(false);
  const [dependencySourceNode, setDependencySourceNode] = useState<HierarchyTreeNode | undefined>();
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedRelationType, setSelectedRelationType] = useState<string>('depends_on');
  const [dependencyDescription, setDependencyDescription] = useState<string>('');
  const [dependencies, setDependencies] = useState<Array<{
    id: string;
    from_type: string;
    from_id: string;
    to_type: string;
    to_id: string;
    dependency_type: string;
    description?: string;
    target_title: string;
  }>>([]);

  useEffect(() => {
    if (!selectedNode && tree[0]) {
      const firstNonProject = tree[0].children?.[0] ?? tree[0];
      setSelectedNode(firstNonProject);
    }
  }, [tree, selectedNode]);

  useEffect(() => {
    if (selectedNode) {
      const exists = filteredNodes.find((node) => node.nodeId === selectedNode.nodeId);
      if (!exists && tree[0]) {
        const fallback = tree[0].children?.[0] ?? tree[0];
        setSelectedNode(fallback);
      }
    }
  }, [selectedNode, filteredNodes, tree]);

  // Event handlers
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

  const handleSelectNode = useCallback((node: HierarchyTreeNode) => {
    setSelectedNode(node);
  }, []);

  // Dependency handlers
  const handleOpenDependencyModal = useCallback((fromNode: HierarchyTreeNode) => {
    setDependencySourceNode(fromNode);
    setDependencyModalOpen(true);
  }, []);

  const handleNavigateToNode = useCallback((entityType: DependencyEntityType, entityId: string) => {
    // Find the node in the tree and select it
    const findNodeById = (nodes: HierarchyTreeNode[], id: string): HierarchyTreeNode | undefined => {
      for (const node of nodes) {
        if (node.id === id && node.type === entityType) {
          return node;
        }
        if (node.children) {
          const found = findNodeById(node.children, id);
          if (found) return found;
        }
      }
      return undefined;
    };

    const targetNode = findNodeById(tree, entityId);
    if (targetNode) {
      setSelectedNode(targetNode);
    }
  }, [tree]);

  const handleCloseDependencyModal = useCallback(() => {
    setDependencyModalOpen(false);
    setDependencySourceNode(undefined);
    setSelectedTarget('');
    setSelectedRelationType('depends_on');
    setDependencyDescription('');
  }, []);

  const handleCreateDependency = useCallback(async () => {
    if (!dependencySourceNode || !selectedTarget) return;

    const targetNode = flatNodes.find(node => node.id === selectedTarget);
    if (!targetNode) return;

    // Créer une nouvelle dépendance (simulation - en prod, ceci ferait un appel API)
    const newDependency = {
      id: `dep-${Date.now()}`,
      from_type: dependencySourceNode.type,
      from_id: dependencySourceNode.id,
      to_type: targetNode.type,
      to_id: targetNode.id,
      dependency_type: selectedRelationType,
      description: dependencyDescription || undefined,
      target_title: targetNode.title
    };

    setDependencies(prev => [...prev, newDependency]);
    handleCloseDependencyModal();
  }, [dependencySourceNode, selectedTarget, selectedRelationType, dependencyDescription, flatNodes, handleCloseDependencyModal]);




  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 p-10 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Loading hierarchy…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-red-200 p-10 text-sm text-red-500 dark:border-red-800 dark:text-red-400">
        Error loading hierarchy: {error?.message}
      </div>
    );
  }

  const visibilityMode: FilterVisibilityMode = filterState.visibilityMode;

  return (
    <div className={cn("flex flex-col lg:flex-row gap-6", className)}>
      {/* Main content area with TreeView */}
      <div className="flex-1 min-w-0 space-y-4">
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

      {/* Sidebar with sticky positioning */}
      <div className="lg:w-80 xl:w-96 flex-shrink-0">
        <div className="sticky top-6">
          <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/60">
            {selectedNode ? (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {selectedNode.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded dark:bg-blue-900 dark:text-blue-200">
                      {selectedNode.type}
                    </span>
                    {selectedNode.status && (
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded dark:bg-gray-800 dark:text-gray-200">
                        {selectedNode.status}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                    Description
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {selectedNode.description || 'Aucune description disponible'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                      Dependencies
                    </h4>
                    <button
                      onClick={() => handleOpenDependencyModal(selectedNode)}
                      className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {/* Incoming Dependencies */}
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      → Incoming ({dependencies.filter(dep => dep.to_id === selectedNode?.id).length})
                    </div>
                    {dependencies.filter(dep => dep.to_id === selectedNode?.id).length === 0 ? (
                      <div className="text-xs text-slate-400 italic">
                        No incoming dependencies
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {dependencies.filter(dep => dep.to_id === selectedNode?.id).map(dep => (
                          <div key={dep.id} className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded">
                            <div className="font-medium">{dep.dependency_type}</div>
                            <div className="text-slate-600 dark:text-slate-400">
                              from {dep.from_type}: {flatNodes.find(n => n.id === dep.from_id)?.title || 'Unknown'}
                            </div>
                            {dep.description && (
                              <div className="text-slate-500 text-xs mt-1">{dep.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Outgoing Dependencies */}
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                      ← Outgoing ({dependencies.filter(dep => dep.from_id === selectedNode?.id).length})
                    </div>
                    {dependencies.filter(dep => dep.from_id === selectedNode?.id).length === 0 ? (
                      <div className="text-xs text-slate-400 italic">
                        No outgoing dependencies
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {dependencies.filter(dep => dep.from_id === selectedNode?.id).map(dep => (
                          <div key={dep.id} className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded">
                            <div className="font-medium">{dep.dependency_type}</div>
                            <div className="text-slate-600 dark:text-slate-400">
                              to {dep.to_type}: {dep.target_title}
                            </div>
                            {dep.description && (
                              <div className="text-slate-500 text-xs mt-1">{dep.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <button className="w-full text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300">
                    Voir les détails
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                Sélectionnez un élément dans l'arbre
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dependency Editor Modal */}
      {dependencyModalOpen && dependencySourceNode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Dependency</h3>
              <button
                onClick={handleCloseDependencyModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Create a dependency relationship from{' '}
                <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded dark:bg-blue-900 dark:text-blue-200">
                  {dependencySourceNode.type}
                </span>{' '}
                <span className="font-medium">{dependencySourceNode.title}</span>
              </p>
            </div>

            <div className="space-y-4">
              {/* Target Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Target
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                >
                  <option value="">Select target...</option>
                  {flatNodes
                    .filter(node =>
                      node.nodeId !== dependencySourceNode.nodeId &&
                      node.type !== 'project' &&
                      ['epic', 'story', 'task'].includes(node.type)
                    )
                    .map(node => (
                      <option key={node.nodeId} value={node.id}>
                        [{node.type}] {node.title}
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Dependency Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Relationship Type
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                  value={selectedRelationType}
                  onChange={(e) => setSelectedRelationType(e.target.value)}
                >
                  <option value="depends_on">Depends on - This item cannot start until the target is completed</option>
                  <option value="blocks">Blocks - This item prevents the target from progressing</option>
                  <option value="related_to">Related to - This item is related to the target but not blocking</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Add additional context about this dependency..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 min-h-[80px]"
                  value={dependencyDescription}
                  onChange={(e) => setDependencyDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={handleCloseDependencyModal}
                className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDependency}
                disabled={!selectedTarget}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Create Dependency
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TreeViewWithDependencies;