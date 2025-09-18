import { ChevronRight } from "lucide-react";
import React, { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { BreadcrumbSegment as BreadcrumbSegmentType } from "../../../../contexts/HierarchyContext";
import {
  getAccessibleLabel,
  getHierarchyDisplayName,
  getHierarchyIcon,
  truncateTitle,
} from "../../../../utils/hierarchy-navigation";
import { Button } from "../../primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../primitives/tooltip";

export interface BreadcrumbSegmentProps {
  segment: BreadcrumbSegmentType;
  isLast?: boolean;
  isActive?: boolean;
  showIcon?: boolean;
  showProgress?: boolean;
  compact?: boolean;
  maxTitleLength?: number;
  className?: string;
  onClick?: (segment: BreadcrumbSegmentType) => void;
  onKeyDown?: (event: React.KeyboardEvent, segment: BreadcrumbSegmentType) => void;
}

export const BreadcrumbSegment: React.FC<BreadcrumbSegmentProps> = ({
  segment,
  isLast = false,
  isActive = false,
  showIcon = true,
  showProgress = true,
  compact = false,
  maxTitleLength = compact ? 15 : 25,
  className = "",
  onClick,
  onKeyDown,
}) => {
  const navigate = useNavigate();
  const segmentRef = useRef<HTMLButtonElement>(null);

  // Handle click navigation
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(segment);
      return;
    }

    if (segment.clickable && segment.url) {
      navigate(segment.url);
    }
  }, [onClick, segment, navigate]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (onKeyDown) {
        onKeyDown(event, segment);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleClick();
      }
    },
    [onKeyDown, segment, handleClick],
  );

  // Get visual styling based on segment properties
  const getSegmentStyles = () => {
    const baseStyles = "transition-all duration-200";

    if (!segment.clickable) {
      return `${baseStyles} text-gray-500 dark:text-gray-400 cursor-default`;
    }

    if (isActive) {
      return `${baseStyles} text-blue-700 dark:text-blue-300 font-medium`;
    }

    return `${baseStyles} text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20`;
  };

  // Get progress indicator styling
  const getProgressIndicatorStyles = () => {
    if (!segment.progress) return "";

    if (segment.progress >= 90) {
      return "bg-green-500";
    } else if (segment.progress >= 70) {
      return "bg-blue-500";
    } else if (segment.progress >= 40) {
      return "bg-yellow-500";
    } else {
      return "bg-red-500";
    }
  };

  const displayTitle = truncateTitle(segment.title, maxTitleLength);
  const icon = showIcon ? getHierarchyIcon(segment.level) : null;
  const levelDisplayName = getHierarchyDisplayName(segment.level);
  const accessibleLabel = getAccessibleLabel(segment);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Segment Button/Span */}
      <Tooltip>
        <TooltipTrigger asChild>
          {segment.clickable ? (
            <Button
              ref={segmentRef}
              variant="ghost"
              size={compact ? "sm" : "sm"}
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              className={`
                ${getSegmentStyles()}
                px-2 py-1 h-auto min-w-0 gap-2 text-sm
                focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                focus:outline-none rounded-md
              `}
              aria-label={accessibleLabel}
              tabIndex={0}
            >
              {/* Icon */}
              {icon && (
                <span className="text-sm flex-shrink-0" aria-hidden="true">
                  {icon}
                </span>
              )}

              {/* Title */}
              <span className="truncate font-medium">{displayTitle}</span>

              {/* Progress Indicator */}
              {showProgress && segment.progress !== undefined && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getProgressIndicatorStyles()}`}
                      style={{ width: `${segment.progress}%` }}
                    />
                  </div>
                  {!compact && <span className="text-xs text-gray-500 dark:text-gray-400">{segment.progress}%</span>}
                </div>
              )}
            </Button>
          ) : (
            <div
              className={`
                ${getSegmentStyles()}
                px-2 py-1 text-sm font-medium flex items-center gap-2
                rounded-md
              `}
              role="text"
              aria-label={accessibleLabel}
            >
              {/* Icon */}
              {icon && (
                <span className="text-sm flex-shrink-0" aria-hidden="true">
                  {icon}
                </span>
              )}

              {/* Title */}
              <span className="truncate">{displayTitle}</span>

              {/* Progress Indicator */}
              {showProgress && segment.progress !== undefined && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getProgressIndicatorStyles()}`}
                      style={{ width: `${segment.progress}%` }}
                    />
                  </div>
                  {!compact && <span className="text-xs text-gray-500 dark:text-gray-400">{segment.progress}%</span>}
                </div>
              )}
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div className="font-medium text-sm">
              {levelDisplayName}: {segment.title}
            </div>
            {segment.progress !== undefined && (
              <div className="text-xs text-gray-300">Progress: {segment.progress}% complete</div>
            )}
            {segment.clickable && <div className="text-xs text-gray-400">Click to navigate</div>}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Separator */}
      {!isLast && (
        <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" aria-hidden="true" />
      )}
    </div>
  );
};

// Memoized version for performance
export const MemoizedBreadcrumbSegment = React.memo(BreadcrumbSegment, (prevProps, nextProps) => {
  return (
    prevProps.segment.id === nextProps.segment.id &&
    prevProps.segment.title === nextProps.segment.title &&
    prevProps.segment.progress === nextProps.segment.progress &&
    prevProps.isLast === nextProps.isLast &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.compact === nextProps.compact &&
    prevProps.showIcon === nextProps.showIcon &&
    prevProps.showProgress === nextProps.showProgress
  );
});
