/**
 * Dependency Graph Hook
 *
 * Custom hook for managing dependency graph state, layout, and interactions
 * Provides high-level graph manipulation and visualization logic
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  GraphLayout,
  GraphFilter,
  GraphInteraction,
  GraphPerformanceOptions,
  GraphQueryParams,
  DependencyEntityType,
} from "../types";
import { useDependencyGraph, useRealtimeDependencyGraph } from "./useDependencyQueries";
import {
  calculateLayout,
  calculateEdgePath,
  calculateLabelPosition,
  filterGraph,
  calculateGraphMetrics,
  getDependencyTypeColor,
  getEntityTypeColor,
  getHierarchyStatusColor,
  getPriorityColor,
} from "../utils";
import type { HierarchyStatus, Priority } from "../../shared/types/hierarchy";

// Default graph configuration
const DEFAULT_LAYOUT: GraphLayout = {
  algorithm: "force",
  options: {
    nodeSpacing: 100,
    centerForce: 0.05,
    repelForce: 100,
    linkDistance: 120,
    iterations: 300,
  },
};

const DEFAULT_PERFORMANCE: GraphPerformanceOptions = {
  maxNodes: 200,
  maxEdges: 500,
  virtualizeNodes: true,
  useWebGL: false,
  debounceLayout: 300,
};

const DEFAULT_FILTER: GraphFilter = {
  entityTypes: new Set(["epic", "story", "task"]),
  dependencyTypes: new Set(["blocks", "depends_on", "related_to"]),
  statuses: new Set(["todo", "doing", "review", "waiting", "done"]),
  priorities: new Set(["low", "medium", "high", "critical"]),
  showOnlyConnected: false,
};

interface UseDependencyGraphOptions {
  width: number;
  height: number;
  layout?: GraphLayout;
  filter?: Partial<GraphFilter>;
  performance?: Partial<GraphPerformanceOptions>;
  realtime?: boolean;
  realtimeInterval?: number;
  autoLayout?: boolean;
  enableInteractions?: boolean;
}

export function useDependencyGraph(
  params: GraphQueryParams,
  options: UseDependencyGraphOptions
) {
  // State for graph visualization
  const [layoutedNodes, setLayoutedNodes] = useState<DependencyNode[]>([]);
  const [processedEdges, setProcessedEdges] = useState<DependencyEdge[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Merge options with defaults
  const layout = useMemo(() => ({ ...DEFAULT_LAYOUT, ...options.layout }), [options.layout]);
  const filter = useMemo(() => ({ ...DEFAULT_FILTER, ...options.filter }), [options.filter]);
  const performance = useMemo(() => ({ ...DEFAULT_PERFORMANCE, ...options.performance }), [options.performance]);

  // Query for graph data
  const graphQuery = options.realtime
    ? useRealtimeDependencyGraph(params, {
        refetchInterval: options.realtimeInterval,
        enabled: true,
      })
    : useDependencyGraph(params, { enabled: true });

  // Memoized filtered graph data
  const { filteredNodes, filteredEdges } = useMemo(() => {
    if (!graphQuery.data) {
      return { filteredNodes: [], filteredEdges: [] };
    }

    const { nodes, edges } = filterGraph(
      graphQuery.data.nodes,
      graphQuery.data.edges,
      filter
    );

    // Apply performance limits
    const limitedNodes = nodes.slice(0, performance.maxNodes);
    const limitedEdges = edges
      .filter(edge =>
        limitedNodes.some(n => n.id === edge.source) &&
        limitedNodes.some(n => n.id === edge.target)
      )
      .slice(0, performance.maxEdges);

    return {
      filteredNodes: limitedNodes,
      filteredEdges: limitedEdges,
    };
  }, [graphQuery.data, filter, performance]);

  // Layout calculation with debouncing
  useEffect(() => {
    if (!options.autoLayout || filteredNodes.length === 0) return;

    setIsLayouting(true);

    const timeoutId = setTimeout(() => {
      const layoutedNodesResult = calculateLayout(
        filteredNodes,
        filteredEdges,
        options.width,
        options.height,
        layout
      );

      setLayoutedNodes(layoutedNodesResult);
      setIsLayouting(false);
    }, performance.debounceLayout);

    return () => clearTimeout(timeoutId);
  }, [filteredNodes, filteredEdges, options.width, options.height, layout, options.autoLayout, performance.debounceLayout]);

  // Process edges with paths and styling
  const processedEdgesWithPaths = useMemo(() => {
    return filteredEdges.map(edge => {
      const sourceNode = layoutedNodes.find(n => n.id === edge.source);
      const targetNode = layoutedNodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) {
        return edge;
      }

      const path = calculateEdgePath(sourceNode, targetNode, true);
      const labelPosition = calculateLabelPosition(sourceNode, targetNode);
      const color = getDependencyTypeColor(edge.type);

      return {
        ...edge,
        path,
        labelPosition,
        color,
        isHighlighted: edge.id === hoveredEdgeId,
        isSelected: edge.id === selectedEdgeId,
        width: edge.id === hoveredEdgeId ? 3 : edge.id === selectedEdgeId ? 2.5 : 2,
      };
    });
  }, [filteredEdges, layoutedNodes, hoveredEdgeId, selectedEdgeId]);

  // Process nodes with styling
  const processedNodesWithStyles = useMemo(() => {
    return layoutedNodes.map(node => {
      const baseColor = getEntityTypeColor(node.type);
      const statusColor = getHierarchyStatusColor(node.status);
      const priorityColor = node.priority ? getPriorityColor(node.priority) : null;

      // Determine node size based on type and connections
      const incomingCount = filteredEdges.filter(e => e.target === node.id).length;
      const outgoingCount = filteredEdges.filter(e => e.source === node.id).length;
      const totalConnections = incomingCount + outgoingCount;

      let size: "sm" | "md" | "lg" = "md";
      if (totalConnections >= 5) size = "lg";
      else if (totalConnections <= 1) size = "sm";

      return {
        ...node,
        color: baseColor,
        size,
        isHighlighted: node.id === hoveredNodeId,
        isSelected: node.id === selectedNodeId,
        incomingCount,
        outgoingCount,
      };
    });
  }, [layoutedNodes, filteredEdges, hoveredNodeId, selectedNodeId]);

  // Update processed edges state
  useEffect(() => {
    setProcessedEdges(processedEdgesWithPaths);
  }, [processedEdgesWithPaths]);

  // Graph metrics
  const metrics = useMemo(() => {
    return calculateGraphMetrics(processedNodesWithStyles, processedEdges);
  }, [processedNodesWithStyles, processedEdges]);

  // Interaction handlers
  const handleNodeClick = useCallback((nodeId: string, event?: MouseEvent) => {
    if (!options.enableInteractions) return;

    setSelectedNodeId(prevId => prevId === nodeId ? null : nodeId);
    setSelectedEdgeId(null);

    // Emit interaction event if handler provided
    const interaction: GraphInteraction = {
      type: "node_click",
      nodeId,
      position: event ? { x: event.clientX, y: event.clientY } : undefined,
    };
  }, [options.enableInteractions]);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    if (!options.enableInteractions) return;
    setHoveredNodeId(nodeId);
  }, [options.enableInteractions]);

  const handleEdgeClick = useCallback((edgeId: string, event?: MouseEvent) => {
    if (!options.enableInteractions) return;

    setSelectedEdgeId(prevId => prevId === edgeId ? null : edgeId);
    setSelectedNodeId(null);

    const interaction: GraphInteraction = {
      type: "edge_click",
      edgeId,
      position: event ? { x: event.clientX, y: event.clientY } : undefined,
    };
  }, [options.enableInteractions]);

  const handleEdgeHover = useCallback((edgeId: string | null) => {
    if (!options.enableInteractions) return;
    setHoveredEdgeId(edgeId);
  }, [options.enableInteractions]);

  const handleCanvasClick = useCallback((event: MouseEvent) => {
    if (!options.enableInteractions) return;

    setSelectedNodeId(null);
    setSelectedEdgeId(null);

    const interaction: GraphInteraction = {
      type: "canvas_click",
      position: { x: event.clientX, y: event.clientY },
    };
  }, [options.enableInteractions]);

  // Node position update (for drag operations)
  const updateNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    setLayoutedNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === nodeId
          ? { ...node, position: { x, y } }
          : node
      )
    );
  }, []);

  // Focus on specific node
  const focusNode = useCallback((nodeId: string, zoom = true) => {
    const node = processedNodesWithStyles.find(n => n.id === nodeId);
    if (!node || !node.position) return;

    setSelectedNodeId(nodeId);
    setHoveredNodeId(nodeId);

    // Could emit focus event for parent component to handle zooming/panning
  }, [processedNodesWithStyles]);

  // Get connected nodes
  const getConnectedNodes = useCallback((nodeId: string): {
    incoming: DependencyNode[];
    outgoing: DependencyNode[];
  } => {
    const incoming = processedEdges
      .filter(e => e.target === nodeId)
      .map(e => processedNodesWithStyles.find(n => n.id === e.source))
      .filter(Boolean) as DependencyNode[];

    const outgoing = processedEdges
      .filter(e => e.source === nodeId)
      .map(e => processedNodesWithStyles.find(n => n.id === e.target))
      .filter(Boolean) as DependencyNode[];

    return { incoming, outgoing };
  }, [processedEdges, processedNodesWithStyles]);

  // Reset layout
  const resetLayout = useCallback(() => {
    if (filteredNodes.length === 0) return;

    setIsLayouting(true);
    const layoutedNodesResult = calculateLayout(
      filteredNodes,
      filteredEdges,
      options.width,
      options.height,
      layout
    );
    setLayoutedNodes(layoutedNodesResult);
    setIsLayouting(false);
  }, [filteredNodes, filteredEdges, options.width, options.height, layout]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setHoveredNodeId(null);
    setHoveredEdgeId(null);
  }, []);

  return {
    // Data
    nodes: processedNodesWithStyles,
    edges: processedEdges,
    metrics,
    isLoading: graphQuery.isLoading || isLayouting,
    error: graphQuery.error,

    // Selection state
    selectedNodeId,
    hoveredNodeId,
    selectedEdgeId,
    hoveredEdgeId,
    isDragging,

    // Interaction handlers
    onNodeClick: handleNodeClick,
    onNodeHover: handleNodeHover,
    onEdgeClick: handleEdgeClick,
    onEdgeHover: handleEdgeHover,
    onCanvasClick: handleCanvasClick,

    // Utility functions
    updateNodePosition,
    focusNode,
    getConnectedNodes,
    resetLayout,
    clearSelection,

    // State setters for drag operations
    setIsDragging,

    // Raw data access
    rawData: graphQuery.data,
    filteredData: { nodes: filteredNodes, edges: filteredEdges },

    // Configuration
    layout,
    filter,
    performance,

    // Query controls
    refetch: graphQuery.refetch,
    isRefetching: graphQuery.isRefetching,
  };
}