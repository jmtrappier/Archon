# Backend Service Patterns - Archon TRAXIS

**Version**: 1.0
**Date**: 15 septembre 2025
**Status**: Foundation Documentation (STORY 02.00)

## 🎯 Overview

This document standardizes the service patterns used in Archon TRAXIS backend, establishing consistent patterns for all hierarchy services (Projects, Epics, Stories, Tasks, Subtasks).

## 📋 Core Service Pattern

### Standard Service Class Structure

```python
class ServiceName:
    """Service class for [entity] operations"""

    # Constants - Always define valid values
    VALID_STATUSES = ["todo", "doing", "review", "waiting", "done"]
    VALID_PRIORITIES = ["low", "medium", "high", "critical"]  # If applicable
    PRIORITY_MAPPING = {"low": 25, "medium": 50, "high": 75, "critical": 100}

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()
```

### Standard Validation Methods

All services MUST implement these validation patterns:

```python
def validate_status(self, status: str) -> tuple[bool, str]:
    """Validate entity status - Returns (is_valid, error_message)"""
    if status not in self.VALID_STATUSES:
        return False, f"Invalid status '{status}'. Must be one of: {', '.join(self.VALID_STATUSES)}"
    return True, ""

def validate_[field](self, value: Any) -> tuple[bool, str]:
    """Standard validation pattern for all fields"""
    # Validation logic here
    return True, ""  # or False, "Error message"
```

### Standard CRUD Operations

Every hierarchical service MUST implement:

#### 1. Create Operation
```python
async def create_[entity](
    self,
    project_id: str,  # Always require project context
    title: str,
    description: str = "",
    # Entity-specific fields...
    **kwargs
) -> dict[str, Any]:
    """Create new entity with full validation"""
```

#### 2. Read Operations
```python
async def get_[entity](self, entity_id: str) -> dict[str, Any]:
    """Get single entity by ID"""

async def list_[entities](
    self,
    project_id: str,
    # Filtering options
    **filters
) -> list[dict[str, Any]]:
    """List entities with filtering and pagination"""
```

#### 3. Update Operation
```python
async def update_[entity](
    self,
    entity_id: str,
    updates: dict[str, Any]
) -> dict[str, Any]:
    """Update entity with validation"""
```

#### 4. Delete Operation (Soft Delete)
```python
async def delete_[entity](self, entity_id: str) -> dict[str, Any]:
    """Soft delete - set archived=true, archived_at=now"""
```

## 🏗️ Implemented Service Examples

### EpicService Pattern (Reference Implementation)
- ✅ **File**: `/python/src/server/services/projects/epic_service.py`
- ✅ **Features**: Auto-code generation, priority mapping, full CRUD
- ✅ **Validation**: Status, priority, business rules
- ✅ **Special**: `_generate_next_epic_code()` for unique codes

### TaskService Pattern (Established)
- ✅ **File**: `/python/src/server/services/projects/task_service.py`
- ✅ **Features**: Hierarchical relations (parent_task_id, story_id)
- ✅ **Validation**: Status, assignee, hierarchy consistency
- ✅ **Special**: Complex hierarchy operations

### StoryService Pattern (TRAXIS Addition)
- ✅ **File**: `/python/src/server/services/projects/story_service.py`
- ✅ **Features**: Epic relations, acceptance criteria JSONB
- ✅ **Validation**: Epic FK, story structure
- ✅ **Special**: Acceptance criteria validation

## 🔧 Code Generation Pattern

### Unique Code Generation (All Entities)
```python
async def _generate_next_[entity]_code(self, project_id: str) -> str:
    """Generate unique code for entity (E-XX, S-XX-YY, T-XX-YY-ZZ)"""
    # Query max existing code
    # Increment and format
    # Return formatted code
```

**Code Formats**:
- **Epics**: `E-01`, `E-02`, `E-03...`
- **Stories**: `S-01-01`, `S-01-02`, `S-02-01...`
- **Tasks**: `T-01-01-01`, `T-01-01-02...`

## 🛡️ Error Handling Pattern

### Standard Exception Handling
```python
try:
    # Database operation
    result = await self.supabase_client.table("table_name").operation()

    if result.data is None:
        logger.error(f"Database error: {result}")
        raise Exception(f"Failed to operation entity: {result}")

    return result.data

except Exception as e:
    logger.error(f"Error in operation: {str(e)}")
    raise Exception(f"Failed to operation: {str(e)}")
```

## 🔄 Hierarchical Relations Pattern

### Foreign Key Validation
```python
async def _validate_parent_exists(self, parent_id: str, parent_table: str) -> bool:
    """Validate parent entity exists"""
    result = await self.supabase_client.table(parent_table).select("id").eq("id", parent_id).execute()
    return len(result.data) > 0
```

### Hierarchy Consistency
- **Epic** → **Project** (project_id FK)
- **Story** → **Epic** (epic_id FK)
- **Task** → **Story** (story_id FK) + **Task** (parent_task_id FK for subtasks)

## 📊 Logging Pattern

```python
from ...config.logfire_config import get_logger
logger = get_logger(__name__)

# Standard logging points
logger.info(f"Creating {entity} for project {project_id}")
logger.error(f"Validation failed: {error_message}")
logger.debug(f"Database query result: {result}")
```

## 🎯 Standards Compliance Checklist

For any new service, ensure:

- [ ] **Class Structure**: Follows standard pattern
- [ ] **Constants**: VALID_STATUSES, VALID_PRIORITIES defined
- [ ] **Validation**: All fields have validate_X() methods
- [ ] **CRUD**: Full create/read/update/delete operations
- [ ] **Soft Delete**: Uses archived/archived_at pattern
- [ ] **Error Handling**: Standard try/catch with logging
- [ ] **FK Validation**: Parent relationships validated
- [ ] **Code Generation**: Unique codes if applicable
- [ ] **Logging**: Uses logfire_config logger
- [ ] **Type Hints**: Full type annotations

## 🚀 Next Steps

1. **Review existing services** against this pattern
2. **Refactor non-compliant** services to match
3. **Use as template** for new services
4. **Update as patterns evolve**

---
**Maintainer**: Backend Team
**Review Cycle**: After each major service addition
**Related**: `api-design-standards.md`, `testing-strategy.md`