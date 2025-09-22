/**
 * Tests for useHierarchyDependencies hooks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useHierarchyDependencyStats,
  useDependencyFilters,
  useFilteredHierarchyNodes,
} from '../hooks/useHierarchyDependencies';
import hierarchyDependencyService from '../services/hierarchyDependencyService';
import type { HierarchyTreeNode } from '../../shared/types/hierarchy';

// Mock the service
vi.mock('../services/hierarchyDependencyService', () => ({
  default: {
    getHierarchyDependencyStats: vi.fn(),
    filterNodesByDependencies: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockNodes: HierarchyTreeNode[] = [
  {
    nodeId: 'epic-1',
    type: 'epic',
    id: 'epic-1',
    title: 'Test Epic',
    status: 'doing',
    children: [],
  },
  {
    nodeId: 'story-1',
    type: 'story',
    id: 'story-1',
    title: 'Test Story',
    status: 'todo',
    children: [],
  },
];

describe('useHierarchyDependencies hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useHierarchyDependencyStats', () => {
    it('should fetch dependency stats when enabled', async () => {
      const mockStats = new Map([
        ['epic-epic-1', {
          nodeId: 'epic-epic-1',
          entityType: 'epic' as const,
          entityId: 'epic-1',
          blocking: 1,
          blockedBy: 0,
          related: 0,
          total: 1,
          hasConflicts: false,
          inCycle: false,
        }],
      ]);

      (hierarchyDependencyService.getHierarchyDependencyStats as any).mockResolvedValue(mockStats);

      const { result } = renderHook(
        () => useHierarchyDependencyStats('project-1', mockNodes, true),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(hierarchyDependencyService.getHierarchyDependencyStats).toHaveBeenCalledWith(
        'project-1',
        mockNodes
      );
      expect(result.current.data).toEqual(mockStats);
    });

    it('should not fetch when disabled', () => {
      const { result } = renderHook(
        () => useHierarchyDependencyStats('project-1', mockNodes, false),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(hierarchyDependencyService.getHierarchyDependencyStats).not.toHaveBeenCalled();
    });

    it('should not fetch when no nodes provided', () => {
      const { result } = renderHook(
        () => useHierarchyDependencyStats('project-1', [], true),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(hierarchyDependencyService.getHierarchyDependencyStats).not.toHaveBeenCalled();
    });
  });

  describe('useDependencyFilters', () => {
    it('should initialize with default filters', () => {
      const { result } = renderHook(() => useDependencyFilters());

      expect(result.current.filters).toEqual({
        showBlocked: false,
        showBlocking: false,
        showWithoutDependencies: false,
        dependencyTypes: new Set(['blocks', 'depends_on', 'related_to']),
        analysisMode: false,
      });
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should update filters correctly', () => {
      const { result } = renderHook(() => useDependencyFilters());

      // Update a filter
      result.current.updateFilter('showBlocked', true);

      expect(result.current.filters.showBlocked).toBe(true);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should toggle filters correctly', () => {
      const { result } = renderHook(() => useDependencyFilters());

      // Toggle a filter
      result.current.toggleFilter('showBlocking');

      expect(result.current.filters.showBlocking).toBe(true);
      expect(result.current.hasActiveFilters).toBe(true);

      // Toggle it back
      result.current.toggleFilter('showBlocking');

      expect(result.current.filters.showBlocking).toBe(false);
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should reset filters correctly', () => {
      const { result } = renderHook(() => useDependencyFilters());

      // Set some filters
      result.current.updateFilter('showBlocked', true);
      result.current.updateFilter('analysisMode', true);

      expect(result.current.hasActiveFilters).toBe(true);

      // Reset
      result.current.resetFilters();

      expect(result.current.filters).toEqual({
        showBlocked: false,
        showBlocking: false,
        showWithoutDependencies: false,
        dependencyTypes: new Set(['blocks', 'depends_on', 'related_to']),
        analysisMode: false,
      });
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should accept initial filters', () => {
      const initialFilters = {
        showBlocked: true,
        analysisMode: true,
      };

      const { result } = renderHook(() => useDependencyFilters(initialFilters));

      expect(result.current.filters.showBlocked).toBe(true);
      expect(result.current.filters.analysisMode).toBe(true);
      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  describe('useFilteredHierarchyNodes', () => {
    it('should return original nodes when no stats available', () => {
      const filters = {
        showBlocked: false,
        showBlocking: false,
        showWithoutDependencies: false,
        dependencyTypes: new Set(['blocks', 'depends_on', 'related_to'] as const),
        analysisMode: false,
      };

      // Mock the hook dependencies
      vi.mock('../hooks/useHierarchyDependencies', async (importOriginal) => {
        const actual = await importOriginal();
        return {
          ...actual,
          useHierarchyDependencyStats: () => ({ data: undefined }),
          useTopologicalSort: () => ({ data: undefined }),
        };
      });

      const { result } = renderHook(
        () => useFilteredHierarchyNodes('project-1', mockNodes, filters),
        { wrapper: createWrapper() }
      );

      expect(result.current).toEqual(mockNodes);
    });

    it('should filter nodes when dependency filters are active', () => {
      const mockStats = new Map([
        ['epic-epic-1', {
          nodeId: 'epic-epic-1',
          entityType: 'epic' as const,
          entityId: 'epic-1',
          blocking: 1,
          blockedBy: 0,
          related: 0,
          total: 1,
          hasConflicts: false,
          inCycle: false,
        }],
      ]);

      const filteredNodes = [mockNodes[0]]; // Only epic
      (hierarchyDependencyService.filterNodesByDependencies as any).mockReturnValue(filteredNodes);

      const filters = {
        showBlocked: false,
        showBlocking: true, // Active filter
        showWithoutDependencies: false,
        dependencyTypes: new Set(['blocks', 'depends_on', 'related_to'] as const),
        analysisMode: false,
      };

      // Mock the hooks to return our test data
      vi.doMock('../hooks/useHierarchyDependencies', () => ({
        useHierarchyDependencyStats: () => ({ data: mockStats }),
        useTopologicalSort: () => ({ data: undefined }),
      }));

      const { result } = renderHook(
        () => useFilteredHierarchyNodes('project-1', mockNodes, filters),
        { wrapper: createWrapper() }
      );

      // This test would need the actual implementation to work properly
      // For now, we're testing the service call mock
      expect(hierarchyDependencyService.filterNodesByDependencies).toHaveBeenCalledWith(
        mockNodes,
        mockStats,
        filters
      );
    });
  });
});