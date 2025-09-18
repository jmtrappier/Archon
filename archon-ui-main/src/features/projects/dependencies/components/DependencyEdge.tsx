/**
 * Dependency Edge Component
 *
 * Visual representation of connections between nodes in the dependency graph
 * Supports different dependency types with distinct styling and animations
 */

import type React from "react";
import { useCallback, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/primitives/tooltip";
import type { DependencyEdge as DependencyEdgeType, DependencyType } from "../types";
import {
  getDependencyStatusColor,
  getDependencyStatusLabel,
  getDependencyTypeColor,
  getDependencyTypeLabel,
} from "../utils";

export interface DependencyEdgeProps {
  edge: DependencyEdgeType;
  onEdgeClick?: (edgeId: string, event: React.MouseEvent) => void;
  onEdgeHover?: (edgeId: string | null) => void;
  onEdgeDoubleClick?: (edgeId: string, event: React.MouseEvent) => void;
  isInteractive?: boolean;
  showLabels?: boolean;
  showArrows?: boolean;
  animated?: boolean;
  scale?: number;
}

export const DependencyEdge: React.FC<DependencyEdgeProps> = ({
  edge,
  onEdgeClick,
  onEdgeHover,
  onEdgeDoubleClick,
  isInteractive = true,
  showLabels = true,
  showArrows = true,
  animated = true,
  scale = 1,
}) => {
  // Calculate edge styling
  const typeColor = useMemo(() => getDependencyTypeColor(edge.type), [edge.type]);
  const statusColor = useMemo(() => getDependencyStatusColor(edge.status), [edge.status]);

  // Use type color as primary, with status affecting opacity/style
  const edgeColor = useMemo(() => {
    switch (edge.status) {
      case "blocked":
        return "#f59e0b"; // amber-500
      case "conflict":
        return "#dc2626"; // red-600
      case "resolved":
        return "#6b7280"; // gray-500
      default:
        return typeColor;
    }
  }, [edge.status, typeColor]);

  // Handle interactions
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isInteractive) return;
      event.stopPropagation();
      onEdgeClick?.(edge.id, event);
    },
    [isInteractive, onEdgeClick, edge.id],
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isInteractive) return;
      event.stopPropagation();
      onEdgeDoubleClick?.(edge.id, event);
    },
    [isInteractive, onEdgeDoubleClick, edge.id],
  );

  const handleMouseEnter = useCallback(() => {
    if (!isInteractive) return;
    onEdgeHover?.(edge.id);
  }, [isInteractive, onEdgeHover, edge.id]);

  const handleMouseLeave = useCallback(() => {
    if (!isInteractive) return;
    onEdgeHover?.(null);
  }, [isInteractive, onEdgeHover]);

  // Visual state calculations
  const isHighlighted = edge.isHighlighted;
  const isSelected = edge.isSelected;
  const strokeWidth = (edge.width ?? 2) * scale;

  // Edge path and arrow calculations
  const pathData = edge.path ?? "";

  // Calculate arrow position and angle
  const arrowProps = useMemo(() => {
    if (!pathData || !showArrows) return null;

    // Extract end point from path
    const pathParts = pathData.split(" ");
    if (pathParts.length < 4) return null;

    // For curved paths (quadratic), use the target point
    const isQuadratic = pathData.includes("Q");

    let x2: number, y2: number, x1: number, y1: number;

    if (isQuadratic) {
      // Format: M x1 y1 Q cx cy x2 y2
      const coords = pathParts.filter((p) => !isNaN(Number(p))).map(Number);
      if (coords.length >= 6) {
        [x1, y1] = [coords[0], coords[1]];
        [x2, y2] = [coords[4], coords[5]];
      } else {
        return null;
      }
    } else {
      // Format: M x1 y1 L x2 y2
      const coords = pathParts.filter((p) => !isNaN(Number(p))).map(Number);
      if (coords.length >= 4) {
        [x1, y1] = [coords[0], coords[1]];
        [x2, y2] = [coords[2], coords[3]];
      } else {
        return null;
      }
    }

    // Calculate angle
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

    return { x: x2, y: y2, angle };
  }, [pathData, showArrows]);

  // Dash array for different dependency types
  const strokeDashArray = useMemo(() => {
    switch (edge.type) {
      case "blocks":
        return edge.status === "blocked" ? "8,4" : "none";
      case "depends_on":
        return "none";
      case "related_to":
        return "4,4";
      default:
        return "none";
    }
  }, [edge.type, edge.status]);

  // Animation classes
  const animationClass = useMemo(() => {
    if (!animated) return "";

    switch (edge.status) {
      case "blocked":
        return "animate-pulse";
      case "conflict":
        return "animate-bounce";
      default:
        return "";
    }
  }, [animated, edge.status]);

  // Label position
  const labelPosition = edge.labelPosition ?? { x: 0, y: 0 };

  return (
    <TooltipProvider>
      <g className={animationClass}>
        {/* Invisible wider path for easier clicking */}
        {isInteractive && (
          <path
            d={pathData}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(8, strokeWidth * 2)}
            style={{ cursor: "pointer" }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
        )}

        {/* Main edge path */}
        <path
          d={pathData}
          fill="none"
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeOpacity={edge.status === "resolved" ? 0.5 : isHighlighted ? 1 : 0.8}
          strokeDasharray={strokeDashArray}
          className="transition-all duration-200"
          style={{
            filter: isHighlighted || isSelected ? `drop-shadow(0 0 4px ${edgeColor}60)` : undefined,
          }}
          markerEnd={showArrows ? `url(#arrow-${edge.id})` : undefined}
        />

        {/* Arrow marker definition */}
        {showArrows && arrowProps && (
          <defs>
            <marker
              id={`arrow-${edge.id}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="3"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill={edgeColor} opacity={edge.status === "resolved" ? 0.5 : 0.8} />
            </marker>
          </defs>
        )}

        {/* Edge label */}
        {showLabels && labelPosition.x !== 0 && labelPosition.y !== 0 && (
          <Tooltip>
            <TooltipTrigger>
              <g transform={`translate(${labelPosition.x}, ${labelPosition.y})`}>
                {/* Label background */}
                <rect
                  x="-15"
                  y="-8"
                  width="30"
                  height="16"
                  rx="8"
                  fill="white"
                  fillOpacity="0.9"
                  stroke={edgeColor}
                  strokeWidth="1"
                  strokeOpacity="0.5"
                  className="transition-all duration-200"
                />

                {/* Label icon based on dependency type */}
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  className="text-xs font-medium pointer-events-none select-none"
                  fill={edgeColor}
                >
                  {edge.type === "blocks" ? "⚠" : edge.type === "depends_on" ? "→" : "~"}
                </text>
              </g>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <div className="font-medium">{getDependencyTypeLabel(edge.type)}</div>
                <div className="text-gray-500">Status: {getDependencyStatusLabel(edge.status)}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Selection/highlight indicator */}
        {(isHighlighted || isSelected) && (
          <path
            d={pathData}
            fill="none"
            stroke={isSelected ? "#3b82f6" : "#6366f1"}
            strokeWidth={strokeWidth + 2}
            strokeOpacity="0.3"
            className="pointer-events-none animate-pulse"
          />
        )}
      </g>
    </TooltipProvider>
  );
};
