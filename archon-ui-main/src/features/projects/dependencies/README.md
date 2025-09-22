# TreeView Dependency Visualization

This module implements **STORY 4.22 - Visualisation des Dépendances** for the Archon TRAXIS project.

## Overview

Provides comprehensive dependency visualization within the TreeView interface, including:

- **Dependency badges** on each node showing blocking/blocked counts
- **Side panel** with detailed dependency information
- **Advanced filtering** by dependency types and status
- **Topological analysis mode** for dependency ordering
- **Modal editor** for creating and managing dependencies
- **Circular dependency detection** with visual indicators

## Architecture

### Services

- **`hierarchyDependencyService`** - Core service extending base dependency operations for hierarchy integration
- **`dependencyService`** - Base service for API interactions (existing)

### Components

- **`HierarchyDependenciesPanel`** - Side panel showing dependency details for selected node
- **`DependencyBadge`** - Visual indicators on tree nodes showing dependency counts
- **`DependencyFilters`** - Filter controls for the global filter bar
- **`DependencyEditorModal`** - Modal for creating/editing dependencies
- **`HierarchyNodeWithDependencies`** - Enhanced tree node with dependency support
- **`TreeViewWithDependencies`** - Complete TreeView with dependency features

### Hooks

- **`useHierarchyDependencyStats`** - Fetch dependency statistics for nodes
- **`useNodeDependencies`** - Get detailed dependencies for a specific node
- **`useTopologicalSort`** - Perform dependency-based sorting
- **`useDependencyFilters`** - Manage dependency filter state
- **`useCreateDependency`** / **`useDeleteDependency`** - Mutation hooks

## Features Implemented

### ✅ Acceptance Criteria Completed

1. **Badge de dépendances** - ✅ `DependencyBadge` component showing counts with tooltips
2. **Panneau latéral** - ✅ `HierarchyDependenciesPanel` with incoming/outgoing lists
3. **Filtres** - ✅ Integrated with global filter bar (Blocked/Blocking/No deps)
4. **Mode Analyse** - ✅ Topological ordering toggle with cycle detection
5. **Détection de cycles** - ✅ Visual indicators and warnings
6. **Navigation rapide** - ✅ "Navigate to dependency" functionality
7. **Modal édition** - ✅ Create/delete dependencies with validation
8. **APIs synchronization** - ✅ Integrated with existing dependency APIs

### Key Features

#### Dependency Badges
- Show blocking/blocked/related counts on each tree node
- Visual indicators for conflicts and circular dependencies
- Tooltips with detailed breakdown

#### Side Panel
- Lists incoming and outgoing dependencies
- Shows dependency type, status, and target information
- Navigate directly to dependency targets
- Create new dependencies with "Add" button

#### Filtering
- **Blocked** - Show only nodes that are blocked by others
- **Blocking** - Show only nodes that block others
- **No deps** - Show only nodes without dependencies
- **Analysis Mode** - Enable topological sorting

#### Analysis Mode
- Reorders tree based on dependency relationships
- Detects and highlights circular dependencies
- Shows warning banner for conflicts

#### Dependency Editor
- Search and select target nodes
- Choose relationship type (blocks/depends_on/related_to)
- AI-powered suggestions based on hierarchy
- Validation prevents invalid relationships

## Usage

### Basic Integration

```tsx
import { TreeViewWithDependencies } from '@/features/projects/dependencies';

function MyComponent() {
  return (
    <TreeViewWithDependencies
      projectId="project-id"
      onEpicClick={handleEpicClick}
      onStoryClick={handleStoryClick}
      onTaskClick={handleTaskClick}
    />
  );
}
```

### Individual Components

```tsx
import {
  HierarchyDependenciesPanel,
  DependencyBadge,
  DependencyFilters,
  useHierarchyDependencyStats
} from '@/features/projects/dependencies';

function CustomTreeView() {
  const { data: stats } = useHierarchyDependencyStats(projectId, nodes);

  return (
    <div className="flex">
      <div className="flex-1">
        {/* Tree with badges */}
        {nodes.map(node => (
          <div key={node.id}>
            {node.title}
            <DependencyBadge stats={stats?.get(node.nodeId)} />
          </div>
        ))}
      </div>

      <HierarchyDependenciesPanel
        selectedNode={selectedNode}
        onNavigateToNode={handleNavigate}
        onCreateDependency={handleCreate}
      />
    </div>
  );
}
```

## API Integration

The implementation leverages existing dependency APIs:

- `GET /api/projects/{id}/dependencies` - List project dependencies
- `GET /api/{type}s/{id}/dependencies` - Get entity dependencies
- `POST /api/dependencies` - Create new dependency
- `DELETE /api/dependencies/{id}` - Remove dependency
- `POST /api/dependencies/validate` - Validate before creation
- `GET /api/projects/{id}/dependencies/circular` - Check for cycles

## Performance Optimizations

- **ETag caching** for API responses
- **Result truncation** for large dependency lists
- **Pagination** support for scalability
- **Debounced queries** for responsive filtering
- **Optimistic updates** for immediate feedback

## Testing

Unit tests are provided for:

- `hierarchyDependencyService` - Core service functionality
- `useHierarchyDependencies` - React hook behavior
- Component rendering and interaction
- Topological sorting algorithms
- Circular dependency detection

Run tests with:
```bash
npm test -- dependencies
```

## Future Enhancements

- **Dependency graph visualization** - Visual network diagram
- **Bulk dependency operations** - Multi-select management
- **Dependency templates** - Pre-defined relationship patterns
- **Impact analysis** - Show cascade effects of changes
- **Export functionality** - Export dependency reports

## Technical Notes

### Node ID Format
Dependencies use consistent node IDs: `{type}-{id}` (e.g., `task-123`, `epic-456`)

### Topological Sorting
Uses Kahn's algorithm for dependency ordering, with cycle detection and graceful fallback.

### Filter Integration
Dependency filters integrate seamlessly with existing hierarchy filters, combining results appropriately.

### Performance Considerations
- Dependency stats are cached and updated only when dependencies change
- Topological sorting is only performed when analysis mode is active
- Large dependency lists are paginated and truncated for performance