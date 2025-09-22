/**
 * HierarchyDependenciesPanel - Side panel for dependency visualization in TreeView
 *
 * Displays dependencies for the selected node with incoming/outgoing relationships,
 * status indicators, and navigation capabilities.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowRight,
  ArrowLeft,
  Link,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  ExternalLink,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNodeDependencies } from '../hooks/useHierarchyDependencies';
import type {
  DependencyEntityType,
  DependencyType,
  DependencyStatus,
  Dependency
} from '../types/dependency';
import type { HierarchyTreeNode } from '../../shared/types/hierarchy';

export interface HierarchyDependenciesPanelProps {
  selectedNode: HierarchyTreeNode | null;
  onNavigateToNode: (entityType: DependencyEntityType, entityId: string) => void;
  onCreateDependency: (fromNode: HierarchyTreeNode) => void;
  className?: string;
}

const dependencyTypeIcons: Record<DependencyType, React.ReactNode> = {
  blocks: <XCircle className="h-3 w-3" />,
  depends_on: <ArrowLeft className="h-3 w-3" />,
  related_to: <Link className="h-3 w-3" />
};

const dependencyTypeLabels: Record<DependencyType, string> = {
  blocks: 'Blocks',
  depends_on: 'Depends on',
  related_to: 'Related to'
};

const statusIcons: Record<DependencyStatus, React.ReactNode> = {
  active: <Clock className="h-3 w-3 text-blue-500" />,
  resolved: <CheckCircle className="h-3 w-3 text-green-500" />,
  blocked: <XCircle className="h-3 w-3 text-red-500" />,
  conflict: <AlertCircle className="h-3 w-3 text-orange-500" />
};

const statusLabels: Record<DependencyStatus, string> = {
  active: 'Active',
  resolved: 'Resolved',
  blocked: 'Blocked',
  conflict: 'Conflict'
};

const entityTypeLabels: Record<DependencyEntityType, string> = {
  epic: 'Epic',
  story: 'Story',
  task: 'Task'
};

function DependencyItem({
  dependency,
  direction,
  onNavigate
}: {
  dependency: Dependency & { from_entity?: any; to_entity?: any };
  direction: 'incoming' | 'outgoing';
  onNavigate: (entityType: DependencyEntityType, entityId: string) => void;
}) {
  const relatedEntity = direction === 'incoming' ? dependency.from_entity : dependency.to_entity;
  const relatedType = direction === 'incoming' ? dependency.from_type : dependency.to_type;
  const relatedId = direction === 'incoming' ? dependency.from_id : dependency.to_id;

  if (!relatedEntity) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:bg-slate-100/50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-700/50">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Direction and Type Icon */}
        <div className="flex items-center gap-1">
          {direction === 'incoming' ? (
            <ArrowRight className="h-4 w-4 text-slate-400" />
          ) : (
            <ArrowLeft className="h-4 w-4 text-slate-400" />
          )}
          {dependencyTypeIcons[dependency.dependency_type]}
        </div>

        {/* Entity Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {entityTypeLabels[relatedType]}
            </Badge>
            <span className="text-sm font-medium truncate">
              {relatedEntity.title}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-500">
              {dependencyTypeLabels[dependency.dependency_type]}
            </span>
            {dependency.status && (
              <>
                <span className="text-xs text-slate-400">•</span>
                <div className="flex items-center gap-1">
                  {statusIcons[dependency.status]}
                  <span className="text-xs text-slate-500">
                    {statusLabels[dependency.status]}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigate Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate(relatedType, relatedId)}
        className="h-8 w-8 p-0 flex-shrink-0"
      >
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
        <Link className="h-6 w-6 text-slate-400" />
      </div>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function HierarchyDependenciesPanel({
  selectedNode,
  onNavigateToNode,
  onCreateDependency,
  className
}: HierarchyDependenciesPanelProps) {
  const nodeEntityType = selectedNode?.type as DependencyEntityType;
  const nodeEntityId = selectedNode?.id;

  const {
    data: dependencies,
    isLoading,
    error
  } = useNodeDependencies(
    nodeEntityType,
    nodeEntityId,
    !!selectedNode && selectedNode.type !== 'project'
  );

  if (!selectedNode) {
    return (
      <Card className={cn("h-full", className)}>
        <CardHeader>
          <CardTitle className="text-lg">Dependencies</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState message="Select a node to view its dependencies" />
        </CardContent>
      </Card>
    );
  }

  if (selectedNode.type === 'project') {
    return (
      <Card className={cn("h-full", className)}>
        <CardHeader>
          <CardTitle className="text-lg">Dependencies</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState message="Dependencies are not available for project nodes" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Dependencies</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {selectedNode.title}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCreateDependency(selectedNode)}
            className="flex items-center gap-2"
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center p-6">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Loading dependencies...
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-6">
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" />
              Failed to load dependencies
            </div>
          </div>
        ) : !dependencies ? (
          <EmptyState message="No dependency data available" />
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              {/* Incoming Dependencies */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-medium">
                    Incoming ({dependencies.incoming.length})
                  </h3>
                </div>
                {dependencies.incoming.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center dark:border-slate-700">
                    <p className="text-xs text-slate-500">
                      No incoming dependencies
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dependencies.incoming.map((dependency) => (
                      <DependencyItem
                        key={dependency.id}
                        dependency={dependency}
                        direction="incoming"
                        onNavigate={onNavigateToNode}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Outgoing Dependencies */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ArrowLeft className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-medium">
                    Outgoing ({dependencies.outgoing.length})
                  </h3>
                </div>
                {dependencies.outgoing.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center dark:border-slate-700">
                    <p className="text-xs text-slate-500">
                      No outgoing dependencies
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dependencies.outgoing.map((dependency) => (
                      <DependencyItem
                        key={dependency.id}
                        dependency={dependency}
                        direction="outgoing"
                        onNavigate={onNavigateToNode}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              {(dependencies.incoming.length > 0 || dependencies.outgoing.length > 0) && (
                <>
                  <Separator />
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      <span>
                        {dependencies.incoming.length + dependencies.outgoing.length} total
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default HierarchyDependenciesPanel;