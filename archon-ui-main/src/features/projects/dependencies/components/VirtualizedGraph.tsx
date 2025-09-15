/**
 * Virtualized Graph Component
 *
 * Performance-optimized graph rendering for large dependency graphs
 * Uses viewport culling and level-of-detail rendering
 */

import type React from "react";
import { useMemo, useCallback } from "react";
import { DependencyNode } from "./DependencyNode";
import { DependencyEdge } from "./DependencyEdge";
import type {
  DependencyNode as DependencyNodeType,
  DependencyEdge as DependencyEdgeType,
  GraphPerformanceOptions,
} from "../types";

export interface VirtualizedGraphProps {
  nodes: DependencyNodeType[];
  edges: DependencyEdgeType[];
  width: number;
  height: number;
  zoom: number;
  panX: number;
  panY: number;
  performance: GraphPerformanceOptions;

  // Interaction handlers
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onEdgeClick?: (edgeId: string, event: React.MouseEvent) => void;
  onEdgeHover?: (edgeId: string | null) => void;
  onNavigateToEntity?: (entityId: string, entityType: string) => void;
}

export const VirtualizedGraph: React.FC<VirtualizedGraphProps> = ({
  nodes,
  edges,
  width,
  height,
  zoom,
  panX,
  panY,
  performance,
  onNodeClick,
  onNodeHover,
  onEdgeClick,
  onEdgeHover,
  onNavigateToEntity,
}) => {
  // Calculate viewport bounds
  const viewportBounds = useMemo(() => {
    const margin = 100; // Extra margin for smooth scrolling

    return {
      left: -panX / zoom - margin,
      right: (-panX + width) / zoom + margin,
      top: -panY / zoom - margin,
      bottom: (-panY + height) / zoom + margin,
    };
  }, [panX, panY, zoom, width, height]);

  // Cull nodes outside viewport
  const visibleNodes = useMemo(() => {
    if (!performance.virtualizeNodes) return nodes;

    return nodes.filter(node => {
      if (!node.position) return true; // Always render nodes without position

      const { x, y } = node.position;
      return x >= viewportBounds.left &&
             x <= viewportBounds.right &&
             y >= viewportBounds.top &&
             y <= viewportBounds.bottom;
    });
  }, [nodes, viewportBounds, performance.virtualizeNodes]);

  // Cull edges connected to invisible nodes
  const visibleEdges = useMemo(() => {
    if (!performance.virtualizeNodes) return edges;

    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    return edges.filter(edge =>
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [edges, visibleNodes, performance.virtualizeNodes]);

  // Level of detail - reduce quality for small nodes
  const getNodeDetailLevel = useCallback((node: DependencyNodeType) => {
    if (!node.position) return "full";

    // Calculate node screen size
    const nodeSize = node.size === "lg" ? 120 : node.size === "sm" ? 80 : 100;
    const screenSize = nodeSize * zoom;

    if (screenSize < 30) return "minimal"; // Just a colored dot
    if (screenSize < 60) return "basic";   // Title only
    return "full"; // Full details
  }, [zoom]);

  // Level of detail - simplify edges when zoomed out
  const getEdgeDetailLevel = useCallback(() => {
    if (zoom < 0.5) return "minimal"; // Straight lines only
    if (zoom < 0.8) return "basic";   // No labels
    return "full"; // Full styling and labels
  }, [zoom]);

  // Batched rendering for performance
  const renderNodes = useMemo(() => {
    const detailLevel = zoom < 0.3 ? "minimal" : zoom < 0.6 ? "basic" : "full";

    return visibleNodes.map(node => {
      const nodeDetailLevel = getNodeDetailLevel(node);

      // For minimal LOD, render simple colored circles
      if (nodeDetailLevel === "minimal") {
        if (!node.position) return null;

        const color = node.color || "#6b7280";
        return (
          <circle
            key={`${node.id}-minimal`}
            cx={node.position.x}
            cy={node.position.y}
            r={node.size === "lg" ? 8 : node.size === "sm" ? 4 : 6}
            fill={color}
            opacity={node.isHighlighted ? 1 : 0.8}
            stroke={node.isSelected ? "#3b82f6" : "none"}
            strokeWidth="2"
            style={{ cursor: "pointer" }}
            onClick={(e) => onNodeClick?.(node.id, e as any)}
            onMouseEnter={() => onNodeHover?.(node.id)}
            onMouseLeave={() => onNodeHover?.(null)}
          />
        );
      }

      return (
        <DependencyNode
          key={node.id}
          node={node}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          onNavigateToEntity={onNavigateToEntity}
          isInteractive={true}
          showDetails={nodeDetailLevel === "full"}
          scale={zoom}
        />
      );
    });
  }, [visibleNodes, zoom, getNodeDetailLevel, onNodeClick, onNodeHover, onNavigateToEntity]);

  // Batched edge rendering
  const renderEdges = useMemo(() => {
    const edgeDetailLevel = getEdgeDetailLevel();

    return visibleEdges.map(edge => {
      // For minimal LOD, render simple straight lines
      if (edgeDetailLevel === "minimal") {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        if (!sourceNode?.position || !targetNode?.position) return null;

        return (
          <line
            key={`${edge.id}-minimal`}
            x1={sourceNode.position.x}
            y1={sourceNode.position.y}
            x2={targetNode.position.x}
            y2={targetNode.position.y}
            stroke={edge.color || "#6b7280"}
            strokeWidth={(edge.width || 2) * zoom}
            strokeOpacity={edge.isHighlighted ? 1 : 0.6}
            style={{ cursor: "pointer" }}
            onClick={(e) => onEdgeClick?.(edge.id, e as any)}
            onMouseEnter={() => onEdgeHover?.(edge.id)}
            onMouseLeave={() => onEdgeHover?.(null)}
          />
        );
      }

      return (
        <DependencyEdge
          key={edge.id}
          edge={edge}
          onEdgeClick={onEdgeClick}
          onEdgeHover={onEdgeHover}
          isInteractive={true}
          showLabels={edgeDetailLevel === "full"}
          showArrows={edgeDetailLevel !== "minimal"}
          animated={edgeDetailLevel === "full"}
          scale={zoom}
        />
      );
    });
  }, [visibleEdges, nodes, zoom, getEdgeDetailLevel, onEdgeClick, onEdgeHover]);

  // Performance monitoring in development
  if (process.env.NODE_ENV === "development") {
    console.debug("VirtualizedGraph render:", {
      totalNodes: nodes.length,
      visibleNodes: visibleNodes.length,
      totalEdges: edges.length,
      visibleEdges: visibleEdges.length,
      zoom,
      viewport: viewportBounds,
    });
  }

  return (
    <>
      {/* Render edges first (behind nodes) */}
      {renderEdges}

      {/* Render nodes on top */}
      {renderNodes}

      {/* Performance warning for large graphs */}
      {process.env.NODE_ENV === "development" &&
       nodes.length > performance.maxNodes && (
        <text
          x={10}
          y={height - 20}
          fill="#f59e0b"
          fontSize="12"
          className="pointer-events-none"
        >
          Performance Warning: {nodes.length} nodes ({performance.maxNodes} recommended max)
        </text>
      )}
    </>
  );
};