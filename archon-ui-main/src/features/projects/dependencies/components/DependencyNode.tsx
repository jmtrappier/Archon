/**
 * Dependency Node Component
 *
 * Individual node representation in the dependency graph visualization
 * Follows glassmorphism design patterns from existing Epic/Story/Task cards
 */

import { BarChart3, ChevronRight, Flag, Users } from "lucide-react";
import type React from "react";
import { useCallback, useMemo } from "react";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/primitives/tooltip";
import type { DependencyNode as DependencyNodeType } from "../types";
import {
  getEntityTypeColor,
  getEntityTypeLabel,
  getHierarchyStatusColor,
  getNodeSize,
  getPriorityColor,
} from "../utils";

export interface DependencyNodeProps {
  node: DependencyNodeType;
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onNodeDoubleClick?: (nodeId: string, event: React.MouseEvent) => void;
  onNavigateToEntity?: (nodeId: string, entityType: DependencyNodeType["type"]) => void;
  isDragging?: boolean;
  isInteractive?: boolean;
  showDetails?: boolean;
  scale?: number;
}

export const DependencyNode: React.FC<DependencyNodeProps> = ({
  node,
  onNodeClick,
  onNodeHover,
  onNodeDoubleClick,
  onNavigateToEntity,
  isDragging = false,
  isInteractive = true,
  showDetails = true,
  scale = 1,
}) => {
  // Calculate node styling
  const nodeSize = useMemo(() => getNodeSize(node.type), [node.type]);
  const entityColor = useMemo(() => getEntityTypeColor(node.type), [node.type]);
  const statusColor = useMemo(() => getHierarchyStatusColor(node.status), [node.status]);
  const priorityColor = useMemo(() => (node.priority ? getPriorityColor(node.priority) : null), [node.priority]);

  // Handle interactions
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isInteractive) return;
      event.stopPropagation();
      onNodeClick?.(node.id, event);
    },
    [isInteractive, onNodeClick, node.id],
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isInteractive) return;
      event.stopPropagation();
      onNodeDoubleClick?.(node.id, event);
    },
    [isInteractive, onNodeDoubleClick, node.id],
  );

  const handleMouseEnter = useCallback(() => {
    if (!isInteractive) return;
    onNodeHover?.(node.id);
  }, [isInteractive, onNodeHover, node.id]);

  const handleMouseLeave = useCallback(() => {
    if (!isInteractive) return;
    onNodeHover?.(null);
  }, [isInteractive, onNodeHover]);

  const handleNavigate = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onNavigateToEntity?.(node.id, node.type);
    },
    [onNavigateToEntity, node.id, node.type],
  );

  // Node size based on importance and connections
  const sizeMultiplier = useMemo(() => {
    let multiplier = 1;

    // Size based on explicit size prop
    if (node.size === "lg") multiplier *= 1.3;
    else if (node.size === "sm") multiplier *= 0.8;

    // Scale factor
    multiplier *= scale;

    return multiplier;
  }, [node.size, scale]);

  const scaledWidth = nodeSize.width * sizeMultiplier;
  const scaledHeight = nodeSize.height * sizeMultiplier;

  // Position calculation
  const x = node.position?.x ?? 0;
  const y = node.position?.y ?? 0;

  // Visual state calculations
  const isHighlighted = node.isHighlighted;
  const isSelected = node.isSelected;
  const progressPercentage = node.progress ?? 0;

  // Glassmorphism styling
  const baseCardStyles = `
    backdrop-blur-lg rounded-xl border transition-all duration-200 ease-in-out
    ${
      isSelected
        ? "border-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.5)] bg-blue-50/40 dark:bg-blue-900/30"
        : isHighlighted
          ? "border-indigo-400/60 shadow-[0_0_12px_rgba(99,102,241,0.3)]"
          : "border-gray-200 dark:border-gray-700"
    }
    ${isInteractive ? "cursor-pointer hover:shadow-lg" : "cursor-default"}
    ${isDragging ? "opacity-60 scale-95" : "opacity-100 scale-100"}
  `;

  const backgroundGradient = `bg-gradient-to-b from-white/90 to-white/70 dark:from-white/15 dark:to-black/40`;

  // Entity type specific styling
  const entityStyles = useMemo(() => {
    switch (node.type) {
      case "epic":
        return {
          iconColor: entityColor,
          bgOpacity: "bg-violet-50/20 dark:bg-violet-900/20",
          textSize: "text-xs font-semibold",
        };
      case "story":
        return {
          iconColor: entityColor,
          bgOpacity: "bg-cyan-50/20 dark:bg-cyan-900/20",
          textSize: "text-xs font-medium",
        };
      case "task":
        return {
          iconColor: entityColor,
          bgOpacity: "bg-orange-50/20 dark:bg-orange-900/20",
          textSize: "text-xs font-medium",
        };
      default:
        return {
          iconColor: entityColor,
          bgOpacity: "bg-gray-50/20 dark:bg-gray-900/20",
          textSize: "text-xs font-medium",
        };
    }
  }, [node.type, entityColor]);

  return (
    <TooltipProvider>
      <g
        transform={`translate(${x - scaledWidth / 2}, ${y - scaledHeight / 2})`}
        style={{ cursor: isInteractive ? "pointer" : "default" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Node background with glassmorphism effect */}
        <foreignObject width={scaledWidth} height={scaledHeight} className="overflow-hidden">
          <div
            className={`${baseCardStyles} ${backgroundGradient} ${entityStyles.bgOpacity} w-full h-full relative overflow-hidden`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          >
            {/* Status indicator bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl opacity-80"
              style={{
                background: `linear-gradient(to bottom, ${statusColor}, ${entityColor})`,
                boxShadow: `0 0 4px ${statusColor}30`,
              }}
            />

            {/* Content container */}
            <div className="flex flex-col h-full p-2 pl-3">
              {/* Header with badges */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  {/* Entity type badge */}
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0.5 rounded-md"
                    style={{
                      backgroundColor: `${entityColor}20`,
                      color: entityColor,
                      border: `1px solid ${entityColor}30`,
                    }}
                  >
                    {getEntityTypeLabel(node.type)}
                  </Badge>

                  {/* Priority badge */}
                  {node.priority && node.priority !== "medium" && (
                    <Badge
                      variant="outline"
                      className="text-xs px-1.5 py-0.5 rounded-md"
                      style={{
                        borderColor: priorityColor,
                        color: priorityColor,
                      }}
                    >
                      {node.priority.toUpperCase()}
                    </Badge>
                  )}
                </div>

                {/* Action button */}
                {onNavigateToEntity && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNavigate}
                        className="h-4 w-4 p-0 hover:bg-white/20 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronRight className="w-2.5 h-2.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Open {getEntityTypeLabel(node.type)}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Title */}
              <h4
                className={`${entityStyles.textSize} text-gray-900 dark:text-white mb-1 line-clamp-2 leading-tight`}
                title={node.title}
              >
                {node.title}
              </h4>

              {/* Status badge */}
              <div className="mb-1">
                <Badge
                  variant="secondary"
                  className="text-xs px-1.5 py-0.5 rounded-md"
                  style={{
                    backgroundColor: `${statusColor}20`,
                    color: statusColor,
                    border: `1px solid ${statusColor}30`,
                  }}
                >
                  {node.status.toUpperCase()}
                </Badge>
              </div>

              {/* Progress bar (if available and showing details) */}
              {showDetails && progressPercentage > 0 && (
                <div className="mb-1">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-gray-600 dark:text-gray-400">Progress</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {Math.round(progressPercentage)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${progressPercentage}%`,
                        background: `linear-gradient(90deg, ${statusColor}, ${entityColor})`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Connection indicators */}
              {showDetails && (node.incomingCount || node.outgoingCount) && (
                <div className="flex items-center gap-2 mt-auto text-xs text-gray-500 dark:text-gray-400">
                  {node.incomingCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="flex items-center gap-0.5">
                          <span className="text-red-500">←</span>
                          {node.incomingCount}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{node.incomingCount} incoming dependencies</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {node.outgoingCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="flex items-center gap-0.5">
                          <span className="text-blue-500">→</span>
                          {node.outgoingCount}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{node.outgoingCount} outgoing dependencies</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          </div>
        </foreignObject>

        {/* Glow effect for highlighted/selected nodes */}
        {(isHighlighted || isSelected) && (
          <rect
            x={-2}
            y={-2}
            width={scaledWidth + 4}
            height={scaledHeight + 4}
            fill="none"
            stroke={isSelected ? "#3b82f6" : "#6366f1"}
            strokeWidth="2"
            strokeOpacity="0.5"
            rx="14"
            className="pointer-events-none animate-pulse"
          />
        )}
      </g>
    </TooltipProvider>
  );
};
