/**
 * DependencyFilters - Filter components for dependency visualization
 *
 * Provides filtering options that integrate with the global filter bar in TreeView.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowRight,
  ArrowLeft,
  Link,
  Filter,
  AlertTriangle,
  RotateCcw,
  Network,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DependencyFilters } from '../services/hierarchyDependencyService';
import type { DependencyType } from '../types/dependency';

export interface DependencyFiltersProps {
  filters: DependencyFilters;
  onUpdateFilter: (key: keyof DependencyFilters, value: any) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  className?: string;
}

const dependencyTypeLabels: Record<DependencyType, string> = {
  blocks: 'Blocks',
  depends_on: 'Depends on',
  related_to: 'Related to'
};

const dependencyTypeIcons: Record<DependencyType, React.ReactNode> = {
  blocks: <ArrowLeft className="h-3 w-3" />,
  depends_on: <ArrowRight className="h-3 w-3" />,
  related_to: <Link className="h-3 w-3" />
};

export function DependencyFilters({
  filters,
  onUpdateFilter,
  onResetFilters,
  hasActiveFilters,
  className
}: DependencyFiltersProps) {
  const handleDependencyTypeToggle = (type: DependencyType) => {
    const newTypes = new Set(filters.dependencyTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    onUpdateFilter('dependencyTypes', newTypes);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Quick Toggle Filters */}
      <div className="flex items-center gap-1">
        <Toggle
          pressed={filters.showBlocked}
          onPressedChange={(pressed) => onUpdateFilter('showBlocked', pressed)}
          size="sm"
          variant="outline"
          className={cn(
            "h-8 px-2 text-xs",
            filters.showBlocked && "bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
          )}
        >
          <ArrowRight className="h-3 w-3 mr-1" />
          Blocked
        </Toggle>

        <Toggle
          pressed={filters.showBlocking}
          onPressedChange={(pressed) => onUpdateFilter('showBlocking', pressed)}
          size="sm"
          variant="outline"
          className={cn(
            "h-8 px-2 text-xs",
            filters.showBlocking && "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300"
          )}
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Blocking
        </Toggle>

        <Toggle
          pressed={filters.showWithoutDependencies}
          onPressedChange={(pressed) => onUpdateFilter('showWithoutDependencies', pressed)}
          size="sm"
          variant="outline"
          className={cn(
            "h-8 px-2 text-xs",
            filters.showWithoutDependencies && "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          )}
        >
          <X className="h-3 w-3 mr-1" />
          No deps
        </Toggle>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Analysis Mode Toggle */}
      <Toggle
        pressed={filters.analysisMode}
        onPressedChange={(pressed) => onUpdateFilter('analysisMode', pressed)}
        size="sm"
        variant="outline"
        className={cn(
          "h-8 px-2 text-xs",
          filters.analysisMode && "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
        )}
      >
        <Network className="h-3 w-3 mr-1" />
        Analysis
        {filters.analysisMode && (
          <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px] h-4">
            Topological
          </Badge>
        )}
      </Toggle>

      <Separator orientation="vertical" className="h-6" />

      {/* Advanced Filters Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 px-2 text-xs",
              filters.dependencyTypes.size < 3 && "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
            )}
          >
            <Filter className="h-3 w-3 mr-1" />
            Types
            {filters.dependencyTypes.size < 3 && (
              <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px] h-4">
                {filters.dependencyTypes.size}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs">Dependency Types</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(dependencyTypeLabels) as DependencyType[]).map((type) => (
            <DropdownMenuCheckboxItem
              key={type}
              checked={filters.dependencyTypes.has(type)}
              onCheckedChange={() => handleDependencyTypeToggle(type)}
              className="text-xs"
            >
              <div className="flex items-center gap-2">
                {dependencyTypeIcons[type]}
                {dependencyTypeLabels[type]}
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reset Filters */}
      {hasActiveFilters && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-8 px-2 text-xs text-slate-500 hover:text-slate-700"
          >
            <X className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * Status indicator for analysis mode showing cycles and issues
 */
export function DependencyAnalysisStatus({
  cycles,
  hasCircularDependencies,
  className
}: {
  cycles?: Array<{ nodeIds: string[]; message: string }>;
  hasCircularDependencies?: boolean;
  className?: string;
}) {
  if (!hasCircularDependencies || !cycles?.length) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800", className)}>
      <div className="flex items-center gap-1">
        <RotateCcw className="h-4 w-4 text-red-500" />
        <span className="text-sm font-medium text-red-700 dark:text-red-300">
          Circular Dependencies Detected
        </span>
      </div>
      <Badge variant="destructive" className="text-xs">
        {cycles.length} cycle{cycles.length !== 1 ? 's' : ''}
      </Badge>
    </div>
  );
}

export default DependencyFilters;