/**
 * Dependency Graph Component
 *
 * Main interactive dependency visualization component with zoom, pan, and selection
 * Follows glassmorphism design patterns and provides comprehensive graph controls
 */

import {
  Filter,
  Maximize2,
  Minimize2,
  Move,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { Checkbox } from "../../../ui/primitives/checkbox";
import { Input } from "../../../ui/primitives/input";
import { Label } from "../../../ui/primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/primitives/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/primitives/tooltip";
import { useDependencyGraph } from "../hooks";
import type { GraphLayout, GraphQueryParams } from "../types";
import { DependencyEdge } from "./DependencyEdge";
import { DependencyNode } from "./DependencyNode";

export interface DependencyGraphProps {
  projectId: string;
  width?: number;
  height?: number;
  className?: string;

  // Graph configuration
  layout?: GraphLayout;
  showControls?: boolean;
  showMinimap?: boolean;
  showMetrics?: boolean;
  enableRealtime?: boolean;
  realtimeInterval?: number;

  // Interaction handlers
  onNodeClick?: (nodeId: string, nodeType: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onSelectionChange?: (selectedNodes: string[], selectedEdges: string[]) => void;
  onNavigateToEntity?: (entityId: string, entityType: string) => void;

  // Focus and filtering
  focusEntityId?: string;
  focusEntityType?: "epic" | "story" | "task";
  initialFilter?: {
    entityTypes?: ("epic" | "story" | "task")[];
    dependencyTypes?: ("blocks" | "depends_on" | "related_to")[];
    searchQuery?: string;
  };
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  projectId,
  width = 800,
  height = 600,
  className = "",
  layout,
  showControls = true,
  showMinimap = false,
  showMetrics = true,
  enableRealtime = false,
  realtimeInterval = 30000,
  onNodeClick,
  onEdgeClick,
  onSelectionChange,
  onNavigateToEntity,
  focusEntityId,
  focusEntityType,
  initialFilter,
}) => {
  // Graph container ref for zoom/pan
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Graph state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState(initialFilter?.searchQuery ?? "");
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<Set<string>>(
    new Set(initialFilter?.entityTypes ?? ["epic", "story", "task"]),
  );
  const [selectedDependencyTypes, setSelectedDependencyTypes] = useState<Set<string>>(
    new Set(initialFilter?.dependencyTypes ?? ["blocks", "depends_on", "related_to"]),
  );
  const [showOnlyConnected, setShowOnlyConnected] = useState(false);

  // Graph query parameters
  const graphParams: GraphQueryParams = useMemo(
    () => ({
      project_id: projectId,
      entity_types: Array.from(selectedEntityTypes) as ("epic" | "story" | "task")[],
      max_depth: 5,
      include_subtasks: true,
      focus_entity_id: focusEntityId,
      focus_entity_type: focusEntityType,
    }),
    [projectId, selectedEntityTypes, focusEntityId, focusEntityType],
  );

  // Graph hook with filters
  const {
    nodes,
    edges,
    metrics,
    isLoading,
    error,
    selectedNodeId,
    hoveredNodeId,
    selectedEdgeId,
    hoveredEdgeId,
    onNodeClick: handleNodeClick,
    onNodeHover: handleNodeHover,
    onEdgeClick: handleEdgeClick,
    onEdgeHover: handleEdgeHover,
    onCanvasClick,
    updateNodePosition,
    focusNode,
    resetLayout,
    clearSelection,
    refetch,
    isRefetching,
  } = useDependencyGraph(graphParams, {
    width: width * zoom,
    height: height * zoom,
    layout: layout,
    realtime: enableRealtime,
    realtimeInterval,
    autoLayout: true,
    enableInteractions: true,
    filter: {
      entityTypes: selectedEntityTypes as Set<"epic" | "story" | "task">,
      dependencyTypes: selectedDependencyTypes as Set<"blocks" | "depends_on" | "related_to">,
      statuses: new Set(["todo", "doing", "review", "waiting", "done"]),
      priorities: new Set(["low", "medium", "high", "critical"]),
      showOnlyConnected,
      searchQuery,
    },
  });

  // Handle node interactions
  const handleNodeInteraction = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      handleNodeClick(nodeId, event.nativeEvent);
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        onNodeClick?.(nodeId, node.type);
      }
    },
    [handleNodeClick, nodes, onNodeClick],
  );

  // Handle edge interactions
  const handleEdgeInteraction = useCallback(
    (edgeId: string, event: React.MouseEvent) => {
      handleEdgeClick(edgeId, event.nativeEvent);
      onEdgeClick?.(edgeId);
    },
    [handleEdgeClick, onEdgeClick],
  );

  // Navigation handler
  const handleNavigateToEntity = useCallback(
    (entityId: string, entityType: string) => {
      onNavigateToEntity?.(entityId, entityType);
    },
    [onNavigateToEntity],
  );

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.2, 0.1));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    resetLayout();
  }, [resetLayout]);

  // Pan handling with mouse drag
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return; // Only left mouse button
    setIsDragging(true);
    event.preventDefault();
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isDragging) return;

      setPanX((prev) => prev + event.movementX);
      setPanY((prev) => prev + event.movementY);
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Filter handlers
  const handleEntityTypeToggle = useCallback((type: string, checked: boolean) => {
    setSelectedEntityTypes((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(type);
      } else {
        newSet.delete(type);
      }
      return newSet;
    });
  }, []);

  const handleDependencyTypeToggle = useCallback((type: string, checked: boolean) => {
    setSelectedDependencyTypes((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(type);
      } else {
        newSet.delete(type);
      }
      return newSet;
    });
  }, []);

  // Notify selection changes
  useEffect(() => {
    const selectedNodes = selectedNodeId ? [selectedNodeId] : [];
    const selectedEdges = selectedEdgeId ? [selectedEdgeId] : [];
    onSelectionChange?.(selectedNodes, selectedEdges);
  }, [selectedNodeId, selectedEdgeId, onSelectionChange]);

  // Container dimensions for fullscreen
  const containerDimensions = useMemo(() => {
    if (isFullscreen) {
      return { width: window.innerWidth - 40, height: window.innerHeight - 40 };
    }
    return { width, height };
  }, [isFullscreen, width, height]);

  // Graph transform
  const transform = `translate(${panX}, ${panY}) scale(${zoom})`;

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">Error loading dependency graph</p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className={`relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${isFullscreen ? "fixed inset-5 z-50" : ""} ${className}`}
        style={{
          width: containerDimensions.width,
          height: containerDimensions.height,
        }}
      >
        {/* Controls Panel */}
        {showControls && (
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            {/* Main controls */}
            <div className="flex gap-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg p-2 border border-gray-200 dark:border-gray-700">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleZoomIn}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom In</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleZoomOut}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom Out</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleResetView}>
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset View</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isRefetching}>
                    <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => setShowFilters((prev) => !prev)}>
                    <Filter className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Filters</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</TooltipContent>
              </Tooltip>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg p-4 border border-gray-200 dark:border-gray-700 w-64">
                <h3 className="font-medium mb-3">Filters</h3>

                {/* Search */}
                <div className="mb-3">
                  <Label className="text-sm mb-1">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search nodes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Entity Types */}
                <div className="mb-3">
                  <Label className="text-sm mb-2">Entity Types</Label>
                  <div className="space-y-2">
                    {[
                      { value: "epic", label: "Epics" },
                      { value: "story", label: "Stories" },
                      { value: "task", label: "Tasks" },
                    ].map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`entity-${type.value}`}
                          checked={selectedEntityTypes.has(type.value)}
                          onCheckedChange={(checked) => handleEntityTypeToggle(type.value, checked as boolean)}
                        />
                        <Label htmlFor={`entity-${type.value}`} className="text-sm">
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dependency Types */}
                <div className="mb-3">
                  <Label className="text-sm mb-2">Dependency Types</Label>
                  <div className="space-y-2">
                    {[
                      { value: "blocks", label: "Blocks" },
                      { value: "depends_on", label: "Depends On" },
                      { value: "related_to", label: "Related To" },
                    ].map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`dep-${type.value}`}
                          checked={selectedDependencyTypes.has(type.value)}
                          onCheckedChange={(checked) => handleDependencyTypeToggle(type.value, checked as boolean)}
                        />
                        <Label htmlFor={`dep-${type.value}`} className="text-sm">
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Show only connected */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="connected-only"
                    checked={showOnlyConnected}
                    onCheckedChange={(checked) => setShowOnlyConnected(checked as boolean)}
                  />
                  <Label htmlFor="connected-only" className="text-sm">
                    Show only connected
                  </Label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metrics Panel */}
        {showMetrics && (
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium mb-2 text-sm">Graph Metrics</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Nodes:</span>
                  <Badge variant="secondary">{metrics.totalNodes}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Edges:</span>
                  <Badge variant="secondary">{metrics.totalEdges}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Density:</span>
                  <span>{(metrics.density * 100).toFixed(1)}%</span>
                </div>
                {metrics.isolatedNodes > 0 && (
                  <div className="flex justify-between">
                    <span>Isolated:</span>
                    <Badge variant="outline">{metrics.isolatedNodes}</Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center z-20">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span>Loading dependency graph...</span>
            </div>
          </div>
        )}

        {/* Main SVG Graph */}
        <svg
          ref={svgRef}
          width={containerDimensions.width}
          height={containerDimensions.height}
          className="cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={(e) => onCanvasClick(e.nativeEvent)}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="gray" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid)" />

          <g transform={transform}>
            {/* Render edges first (behind nodes) */}
            {edges.map((edge) => (
              <DependencyEdge
                key={edge.id}
                edge={edge}
                onEdgeClick={handleEdgeInteraction}
                onEdgeHover={handleEdgeHover}
                isInteractive={true}
                showLabels={zoom >= 0.8}
                showArrows={true}
                animated={true}
                scale={zoom}
              />
            ))}

            {/* Render nodes on top */}
            {nodes.map((node) => (
              <DependencyNode
                key={node.id}
                node={node}
                onNodeClick={handleNodeInteraction}
                onNodeHover={handleNodeHover}
                onNavigateToEntity={handleNavigateToEntity}
                isDragging={false}
                isInteractive={true}
                showDetails={zoom >= 0.6}
                scale={zoom}
              />
            ))}
          </g>
        </svg>

        {/* Empty state */}
        {!isLoading && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 mb-2">No dependencies found</p>
              <Button variant="outline" onClick={() => refetch()}>
                Refresh
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
