# API Design Standards - Archon TRAXIS

**Version**: 1.0
**Date**: 15 septembre 2025
**Status**: Foundation Documentation (STORY 02.00)

## 🎯 Overview

This document establishes REST API design standards for Archon TRAXIS, ensuring consistency across all hierarchical endpoints (Projects, Epics, Stories, Tasks, Subtasks).

## 🗺️ API Structure & Routing

### Base URL Pattern
```
/api/[resource]/[id]/[sub-resource]/[sub-id]
```

### Hierarchical Resource Structure
```
/api/projects/{project_id}
/api/projects/{project_id}/epics
/api/projects/{project_id}/epics/{epic_id}
/api/epics/{epic_id}/stories
/api/epics/{epic_id}/stories/{story_id}
/api/stories/{story_id}/tasks
/api/tasks/{task_id}/subtasks
```

## 📋 Standard CRUD Operations

### 1. CREATE Operations (POST)

#### Pattern
```http
POST /api/projects/{project_id}/[resource]
Content-Type: application/json

{
  "title": "Required string",
  "description": "Optional string",
  // Resource-specific fields
}
```

#### Response Format
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "title": "string",
  "description": "string",
  "status": "todo",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  // Resource-specific fields
}
```

#### Status Codes
- **201 Created**: Resource created successfully
- **400 Bad Request**: Validation errors
- **404 Not Found**: Parent resource not found
- **409 Conflict**: Resource already exists (if applicable)

### 2. READ Operations (GET)

#### Single Resource
```http
GET /api/[resource]/{id}
```

#### Collection with Filters
```http
GET /api/projects/{project_id}/[resource]?status=todo&assignee=User&limit=50&offset=0
```

#### Standard Query Parameters
- `status`: Filter by status values
- `assignee`: Filter by assignee
- `limit`: Pagination limit (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)
- `search`: Text search in title/description
- `sort`: Sort order (created_at, updated_at, title, priority)
- `order`: asc/desc (default: desc)

#### Response Format (Collection)
```json
{
  "data": [
    {
      "id": "uuid",
      // Resource fields
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "has_more": true
  },
  "filters_applied": {
    "status": "todo",
    "assignee": "User"
  }
}
```

### 3. UPDATE Operations (PUT)

#### Pattern
```http
PUT /api/[resource]/{id}
Content-Type: application/json

{
  "title": "Updated title",
  "status": "doing"
  // Only fields to update
}
```

#### Response
- **200 OK**: Updated resource object
- **400 Bad Request**: Validation errors
- **404 Not Found**: Resource not found

### 4. DELETE Operations (DELETE)

#### Soft Delete Pattern
```http
DELETE /api/[resource]/{id}
```

#### Response
- **200 OK**: `{"message": "Resource archived successfully"}`
- **404 Not Found**: Resource not found

**Note**: All deletes are SOFT DELETES (archived=true)

## 🔧 Request/Response Models

### Standard Request Models (Pydantic)

```python
class Create[Resource]Request(BaseModel):
    title: str
    description: str | None = None
    status: str | None = "todo"
    # Resource-specific fields

class Update[Resource]Request(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    # All fields optional for updates
```

### Implemented Request Models

#### Projects
- `CreateProjectRequest` ✅
- `UpdateProjectRequest` ✅

#### Epics
- `CreateEpicRequest` ✅ (`priority`, `business_value`)
- `UpdateEpicRequest` ✅

#### Stories
- `CreateStoryRequest` ✅ (`epic_id`, `acceptance_criteria`, `business_value`)
- `UpdateStoryRequest` ✅

#### Tasks
- `CreateTaskRequest` ✅ (`story_id`, `parent_task_id`, `feature`)
- `UpdateTaskRequest` ✅

## 🛡️ Validation Standards

### Field Validation Rules

#### Required Fields
- `title`: 1-200 characters, non-empty
- `project_id`: Valid UUID, existing project

#### Optional Fields
- `description`: 0-2000 characters
- `status`: Must be in VALID_STATUSES
- `priority`: Must be in VALID_PRIORITIES (if applicable)

#### Status Values (Standardized)
```python
VALID_STATUSES = ["todo", "doing", "review", "waiting", "done"]
```

#### Priority Values (Where Applicable)
```python
VALID_PRIORITIES = ["low", "medium", "high", "critical"]
PRIORITY_MAPPING = {"low": 25, "medium": 50, "high": 75, "critical": 100}
```

### Validation Error Response
```json
{
  "detail": "Validation error",
  "errors": [
    {
      "field": "title",
      "message": "Title is required",
      "code": "REQUIRED_FIELD"
    },
    {
      "field": "status",
      "message": "Invalid status 'invalid'. Must be one of: todo, doing, review, waiting, done",
      "code": "INVALID_VALUE"
    }
  ]
}
```

## 🏷️ ETag & Caching

### ETag Implementation
```python
from ..utils.etag_utils import check_etag, generate_etag

@router.get("/api/resource/{id}")
async def get_resource(id: str, if_none_match: str | None = Header(None)):
    resource = await service.get_resource(id)
    etag = generate_etag(resource)

    if check_etag(if_none_match, etag):
        return Response(status_code=304)  # Not Modified

    return Response(
        content=json.dumps(resource),
        headers={"ETag": etag}
    )
```

### Cache Headers
- **ETag**: Content-based hash for cache validation
- **Cache-Control**: `private, must-revalidate`
- **304 Not Modified**: When content unchanged

## 🔗 Hierarchical Relationships

### Foreign Key Validation
All endpoints MUST validate parent relationships:

```python
# Epic belongs to Project
epic_data = await epic_service.create_epic(project_id, data)

# Story belongs to Epic
story_data = await story_service.create_story(epic_id, data)

# Task belongs to Story (and optionally parent Task)
task_data = await task_service.create_task(
    project_id=project_id,
    story_id=story_id,
    parent_task_id=parent_task_id  # For subtasks
)
```

### Relationship Endpoints

#### Get Resources by Parent
```http
GET /api/projects/{project_id}/epics
GET /api/epics/{epic_id}/stories
GET /api/stories/{story_id}/tasks
GET /api/tasks/{task_id}/subtasks
```

#### Move Resources Between Parents
```http
PUT /api/epics/{epic_id}/move
{
  "new_project_id": "uuid"
}

PUT /api/stories/{story_id}/move
{
  "new_epic_id": "uuid"
}

PUT /api/tasks/{task_id}/move
{
  "new_story_id": "uuid",
  "new_parent_task_id": "uuid"  // Optional
}
```

## 📊 Standard HTTP Status Codes

### Success Codes
- **200 OK**: Successful GET, PUT, DELETE
- **201 Created**: Successful POST
- **304 Not Modified**: ETag cache hit

### Client Error Codes
- **400 Bad Request**: Validation errors, malformed request
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (duplicate, constraint violation)
- **422 Unprocessable Entity**: Business logic validation failed

### Server Error Codes
- **500 Internal Server Error**: Unexpected server error
- **503 Service Unavailable**: Service temporarily unavailable

## 🔍 Error Handling Pattern

### Standard Error Response
```json
{
  "detail": "Human-readable error message",
  "error_code": "MACHINE_READABLE_CODE",
  "timestamp": "2025-09-15T21:30:00Z",
  "request_id": "uuid",
  "resource": "epics",
  "resource_id": "uuid"
}
```

### Error Codes Registry
- `VALIDATION_ERROR`: Field validation failed
- `RESOURCE_NOT_FOUND`: Resource does not exist
- `PARENT_NOT_FOUND`: Parent resource does not exist
- `DUPLICATE_RESOURCE`: Resource already exists
- `HIERARCHY_VIOLATION`: Invalid hierarchical relationship
- `STATUS_TRANSITION_INVALID`: Invalid status change
- `PERMISSION_DENIED`: Insufficient permissions

## 🎯 API Standards Compliance Checklist

For any new endpoint, ensure:

- [ ] **RESTful routes**: Follows hierarchical URL pattern
- [ ] **Request models**: Pydantic models with validation
- [ ] **Response format**: Consistent JSON structure
- [ ] **Status codes**: Appropriate HTTP status codes
- [ ] **Error handling**: Standard error response format
- [ ] **ETag support**: Caching headers implemented
- [ ] **Pagination**: limit/offset for collections
- [ ] **Filtering**: Standard query parameters
- [ ] **FK validation**: Parent relationships validated
- [ ] **Soft delete**: archived/archived_at pattern
- [ ] **Logging**: Request/response logging
- [ ] **Documentation**: OpenAPI/Swagger annotations

## 🚀 Implemented Endpoints Status

### ✅ Projects API
- `GET/POST/PUT/DELETE /api/projects`
- `GET /api/projects/{id}`

### ✅ Epics API
- `GET/POST /api/projects/{project_id}/epics`
- `GET/PUT/DELETE /api/epics/{id}`

### ✅ Stories API
- `GET/POST /api/epics/{epic_id}/stories`
- `GET/PUT/DELETE /api/stories/{id}`

### ✅ Tasks API (Enhanced)
- `GET/POST /api/tasks` (with project_id, story_id filters)
- `GET/PUT/DELETE /api/tasks/{id}`
- `GET/POST /api/tasks/{id}/subtasks`

### 🔄 Advanced Endpoints (Future)
- Dependency management endpoints
- Bulk operations endpoints
- Advanced search and filtering
- Hierarchy navigation endpoints

---
**Maintainer**: Backend Team
**Review Cycle**: After each API addition
**Related**: `service-patterns.md`, `error-handling.md`