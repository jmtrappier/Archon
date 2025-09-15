# Error Handling Standards - Archon TRAXIS

**Version**: 1.0
**Date**: 15 septembre 2025
**Status**: Foundation Documentation (STORY 02.00)

## 🎯 Overview

This document establishes comprehensive error handling standards for Archon TRAXIS backend, ensuring consistent error management across all hierarchical services and APIs.

## 🏗️ Error Handling Architecture

### Error Categories

#### 1. Validation Errors (400 Bad Request)
- Field validation failures
- Required field missing
- Invalid data format
- Business rule violations

#### 2. Not Found Errors (404 Not Found)
- Resource does not exist
- Parent resource not found
- Invalid resource ID

#### 3. Conflict Errors (409 Conflict)
- Duplicate resource
- Constraint violations
- Unique key conflicts

#### 4. Authorization Errors (401/403)
- Authentication required
- Insufficient permissions
- Access denied

#### 5. Server Errors (500 Internal Server Error)
- Database connection failures
- Unexpected exceptions
- Service unavailable

## 📋 Standard Error Response Format

### API Error Response Structure
```json
{
  "detail": "Human-readable error message",
  "error_code": "MACHINE_READABLE_CODE",
  "timestamp": "2025-09-15T21:30:00Z",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "resource": "epics",
  "resource_id": "epic_uuid",
  "validation_errors": [
    {
      "field": "title",
      "message": "Title is required",
      "code": "REQUIRED_FIELD"
    }
  ]
}
```

### Service Layer Error Response
```python
def create_error_response(
    detail: str,
    error_code: str,
    resource: str = None,
    resource_id: str = None,
    validation_errors: list = None
) -> dict:
    """Create standardized error response"""
    return {
        "detail": detail,
        "error_code": error_code,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "request_id": str(uuid4()),
        "resource": resource,
        "resource_id": resource_id,
        "validation_errors": validation_errors or []
    }
```

## 🔧 Service Layer Error Handling

### Standard Exception Pattern
```python
class EpicServiceError(Exception):
    """Base exception for EpicService errors"""
    def __init__(self, message: str, error_code: str = "EPIC_SERVICE_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)

class EpicNotFoundError(EpicServiceError):
    """Epic not found error"""
    def __init__(self, epic_id: str):
        super().__init__(
            f"Epic with ID {epic_id} not found",
            "EPIC_NOT_FOUND"
        )

class EpicValidationError(EpicServiceError):
    """Epic validation error"""
    def __init__(self, field: str, message: str):
        super().__init__(
            f"Validation error for field '{field}': {message}",
            "EPIC_VALIDATION_ERROR"
        )
```

### Service Method Error Handling
```python
async def create_epic(
    self,
    project_id: str,
    title: str,
    description: str = "",
    **kwargs
) -> dict[str, Any]:
    """Create new epic with comprehensive error handling"""
    try:
        # Validation
        if not title or len(title.strip()) == 0:
            raise EpicValidationError("title", "Title is required")

        # Validate status
        status = kwargs.get("status", "todo")
        is_valid, error_msg = self.validate_status(status)
        if not is_valid:
            raise EpicValidationError("status", error_msg)

        # Validate parent exists
        if not await self._validate_project_exists(project_id):
            raise EpicServiceError(
                f"Project with ID {project_id} not found",
                "PARENT_NOT_FOUND"
            )

        # Generate unique code
        code = await self._generate_next_epic_code(project_id)

        # Database operation
        epic_data = {
            "project_id": project_id,
            "title": title.strip(),
            "description": description.strip(),
            "status": status,
            "code": code,
            # ... other fields
        }

        result = await self.supabase_client.table("archon_epics").insert(epic_data).execute()

        if result.data is None or len(result.data) == 0:
            logger.error(f"Database error creating epic: {result}")
            raise EpicServiceError(
                "Failed to create epic due to database error",
                "DATABASE_ERROR"
            )

        created_epic = result.data[0]
        logger.info(f"Epic created successfully: {created_epic['id']}")
        return created_epic

    except EpicServiceError:
        # Re-raise our custom errors
        raise
    except Exception as e:
        # Catch-all for unexpected errors
        logger.error(f"Unexpected error creating epic: {str(e)}")
        raise EpicServiceError(
            f"Unexpected error creating epic: {str(e)}",
            "UNEXPECTED_ERROR"
        )
```

## 🌐 API Layer Error Handling

### FastAPI Exception Handlers
```python
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

@app.exception_handler(EpicServiceError)
async def epic_service_error_handler(request: Request, exc: EpicServiceError):
    """Handle EpicService errors"""
    status_code = 400  # Default for validation errors

    if exc.error_code == "EPIC_NOT_FOUND":
        status_code = 404
    elif exc.error_code == "PARENT_NOT_FOUND":
        status_code = 404
    elif exc.error_code == "DATABASE_ERROR":
        status_code = 500
    elif exc.error_code == "UNEXPECTED_ERROR":
        status_code = 500

    return JSONResponse(
        status_code=status_code,
        content=create_error_response(
            detail=exc.message,
            error_code=exc.error_code,
            resource="epics"
        )
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle FastAPI HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(
            detail=exc.detail,
            error_code=f"HTTP_{exc.status_code}"
        )
    )
```

### API Endpoint Error Handling
```python
@router.post("/api/projects/{project_id}/epics", response_model=dict)
async def create_epic(
    project_id: str,
    request: CreateEpicRequest,
) -> dict[str, Any]:
    """Create epic with proper error handling"""
    try:
        epic_service = EpicService()
        epic = await epic_service.create_epic(
            project_id=project_id,
            title=request.title,
            description=request.description or "",
            status=request.status or "todo",
            priority=request.priority or "medium"
        )

        logger.info(f"Epic created via API: {epic['id']}")
        return epic

    except EpicValidationError as e:
        logger.warning(f"Validation error: {e.message}")
        raise HTTPException(
            status_code=400,
            detail=e.message
        )
    except EpicServiceError as e:
        if e.error_code == "EPIC_NOT_FOUND":
            raise HTTPException(status_code=404, detail=e.message)
        elif e.error_code == "DATABASE_ERROR":
            raise HTTPException(status_code=500, detail=e.message)
        else:
            raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected API error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )
```

## 📊 Error Code Registry

### Standard Error Codes

#### Validation Errors (4xx)
- `VALIDATION_ERROR`: General validation failure
- `REQUIRED_FIELD`: Required field missing
- `INVALID_VALUE`: Invalid field value
- `FIELD_TOO_LONG`: Field exceeds maximum length
- `FIELD_TOO_SHORT`: Field below minimum length
- `INVALID_FORMAT`: Invalid data format (email, UUID, etc.)

#### Resource Errors (4xx)
- `RESOURCE_NOT_FOUND`: Requested resource does not exist
- `PARENT_NOT_FOUND`: Parent resource does not exist
- `DUPLICATE_RESOURCE`: Resource already exists
- `RESOURCE_CONFLICT`: Resource state conflict

#### Hierarchy Errors (4xx)
- `HIERARCHY_VIOLATION`: Invalid hierarchical relationship
- `CIRCULAR_DEPENDENCY`: Circular reference detected
- `ORPHAN_RESOURCE`: Resource would become orphaned
- `INVALID_PARENT`: Invalid parent relationship

#### Business Logic Errors (4xx)
- `STATUS_TRANSITION_INVALID`: Invalid status change
- `PERMISSION_DENIED`: Insufficient permissions
- `OPERATION_NOT_ALLOWED`: Operation not permitted in current state
- `CONSTRAINT_VIOLATION`: Business rule constraint violated

#### System Errors (5xx)
- `DATABASE_ERROR`: Database operation failed
- `CONNECTION_ERROR`: External service connection failed
- `TIMEOUT_ERROR`: Operation timed out
- `UNEXPECTED_ERROR`: Unexpected system error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable

### Error Code Mapping
```python
ERROR_CODE_TO_STATUS = {
    # Validation errors
    "VALIDATION_ERROR": 400,
    "REQUIRED_FIELD": 400,
    "INVALID_VALUE": 400,
    "FIELD_TOO_LONG": 400,
    "FIELD_TOO_SHORT": 400,
    "INVALID_FORMAT": 400,

    # Resource errors
    "RESOURCE_NOT_FOUND": 404,
    "PARENT_NOT_FOUND": 404,
    "DUPLICATE_RESOURCE": 409,
    "RESOURCE_CONFLICT": 409,

    # Hierarchy errors
    "HIERARCHY_VIOLATION": 422,
    "CIRCULAR_DEPENDENCY": 422,
    "ORPHAN_RESOURCE": 422,
    "INVALID_PARENT": 422,

    # Business logic errors
    "STATUS_TRANSITION_INVALID": 422,
    "PERMISSION_DENIED": 403,
    "OPERATION_NOT_ALLOWED": 422,
    "CONSTRAINT_VIOLATION": 422,

    # System errors
    "DATABASE_ERROR": 500,
    "CONNECTION_ERROR": 502,
    "TIMEOUT_ERROR": 504,
    "UNEXPECTED_ERROR": 500,
    "SERVICE_UNAVAILABLE": 503,
}
```

## 🔍 Logging Standards

### Structured Logging Pattern
```python
from ...config.logfire_config import get_logger
logger = get_logger(__name__)

# Success operations
logger.info(f"Epic created successfully", extra={
    "epic_id": epic["id"],
    "project_id": project_id,
    "operation": "create_epic",
    "user": "system"
})

# Validation errors
logger.warning(f"Validation error in create_epic", extra={
    "project_id": project_id,
    "field": "title",
    "error": "Title is required",
    "operation": "create_epic"
})

# System errors
logger.error(f"Database error in create_epic", extra={
    "project_id": project_id,
    "operation": "create_epic",
    "error": str(e),
    "traceback": traceback.format_exc()
})
```

### Log Levels
- **DEBUG**: Detailed flow information
- **INFO**: Successful operations
- **WARNING**: Validation errors, recoverable issues
- **ERROR**: System errors, database failures
- **CRITICAL**: Service unavailable, data corruption

## 🧪 Error Testing Strategy

### Unit Test Error Scenarios
```python
@pytest.mark.asyncio
async def test_create_epic_missing_title(self, epic_service):
    """Test epic creation with missing title"""
    with pytest.raises(EpicValidationError, match="Title is required"):
        await epic_service.create_epic(
            project_id=str(uuid4()),
            title="",  # Empty title
            description="Test"
        )

@pytest.mark.asyncio
async def test_create_epic_invalid_status(self, epic_service):
    """Test epic creation with invalid status"""
    with pytest.raises(EpicValidationError, match="Invalid status"):
        await epic_service.create_epic(
            project_id=str(uuid4()),
            title="Test Epic",
            status="invalid_status"
        )

@pytest.mark.asyncio
async def test_create_epic_parent_not_found(self, epic_service):
    """Test epic creation with non-existent parent"""
    fake_project_id = str(uuid4())
    with pytest.raises(EpicServiceError, match="Project.*not found"):
        await epic_service.create_epic(
            project_id=fake_project_id,
            title="Test Epic"
        )
```

### Integration Test Error Scenarios
```python
def test_api_create_epic_validation_error(client):
    """Test API validation error response"""
    response = client.post(
        f"/api/projects/{project_id}/epics",
        json={"title": ""}  # Empty title
    )

    assert response.status_code == 400
    error_data = response.json()
    assert error_data["error_code"] == "VALIDATION_ERROR"
    assert "title" in error_data["detail"].lower()

def test_api_create_epic_not_found(client):
    """Test API parent not found error"""
    fake_project_id = str(uuid4())
    response = client.post(
        f"/api/projects/{fake_project_id}/epics",
        json={"title": "Test Epic"}
    )

    assert response.status_code == 404
    error_data = response.json()
    assert error_data["error_code"] == "PARENT_NOT_FOUND"
```

## 🎯 Error Handling Checklist

For any new service/endpoint, ensure:

- [ ] **Custom exceptions**: Service-specific exception classes
- [ ] **Validation errors**: All field validations raise appropriate errors
- [ ] **Parent validation**: FK relationships validated with clear errors
- [ ] **Database errors**: Proper handling of DB operation failures
- [ ] **Logging**: Structured logging for all error scenarios
- [ ] **API mapping**: Exception to HTTP status code mapping
- [ ] **Error responses**: Consistent error response format
- [ ] **Error codes**: Unique error codes for all scenarios
- [ ] **Error tests**: Unit tests for all error conditions
- [ ] **Documentation**: Error scenarios documented

## 🚀 Implementation Status

### ✅ Implemented Error Handling
- **EpicService**: Validation, parent checking, database errors ✅
- **StoryService**: Epic FK validation, acceptance criteria validation ✅
- **TaskService**: Hierarchy validation, circular dependency prevention ✅
- **Projects API**: HTTP exception mapping, structured responses ✅

### 🔄 In Progress
- **Centralized error registry**: Global error code management
- **Error monitoring**: Integration with monitoring systems
- **Error analytics**: Error frequency and pattern analysis

### 🎯 Future Enhancements
- **Error recovery**: Automatic retry mechanisms
- **Circuit breakers**: Service resilience patterns
- **Error reporting**: User-friendly error reporting
- **Error documentation**: Auto-generated error documentation

---
**Maintainer**: Backend Team
**Review Cycle**: After each service addition
**Related**: `service-patterns.md`, `api-design-standards.md`, `testing-strategy.md`