/**
 * Dependency Tab Component
 *
 * Tab component that can be integrated into Epic/Story/Task views
 * to show dependency visualization and management
 */

import { Network, Plus, Filter, Eye, Settings } from "lucide-react";
import type React from "react";
import { useState, useCallback, useMemo } from "react";
import { Button } from "../../../ui/primitives/button";
import { Badge } from "../../../ui/primitives/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../ui/primitives/tabs";
import { Alert, AlertDescription } from "../../../ui/primitives/alert";
import { Skeleton } from "../../../ui/primitives/skeleton";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyModal } from "./DependencyModal";
import {
  useDependenciesForEntity,
  useDependencyStats,
  useCircularDependencies,
} from "../hooks";
import type {
  DependencyEntityType,
  DependencyNode,
  GraphLayout,
} from "../types";
import { getDependencyStatusLabel } from "../utils";

export interface DependencyTabProps {
  projectId: string;
  entityId: string;
  entityType: DependencyEntityType;
  entityTitle: string;

  // Graph configuration
  width?: number;
  height?: number;
  layout?: GraphLayout;

  // Available entities for creating dependencies
  availableEntities?: DependencyNode[];

  // Navigation handlers
  onNavigateToEntity?: (entityId: string, entityType: string) => void;

  // Optional customization
  showCreateButton?: boolean;
  showMetrics?: boolean;
  showGraph?: boolean;
  className?: string;
}

export const DependencyTab: React.FC<DependencyTabProps> = ({
  projectId,
  entityId,
  entityType,
  entityTitle,
  width = 800,
  height = 500,
  layout,
  availableEntities = [],
  onNavigateToEntity,
  showCreateButton = true,
  showMetrics = true,
  showGraph = true,
  className = "",
}) => {
  // Local state
  const [activeTab, setActiveTab] = useState("graph");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDependency, setSelectedDependency] = useState<string | null>(null);

  // Query hooks
  const {
    data: entityDependencies,
    isLoading: dependenciesLoading,
    error: dependenciesError,
    refetch: refetchDependencies,
  } = useDependenciesForEntity(entityType, entityId, {
    include_entities: true,
  });

  const {
    data: projectStats,
    isLoading: statsLoading,
  } = useDependencyStats(projectId, { enabled: showMetrics });

  const {
    data: circularCheck,
    isLoading: circularLoading,
  } = useCircularDependencies(projectId);

  // Get current entity as node for create modal
  const currentEntity = useMemo((): DependencyNode | undefined => {
    const entity = availableEntities.find(e => e.id === entityId);
    if (entity) return entity;

    // Create a minimal entity representation if not in availableEntities
    return {
      id: entityId,
      type: entityType,
      title: entityTitle,
      status: "todo", // Default status - should be fetched from actual entity
      project_id: projectId,
    };
  }, [entityId, entityType, entityTitle, projectId, availableEntities]);

  // Handlers
  const handleCreateDependency = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleDependencyCreated = useCallback(() => {
    refetchDependencies();
  }, [refetchDependencies]);

  const handleNodeClick = useCallback((nodeId: string, nodeType: string) => {
    // If clicking on the current entity, don't navigate
    if (nodeId === entityId) return;

    onNavigateToEntity?.(nodeId, nodeType);
  }, [entityId, onNavigateToEntity]);

  const handleEdgeClick = useCallback((edgeId: string) => {
    setSelectedDependency(edgeId);
  }, []);

  // Statistics summary
  const dependencyStats = useMemo(() => {
    if (!entityDependencies?.dependencies) return null;

    const incoming = entityDependencies.dependencies.filter(dep => dep.to_id === entityId);
    const outgoing = entityDependencies.dependencies.filter(dep => dep.from_id === entityId);

    const blocked = incoming.filter(dep => dep.status === "blocked").length;
    const conflicts = incoming.concat(outgoing).filter(dep => dep.status === "conflict").length;

    return {
      incoming: incoming.length,
      outgoing: outgoing.length,
      blocked,
      conflicts,
      total: incoming.length + outgoing.length,
    };
  }, [entityDependencies, entityId]);

  // Render loading state
  if (dependenciesLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Render error state
  if (dependenciesError) {
    return (
      <div className={`${className}`}>
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load dependencies. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with stats and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-gray-500" />
            <span className="font-medium">Dependencies</span>
          </div>

          {/* Quick stats */}
          {dependencyStats && (
            <div className="flex items-center gap-2">
              {dependencyStats.incoming > 0 && (
                <Badge variant="outline" className="text-xs">
                  ← {dependencyStats.incoming}
                </Badge>
              )}
              {dependencyStats.outgoing > 0 && (
                <Badge variant="outline" className="text-xs">
                  → {dependencyStats.outgoing}
                </Badge>
              )}
              {dependencyStats.blocked > 0 && (
                <Badge variant="destructive" className="text-xs">
                  ⚠ {dependencyStats.blocked} blocked
                </Badge>
              )}
              {dependencyStats.conflicts > 0 && (
                <Badge variant="destructive" className="text-xs">
                  ⚠ {dependencyStats.conflicts} conflicts
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showCreateButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateDependency}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Dependency
            </Button>
          )}
        </div>
      </div>

      {/* Circular dependency warning */}
      {circularCheck?.hasCircular && (
        <Alert variant="destructive">
          <AlertDescription>
            Circular dependencies detected in this project. This may cause issues with task execution.
          </AlertDescription>
        </Alert>
      )}

      {/* Main content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="graph" className="flex items-center gap-2">
            <Network className="w-4 h-4" />
            Graph View
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            List View
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Metrics
          </TabsTrigger>
        </TabsList>

        {/* Graph View */}
        <TabsContent value="graph">
          {showGraph && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <DependencyGraph
                projectId={projectId}
                width={width}
                height={height}
                layout={layout}
                focusEntityId={entityId}
                focusEntityType={entityType}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onNavigateToEntity={onNavigateToEntity}
                showControls={true}
                showMinimap={false}
                showMetrics={true}
                enableRealtime={false}
              />
            </div>
          )}
        </TabsContent>

        {/* List View */}
        <TabsContent value="list">
          <div className="space-y-4">
            {/* Incoming Dependencies */}
            {entityDependencies?.dependencies.filter(dep => dep.to_id === entityId).length > 0 && (
              <div>
                <h3 className="font-medium mb-3">Incoming Dependencies ({entityDependencies?.dependencies.filter(dep => dep.to_id === entityId).length})</h3>
                <div className="space-y-2">
                  {entityDependencies?.dependencies
                    .filter(dep => dep.to_id === entityId)
                    .map(dependency => (
                      <div
                        key={dependency.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: dependency.from_entity?.type === "epic" ? "#8b5cf6" :
                                          dependency.from_entity?.type === "story" ? "#06b6d4" : "#f97316",
                              color: dependency.from_entity?.type === "epic" ? "#8b5cf6" :
                                     dependency.from_entity?.type === "story" ? "#06b6d4" : "#f97316",
                            }}
                          >
                            {dependency.from_entity?.type}
                          </Badge>
                          <div>
                            <div className="font-medium">{dependency.from_entity?.title || "Unknown"}</div>
                            <div className="text-sm text-gray-500">
                              {dependency.dependency_type.replace("_", " ")} this {entityType}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={dependency.status === "blocked" ? "destructive" :
                                  dependency.status === "active" ? "default" : "secondary"}
                        >
                          {getDependencyStatusLabel(dependency.status)}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Outgoing Dependencies */}
            {entityDependencies?.dependencies.filter(dep => dep.from_id === entityId).length > 0 && (
              <div>
                <h3 className="font-medium mb-3">Outgoing Dependencies ({entityDependencies?.dependencies.filter(dep => dep.from_id === entityId).length})</h3>
                <div className="space-y-2">
                  {entityDependencies?.dependencies
                    .filter(dep => dep.from_id === entityId)
                    .map(dependency => (
                      <div
                        key={dependency.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: dependency.to_entity?.type === "epic" ? "#8b5cf6" :
                                          dependency.to_entity?.type === "story" ? "#06b6d4" : "#f97316",
                              color: dependency.to_entity?.type === "epic" ? "#8b5cf6" :
                                     dependency.to_entity?.type === "story" ? "#06b6d4" : "#f97316",
                            }}
                          >
                            {dependency.to_entity?.type}
                          </Badge>
                          <div>
                            <div className="font-medium">{dependency.to_entity?.title || "Unknown"}</div>
                            <div className="text-sm text-gray-500">
                              This {entityType} {dependency.dependency_type.replace("_", " ")} it
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={dependency.status === "blocked" ? "destructive" :
                                  dependency.status === "active" ? "default" : "secondary"}
                        >
                          {getDependencyStatusLabel(dependency.status)}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {(!entityDependencies?.dependencies || entityDependencies.dependencies.length === 0) && (
              <div className="text-center py-8">
                <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">No Dependencies</h3>
                <p className="text-gray-500 mb-4">
                  This {entityType} doesn't have any dependencies yet.
                </p>
                {showCreateButton && (
                  <Button onClick={handleCreateDependency} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create First Dependency
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Metrics View */}
        <TabsContent value="metrics">
          <div className="space-y-4">
            {/* Entity-specific metrics */}
            {dependencyStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {dependencyStats.incoming}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Incoming</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {dependencyStats.outgoing}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Outgoing</div>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {dependencyStats.blocked}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Blocked</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {dependencyStats.conflicts}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Conflicts</div>
                </div>
              </div>
            )}

            {/* Project-wide metrics */}
            {projectStats && !statsLoading && (
              <div>
                <h3 className="font-medium mb-3">Project Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                    <div className="text-2xl font-bold">{projectStats.total}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Dependencies</div>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                    <div className="text-2xl font-bold">{projectStats.by_type.blocks || 0}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Blocking</div>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                    <div className="text-2xl font-bold">{projectStats.conflicts || 0}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Conflicts</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Dependency Modal */}
      <DependencyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectId={projectId}
        mode="create"
        fromEntity={currentEntity}
        availableEntities={availableEntities}
        onDependencyCreated={handleDependencyCreated}
      />
    </div>
  );
};