import { ChevronLeft, ChevronRight, Home, MoreHorizontal } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { BreadcrumbSegment } from "../../../../contexts/HierarchyContext";
import { useHierarchyContext } from "../../../../contexts/HierarchyContext";
import { createBreadcrumbSegments, getHierarchyDepth } from "../../../../utils/hierarchy-navigation";
import { Button } from "../../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../primitives/tooltip";
import { MemoizedBreadcrumbSegment } from "./BreadcrumbSegment";

export interface HierarchyBreadcrumbProps {
  className?: string;
  showHome?: boolean;
  compact?: boolean;
  maxVisibleSegments?: number;
  showProgress?: boolean;
  showIcons?: boolean;
  enableKeyboardNavigation?: boolean;
  onSegmentClick?: (segment: BreadcrumbSegment) => void;
}

export const HierarchyBreadcrumb: React.FC<HierarchyBreadcrumbProps> = ({
  className = "",
  showHome = true,
  compact = false,
  maxVisibleSegments = 4,
  showProgress = true,
  showIcons = true,
  enableKeyboardNavigation = true,
  onSegmentClick,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { context } = useHierarchyContext();

  // State for overflow handling
  const [showOverflow, setShowOverflow] = useState(false);
  const [availableWidth, setAvailableWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentsRef = useRef<HTMLDivElement>(null);

  // Generate breadcrumb segments
  const segments = createBreadcrumbSegments(context, location.pathname);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && segmentsRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const segmentsWidth = segmentsRef.current.scrollWidth;
        setAvailableWidth(containerWidth);
        setShowOverflow(segmentsWidth > containerWidth);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [segments]);

  // Home navigation handler
  const handleHomeClick = useCallback(() => {
    navigate("/");
  }, [navigate]);

  // Segment click handler
  const handleSegmentClick = useCallback(
    (segment: BreadcrumbSegment) => {
      if (onSegmentClick) {
        onSegmentClick(segment);
      } else if (segment.clickable && segment.url) {
        navigate(segment.url);
      }
    },
    [onSegmentClick, navigate],
  );

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, segment: BreadcrumbSegment) => {
      if (!enableKeyboardNavigation) return;

      const currentIndex = segments.findIndex((s) => s.id === segment.id);

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          if (currentIndex > 0) {
            const prevSegment = segments[currentIndex - 1];
            if (prevSegment.clickable && prevSegment.url) {
              navigate(prevSegment.url);
            }
          }
          break;

        case "ArrowRight":
          event.preventDefault();
          if (currentIndex < segments.length - 1) {
            const nextSegment = segments[currentIndex + 1];
            if (nextSegment.clickable && nextSegment.url) {
              navigate(nextSegment.url);
            }
          }
          break;

        case "Home":
          event.preventDefault();
          handleHomeClick();
          break;
      }
    },
    [segments, navigate, handleHomeClick, enableKeyboardNavigation],
  );

  // Determine which segments to show based on available space
  const getVisibleSegments = () => {
    if (!showOverflow && segments.length <= maxVisibleSegments) {
      return { visible: segments, hidden: [] };
    }

    // Always show the last segment (current page)
    const lastSegment = segments[segments.length - 1];
    const remainingSegments = segments.slice(0, -1);

    // Calculate how many segments we can show
    const maxVisible = Math.min(maxVisibleSegments - 1, remainingSegments.length);

    if (remainingSegments.length <= maxVisible) {
      return { visible: segments, hidden: [] };
    }

    // Show first segment and last few segments
    const visibleSegments = [
      remainingSegments[0],
      ...remainingSegments.slice(-Math.max(0, maxVisible - 1)),
      lastSegment,
    ];

    const hiddenSegments = remainingSegments.slice(1, remainingSegments.length - Math.max(0, maxVisible - 1));

    return { visible: visibleSegments, hidden: hiddenSegments };
  };

  const { visible: visibleSegments, hidden: hiddenSegments } = getVisibleSegments();

  // Don't render if no segments
  if (segments.length === 0) {
    return null;
  }

  return (
    <nav
      ref={containerRef}
      className={`
        flex items-center gap-2 py-2 px-4
        bg-white/80 dark:bg-gray-900/80
        border-b border-gray-200/50 dark:border-gray-700/50
        backdrop-blur-sm
        ${className}
      `}
      aria-label="Hierarchy breadcrumb navigation"
      role="navigation"
    >
      {/* Home Button */}
      {showHome && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleHomeClick}
                className="p-2 h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                aria-label="Navigate to home"
              >
                <Home className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Home</p>
            </TooltipContent>
          </Tooltip>

          <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
        </>
      )}

      {/* Breadcrumb Segments Container */}
      <div ref={segmentsRef} className="flex items-center gap-2 flex-1 min-w-0">
        {visibleSegments.map((segment, index) => {
          const isLast = index === visibleSegments.length - 1;
          const actualIndex = segments.findIndex((s) => s.id === segment.id);
          const isActive = isLast;

          return (
            <React.Fragment key={segment.id}>
              {/* Show overflow indicator before this segment if needed */}
              {hiddenSegments.length > 0 && index === 1 && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-2 h-8 w-8 hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label={`Show ${hiddenSegments.length} hidden segments`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      {hiddenSegments.map((hiddenSegment) => (
                        <DropdownMenuItem
                          key={hiddenSegment.id}
                          onClick={() => handleSegmentClick(hiddenSegment)}
                          disabled={!hiddenSegment.clickable}
                          className="flex items-center gap-2"
                        >
                          <span className="text-sm">{showIcons && getHierarchyIcon(hiddenSegment.level)}</span>
                          <span className="flex-1 truncate">{hiddenSegment.title}</span>
                          {hiddenSegment.progress !== undefined && (
                            <span className="text-xs text-gray-500">{hiddenSegment.progress}%</span>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                </>
              )}

              {/* Breadcrumb Segment */}
              <MemoizedBreadcrumbSegment
                segment={segment}
                isLast={isLast}
                isActive={isActive}
                showIcon={showIcons}
                showProgress={showProgress}
                compact={compact}
                onClick={handleSegmentClick}
                onKeyDown={handleKeyDown}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Navigation Controls (when keyboard nav is enabled) */}
      {enableKeyboardNavigation && segments.length > 1 && (
        <div className="flex items-center gap-1 ml-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const currentDepth = getHierarchyDepth(location.pathname);
                  if (currentDepth > 0) {
                    const parentSegment = segments[segments.length - 2];
                    if (parentSegment?.clickable && parentSegment.url) {
                      navigate(parentSegment.url);
                    }
                  }
                }}
                disabled={segments.length < 2}
                className="p-2 h-8 w-8"
                aria-label="Go to parent level"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Go Back (←)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </nav>
  );
};

// Helper function used in dropdown (moved outside component for performance)
const getHierarchyIcon = (level: string): string => {
  switch (level) {
    case "project":
      return "📁";
    case "epic":
      return "🎯";
    case "story":
      return "📝";
    case "task":
      return "☑️";
    case "subtask":
      return "▪️";
    default:
      return "•";
  }
};
