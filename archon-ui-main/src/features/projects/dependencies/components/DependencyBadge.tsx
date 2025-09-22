/**
 * DependencyBadge - Shows dependency counts on TreeView nodes
 *
 * Displays blocking/blocked counts with visual indicators for conflicts and cycles.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  Link
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HierarchyDependencyStats } from '../services/hierarchyDependencyService';

export interface DependencyBadgeProps {
  stats: HierarchyDependencyStats | undefined;
  className?: string;
  size?: 'sm' | 'md';
}

export function DependencyBadge({ stats, className, size = 'sm' }: DependencyBadgeProps) {
  if (!stats || stats.total === 0) {
    return null;
  }

  const hasIssues = stats.hasConflicts || stats.inCycle;
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "flex items-center gap-1",
          className
        )}>
          {/* Blocking indicator */}
          {stats.blocking > 0 && (
            <Badge
              variant={hasIssues ? "destructive" : "secondary"}
              className={cn(
                "text-xs px-1.5 py-0.5 h-auto flex items-center gap-1",
                size === 'sm' ? "text-[10px]" : "text-xs"
              )}
            >
              <ArrowLeft className={iconSize} />
              {stats.blocking}
            </Badge>
          )}

          {/* Blocked indicator */}
          {stats.blockedBy > 0 && (
            <Badge
              variant={hasIssues ? "destructive" : "outline"}
              className={cn(
                "text-xs px-1.5 py-0.5 h-auto flex items-center gap-1",
                size === 'sm' ? "text-[10px]" : "text-xs"
              )}
            >
              <ArrowRight className={iconSize} />
              {stats.blockedBy}
            </Badge>
          )}

          {/* Related indicator (only if no blocking/blocked) */}
          {stats.related > 0 && stats.blocking === 0 && stats.blockedBy === 0 && (
            <Badge
              variant="secondary"
              className={cn(
                "text-xs px-1.5 py-0.5 h-auto flex items-center gap-1",
                size === 'sm' ? "text-[10px]" : "text-xs"
              )}
            >
              <Link className={iconSize} />
              {stats.related}
            </Badge>
          )}

          {/* Issue indicators */}
          {hasIssues && (
            <div className="flex items-center gap-0.5">
              {stats.hasConflicts && (
                <AlertTriangle className={cn(iconSize, "text-orange-500")} />
              )}
              {stats.inCycle && (
                <RotateCcw className={cn(iconSize, "text-red-500")} />
              )}
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-medium text-xs">Dependencies</div>
          <div className="space-y-0.5 text-xs">
            {stats.blocking > 0 && (
              <div className="flex items-center gap-2">
                <ArrowLeft className="h-3 w-3" />
                <span>Blocking {stats.blocking} item{stats.blocking !== 1 ? 's' : ''}</span>
              </div>
            )}
            {stats.blockedBy > 0 && (
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3" />
                <span>Blocked by {stats.blockedBy} item{stats.blockedBy !== 1 ? 's' : ''}</span>
              </div>
            )}
            {stats.related > 0 && (
              <div className="flex items-center gap-2">
                <Link className="h-3 w-3" />
                <span>Related to {stats.related} item{stats.related !== 1 ? 's' : ''}</span>
              </div>
            )}
            {stats.hasConflicts && (
              <div className="flex items-center gap-2 text-orange-500">
                <AlertTriangle className="h-3 w-3" />
                <span>Has conflicts</span>
              </div>
            )}
            {stats.inCycle && (
              <div className="flex items-center gap-2 text-red-500">
                <RotateCcw className="h-3 w-3" />
                <span>In circular dependency</span>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default DependencyBadge;