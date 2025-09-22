/**
 * Tests for hierarchyDependencyService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import hierarchyDependencyService from '../services/hierarchyDependencyService';
import { dependencyService } from '../services/dependencyService';
import type { HierarchyTreeNode } from '../../shared/types/hierarchy';
import type { DependencyListResponse } from '../types/dependency';

// Mock the base dependency service
vi.mock('../services/dependencyService', () => ({
  dependencyService: {
    getDependenciesByProject: vi.fn(),
    checkCircularDependencies: vi.fn(),
    getDependenciesForEntity: vi.fn(),
    validateDependency: vi.fn(),
    createDependency: vi.fn(),
    deleteDependency: vi.fn(),
  },
}));

const mockNodes: HierarchyTreeNode[] = [
  {
    nodeId: 'project-1',
    type: 'project',
    id: '1',
    title: 'Test Project',
    status: 'doing',
    children: [
      {
        nodeId: 'epic-1',
        type: 'epic',
        id: 'epic-1',
        title: 'Test Epic',
        status: 'doing',
        children: [
          {
            nodeId: 'story-1',
            type: 'story',
            id: 'story-1',
            title: 'Test Story',
            status: 'todo',
            children: [
              {
                nodeId: 'task-1',
                type: 'task',
                id: 'task-1',
                title: 'Test Task',
                status: 'todo',
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
];

const mockDependencyResponse: DependencyListResponse = {
  dependencies: [
    {
      id: 'dep-1',
      from_type: 'task',
      from_id: 'task-1',
      to_type: 'story',
      to_id: 'story-1',
      dependency_type: 'depends_on',
      status: 'active',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    },
  ],
  total: 1,
  limit: 1000,
  offset: 0,
  has_more: false,
};

describe('hierarchyDependencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHierarchyDependencyStats', () => {
    it('should calculate dependency stats for hierarchy nodes', async () => {
      (dependencyService.getDependenciesByProject as any).mockResolvedValue(mockDependencyResponse);
      (dependencyService.checkCircularDependencies as any).mockResolvedValue({
        hasCircular: false,
        cycles: [],
      });

      const stats = await hierarchyDependencyService.getHierarchyDependencyStats('project-1', mockNodes);

      expect(stats).toBeInstanceOf(Map);
      expect(stats.size).toBeGreaterThan(0);

      const taskStats = stats.get('task-task-1');
      expect(taskStats).toBeDefined();
      expect(taskStats?.blocking).toBe(0);
      expect(taskStats?.blockedBy).toBe(1); // depends_on story-1
    });

    it('should handle circular dependencies', async () => {
      (dependencyService.getDependenciesByProject as any).mockResolvedValue(mockDependencyResponse);
      (dependencyService.checkCircularDependencies as any).mockResolvedValue({
        hasCircular: true,
        cycles: [
          {
            entities: [{ type: 'task', id: 'task-1', title: 'Test Task' }],
            dependencies: ['dep-1'],
          },
        ],
      });

      const stats = await hierarchyDependencyService.getHierarchyDependencyStats('project-1', mockNodes);

      const taskStats = stats.get('task-task-1');
      expect(taskStats?.inCycle).toBe(true);
    });
  });

  describe('createNodeId', () => {
    it('should create consistent node IDs', () => {
      const nodeId = hierarchyDependencyService.createNodeId('task', 'task-1');
      expect(nodeId).toBe('task-task-1');
    });
  });

  describe('parseNodeId', () => {
    it('should parse node IDs correctly', () => {
      const parsed = hierarchyDependencyService.parseNodeId('task-task-1');
      expect(parsed).toEqual({ type: 'task', id: 'task-1' });
    });

    it('should handle IDs with dashes', () => {
      const parsed = hierarchyDependencyService.parseNodeId('story-story-with-dashes');
      expect(parsed).toEqual({ type: 'story', id: 'story-with-dashes' });
    });

    it('should return null for invalid node IDs', () => {
      expect(hierarchyDependencyService.parseNodeId('invalid')).toBeNull();
      expect(hierarchyDependencyService.parseNodeId('invalid-type-id')).toBeNull();
    });
  });

  describe('filterNodesByDependencies', () => {
    it('should filter nodes based on dependency criteria', () => {
      const mockStats = new Map([
        ['epic-epic-1', {
          nodeId: 'epic-epic-1',
          entityType: 'epic' as const,
          entityId: 'epic-1',
          blocking: 2,
          blockedBy: 0,
          related: 0,
          total: 2,
          hasConflicts: false,
          inCycle: false,
        }],
        ['story-story-1', {
          nodeId: 'story-story-1',
          entityType: 'story' as const,
          entityId: 'story-1',
          blocking: 0,
          blockedBy: 1,
          related: 0,
          total: 1,
          hasConflicts: false,
          inCycle: false,
        }],
      ]);

      const filters = {
        showBlocked: true,
        showBlocking: false,
        showWithoutDependencies: false,
        dependencyTypes: new Set(['blocks', 'depends_on', 'related_to'] as const),
        analysisMode: false,
      };

      const flatNodes = [
        mockNodes[0], // project (always shown)
        mockNodes[0].children![0], // epic
        mockNodes[0].children![0].children![0], // story
      ];

      const filtered = hierarchyDependencyService.filterNodesByDependencies(
        flatNodes,
        mockStats,
        filters
      );

      expect(filtered).toHaveLength(2); // project + story (blocked)
      expect(filtered.some(n => n.type === 'project')).toBe(true);
      expect(filtered.some(n => n.type === 'story')).toBe(true);
      expect(filtered.some(n => n.type === 'epic')).toBe(false);
    });
  });

  describe('performTopologicalSort', () => {
    it('should sort nodes topologically when no cycles exist', async () => {
      (dependencyService.getDependenciesByProject as any).mockResolvedValue(mockDependencyResponse);
      (dependencyService.checkCircularDependencies as any).mockResolvedValue({
        hasCircular: false,
        cycles: [],
      });

      const flatNodes = [
        mockNodes[0].children![0], // epic
        mockNodes[0].children![0].children![0], // story
        mockNodes[0].children![0].children![0].children![0], // task
      ];

      const result = await hierarchyDependencyService.performTopologicalSort('project-1', flatNodes);

      expect(result.hasCircularDependencies).toBe(false);
      expect(result.cycles).toHaveLength(0);
      expect(result.sortedNodes).toHaveLength(flatNodes.length + 1); // +1 for project node
    });

    it('should handle circular dependencies', async () => {
      (dependencyService.getDependenciesByProject as any).mockResolvedValue(mockDependencyResponse);
      (dependencyService.checkCircularDependencies as any).mockResolvedValue({
        hasCircular: true,
        cycles: [
          {
            entities: [
              { type: 'task', id: 'task-1', title: 'Test Task' },
              { type: 'story', id: 'story-1', title: 'Test Story' },
            ],
            dependencies: ['dep-1'],
          },
        ],
      });

      const flatNodes = [
        mockNodes[0].children![0], // epic
        mockNodes[0].children![0].children![0], // story
        mockNodes[0].children![0].children![0].children![0], // task
      ];

      const result = await hierarchyDependencyService.performTopologicalSort('project-1', flatNodes);

      expect(result.hasCircularDependencies).toBe(true);
      expect(result.cycles).toHaveLength(1);
      expect(result.cycles[0].nodeIds).toContain('task-task-1');
      expect(result.cycles[0].nodeIds).toContain('story-story-1');
    });
  });

  describe('createDependency', () => {
    it('should validate and create dependency', async () => {
      const mockDependency = {
        id: 'new-dep',
        from_type: 'task' as const,
        from_id: 'task-1',
        to_type: 'story' as const,
        to_id: 'story-1',
        dependency_type: 'depends_on' as const,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      (dependencyService.validateDependency as any).mockResolvedValue({
        valid: true,
        conflicts: [],
        warnings: [],
      });
      (dependencyService.createDependency as any).mockResolvedValue(mockDependency);

      const request = {
        from_type: 'task' as const,
        from_id: 'task-1',
        to_type: 'story' as const,
        to_id: 'story-1',
        dependency_type: 'depends_on' as const,
      };

      const result = await hierarchyDependencyService.createDependency(request);

      expect(dependencyService.validateDependency).toHaveBeenCalledWith(request);
      expect(dependencyService.createDependency).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockDependency);
    });

    it('should throw error for invalid dependency', async () => {
      (dependencyService.validateDependency as any).mockResolvedValue({
        valid: false,
        conflicts: [{ message: 'Would create circular dependency' }],
        warnings: [],
      });

      const request = {
        from_type: 'task' as const,
        from_id: 'task-1',
        to_type: 'story' as const,
        to_id: 'story-1',
        dependency_type: 'depends_on' as const,
      };

      await expect(hierarchyDependencyService.createDependency(request)).rejects.toThrow(
        'Invalid dependency: Would create circular dependency'
      );
    });
  });
});