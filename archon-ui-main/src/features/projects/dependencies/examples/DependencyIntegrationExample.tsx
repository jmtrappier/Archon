/**
 * Dependency Integration Example
 *
 * Example showing how to integrate dependency visualization
 * into existing Epic/Story/Task views
 */

import type React from "react";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../ui/primitives/tabs";
import { DependencyGraph, DependencyTab } from "../components";
import type { DependencyNode } from "../types";

// Mock data for demonstration
const mockEpic = {
  id: "epic-1",
  title: "User Authentication System",
  type: "epic" as const,
  status: "doing" as const,
  project_id: "project-1",
};

const mockAvailableEntities: DependencyNode[] = [
  {
    id: "epic-1",
    type: "epic",
    title: "User Authentication System",
    status: "doing",
    project_id: "project-1",
    progress: 65,
    priority: "high",
  },
  {
    id: "epic-2",
    type: "epic",
    title: "Payment Processing",
    status: "todo",
    project_id: "project-1",
    progress: 0,
    priority: "medium",
  },
  {
    id: "story-1",
    type: "story",
    title: "Login Form Implementation",
    status: "done",
    project_id: "project-1",
    epic_id: "epic-1",
    progress: 100,
    priority: "high",
  },
  {
    id: "story-2",
    type: "story",
    title: "Password Reset Flow",
    status: "doing",
    project_id: "project-1",
    epic_id: "epic-1",
    progress: 40,
    priority: "medium",
  },
  {
    id: "task-1",
    type: "task",
    title: "Design Login UI Components",
    status: "done",
    project_id: "project-1",
    story_id: "story-1",
    progress: 100,
  },
  {
    id: "task-2",
    type: "task",
    title: "Implement Authentication API",
    status: "doing",
    project_id: "project-1",
    story_id: "story-1",
    progress: 75,
  },
  {
    id: "task-3",
    type: "task",
    title: "Create Password Reset Form",
    status: "todo",
    project_id: "project-1",
    story_id: "story-2",
    progress: 0,
  },
];

export const DependencyIntegrationExample: React.FC = () => {
  const [selectedEntity, setSelectedEntity] = useState(mockEpic);

  const handleNavigateToEntity = (entityId: string, entityType: string) => {
    const entity = mockAvailableEntities.find((e) => e.id === entityId);
    if (entity) {
      setSelectedEntity({
        id: entity.id,
        title: entity.title,
        type: entity.type,
        status: entity.status,
        project_id: entity.project_id,
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dependency Visualization Integration</h1>
        <p className="text-gray-600">Example showing how to integrate dependency visualization into existing views</p>
      </div>

      {/* Current Entity Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
        <h2 className="font-medium mb-2">Current Entity</h2>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
            {selectedEntity.type.toUpperCase()}
          </span>
          <span className="font-medium">{selectedEntity.title}</span>
          <span className="text-gray-500">({selectedEntity.status})</span>
        </div>
      </div>

      <Tabs defaultValue="dependencies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="graph">Full Graph</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
            <h3 className="font-medium mb-4">Entity Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{selectedEntity.type}</div>
                <div className="text-sm text-gray-500">Type</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{selectedEntity.status}</div>
                <div className="text-sm text-gray-500">Status</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {mockAvailableEntities.find((e) => e.id === selectedEntity.id)?.progress || 0}%
                </div>
                <div className="text-sm text-gray-500">Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {mockAvailableEntities.find((e) => e.id === selectedEntity.id)?.priority || "N/A"}
                </div>
                <div className="text-sm text-gray-500">Priority</div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="dependencies">
          <DependencyTab
            projectId={selectedEntity.project_id}
            entityId={selectedEntity.id}
            entityType={selectedEntity.type}
            entityTitle={selectedEntity.title}
            availableEntities={mockAvailableEntities}
            onNavigateToEntity={handleNavigateToEntity}
            width={800}
            height={500}
            showCreateButton={true}
            showMetrics={true}
            showGraph={true}
          />
        </TabsContent>

        <TabsContent value="graph">
          <div className="bg-white dark:bg-gray-800 rounded-lg border">
            <DependencyGraph
              projectId={selectedEntity.project_id}
              width={900}
              height={600}
              focusEntityId={selectedEntity.id}
              focusEntityType={selectedEntity.type}
              onNodeClick={(nodeId, nodeType) => {
                handleNavigateToEntity(nodeId, nodeType);
              }}
              onNavigateToEntity={handleNavigateToEntity}
              showControls={true}
              showMinimap={true}
              showMetrics={true}
              enableRealtime={false}
              layout={{
                algorithm: "force",
                options: {
                  nodeSpacing: 120,
                  centerForce: 0.05,
                  repelForce: 150,
                  linkDistance: 100,
                  iterations: 300,
                },
              }}
              initialFilter={{
                entityTypes: ["epic", "story", "task"],
                dependencyTypes: ["blocks", "depends_on", "related_to"],
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Integration Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Integration Guide</h3>
        <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <p>
            • Add <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">DependencyTab</code> to existing
            Epic/Story/Task views
          </p>
          <p>
            • Use <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">DependencyGraph</code> for standalone
            visualization
          </p>
          <p>• Integrate with existing navigation handlers for seamless UX</p>
          <p>• Configure performance options for large projects (virtualization, max nodes)</p>
          <p>• Add dependency creation buttons to action menus</p>
        </div>
      </div>

      {/* API Integration Notes */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-6">
        <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-3">Backend Requirements</h3>
        <div className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
          <p>• API endpoints for dependency CRUD operations</p>
          <p>• Graph data endpoint with filtering and pagination</p>
          <p>• Validation endpoint for circular dependency detection</p>
          <p>• Suggestion endpoint for smart dependency recommendations</p>
          <p>• Real-time updates via WebSocket or polling</p>
        </div>
      </div>
    </div>
  );
};
