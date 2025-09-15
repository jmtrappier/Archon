# Backend Testing Strategy - Archon TRAXIS

**Version**: 1.0
**Date**: 15 septembre 2025
**Status**: Foundation Documentation (STORY 02.00)

## 🎯 Overview

This document establishes comprehensive testing standards for Archon TRAXIS backend, ensuring reliability and quality across all hierarchical services (Projects, Epics, Stories, Tasks, Subtasks).

## 🧪 Testing Architecture

### Test Structure
```
python/tests/
├── conftest.py                     # Global test configuration
├── test_[service_name].py          # Unit tests per service
├── server/
│   ├── services/
│   │   └── projects/
│   │       ├── test_epic_service.py    ✅
│   │       ├── test_story_service.py   ✅
│   │       └── test_task_service.py    ✅
│   └── api_routes/
│       └── test_projects_api.py        ✅
├── mcp_server/
│   └── features/
│       ├── test_project_tools.py       ✅
│       ├── test_document_tools.py      ✅
│       └── test_task_tools.py          ✅
└── integration/
    ├── test_hierarchy_flow.py          🔄
    └── test_end_to_end.py              🔄
```

## 📋 Testing Levels

### 1. Unit Tests (Service Layer)

#### Test Coverage Requirements
- **Validation methods**: 100% coverage
- **CRUD operations**: 100% coverage
- **Business logic**: 100% coverage
- **Error conditions**: 100% coverage

#### Standard Test Pattern
```python
import pytest
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

from src.server.services.projects.[service_name] import [ServiceName]

class Test[ServiceName]:
    """Test cases for [ServiceName]"""

    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client"""
        mock = Mock()
        return mock

    @pytest.fixture
    def service(self, mock_supabase):
        """Create service instance with mock Supabase client"""
        return [ServiceName](supabase_client=mock_supabase)
```

#### Required Test Categories

##### Validation Tests
```python
def test_validate_status_valid(self, service):
    """Test status validation with valid values"""
    valid_statuses = ["todo", "doing", "review", "waiting", "done"]
    for status in valid_statuses:
        is_valid, error_msg = service.validate_status(status)
        assert is_valid is True
        assert error_msg == ""

def test_validate_status_invalid(self, service):
    """Test status validation with invalid values"""
    invalid_statuses = ["pending", "completed", "invalid", ""]
    for status in invalid_statuses:
        is_valid, error_msg = service.validate_status(status)
        assert is_valid is False
        assert "Invalid status" in error_msg
```

##### CRUD Operation Tests
```python
@pytest.mark.asyncio
async def test_create_[entity]_success(self, service, mock_supabase):
    """Test successful entity creation"""
    # Setup mock response
    mock_supabase.table().insert().execute.return_value.data = [mock_entity]

    # Execute
    result = await service.create_[entity](project_id, title, description)

    # Assert
    assert result["id"] is not None
    assert result["title"] == title
    mock_supabase.table().insert().execute.assert_called_once()

@pytest.mark.asyncio
async def test_create_[entity]_validation_error(self, service):
    """Test entity creation with validation errors"""
    with pytest.raises(Exception, match="Invalid status"):
        await service.create_[entity](project_id, title, status="invalid")
```

### 2. Integration Tests (API Layer)

#### API Endpoint Testing
```python
from fastapi.testclient import TestClient
from src.server.main import app

client = TestClient(app)

def test_create_epic_endpoint():
    """Test POST /api/projects/{project_id}/epics"""
    response = client.post(
        f"/api/projects/{project_id}/epics",
        json={
            "title": "Test Epic",
            "description": "Test Description",
            "priority": "high"
        }
    )
    assert response.status_code == 201
    assert response.json()["title"] == "Test Epic"
```

#### Response Format Validation
```python
def test_epic_response_format(self):
    """Test epic response contains all required fields"""
    response = client.get(f"/api/epics/{epic_id}")
    data = response.json()

    required_fields = [
        "id", "project_id", "title", "description", "status",
        "priority", "created_at", "updated_at"
    ]
    for field in required_fields:
        assert field in data
```

### 3. Hierarchy Tests (Cross-Service)

#### Parent-Child Relationship Tests
```python
@pytest.mark.asyncio
async def test_epic_story_hierarchy(self):
    """Test Epic -> Story relationship"""
    # Create Epic
    epic = await epic_service.create_epic(project_id, "Test Epic")

    # Create Story under Epic
    story = await story_service.create_story(epic["id"], "Test Story")

    # Verify relationship
    assert story["epic_id"] == epic["id"]

    # Verify cascade operations
    stories = await story_service.list_stories_by_epic(epic["id"])
    assert len(stories) == 1
    assert stories[0]["id"] == story["id"]
```

#### Constraint Validation Tests
```python
@pytest.mark.asyncio
async def test_orphan_story_prevention(self):
    """Test story cannot be created with non-existent epic"""
    fake_epic_id = str(uuid4())

    with pytest.raises(Exception, match="Epic not found"):
        await story_service.create_story(fake_epic_id, "Orphan Story")
```

### 4. End-to-End Tests (Full Flow)

#### Complete Hierarchy Creation
```python
@pytest.mark.asyncio
async def test_complete_hierarchy_flow(self):
    """Test PROJECT → EPIC → STORY → TASK → SUBTASK flow"""
    # Create Project (via project service)
    project = await project_service.create_project("Test Project")

    # Create Epic
    epic = await epic_service.create_epic(project["id"], "Test Epic")

    # Create Story
    story = await story_service.create_story(epic["id"], "Test Story")

    # Create Task
    task = await task_service.create_task(
        project_id=project["id"],
        story_id=story["id"],
        title="Test Task"
    )

    # Create Subtask
    subtask = await task_service.create_task(
        project_id=project["id"],
        parent_task_id=task["id"],
        title="Test Subtask"
    )

    # Verify complete hierarchy
    assert task["story_id"] == story["id"]
    assert subtask["parent_task_id"] == task["id"]
```

## 🛠️ Testing Tools & Configuration

### Pytest Configuration (conftest.py)
```python
import pytest
import asyncio
from unittest.mock import Mock

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the session"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def mock_supabase_client():
    """Global mock Supabase client"""
    mock = Mock()
    mock.table.return_value.select.return_value.execute.return_value.data = []
    return mock
```

### Test Database Setup
```python
@pytest.fixture(scope="session")
async def test_database():
    """Setup test database with clean state"""
    # Setup test tables
    # Clean data between tests
    # Teardown after session
    pass
```

### Mock Strategies

#### Supabase Client Mocking
```python
@pytest.fixture
def mock_supabase_success(self):
    """Mock successful database operations"""
    mock = Mock()
    mock.table().insert().execute.return_value.data = [mock_entity]
    mock.table().select().execute.return_value.data = [mock_entity]
    mock.table().update().execute.return_value.data = [mock_entity]
    mock.table().delete().execute.return_value.data = [mock_entity]
    return mock

@pytest.fixture
def mock_supabase_error(self):
    """Mock database error conditions"""
    mock = Mock()
    mock.table().insert().execute.return_value.data = None
    mock.table().insert().execute.return_value.error = "Database error"
    return mock
```

## 🎯 Test Data Management

### Test Data Factories
```python
def create_test_project(**overrides):
    """Create test project data"""
    defaults = {
        "id": str(uuid4()),
        "title": "Test Project",
        "description": "Test Description",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    return {**defaults, **overrides}

def create_test_epic(**overrides):
    """Create test epic data"""
    defaults = {
        "id": str(uuid4()),
        "project_id": str(uuid4()),
        "title": "Test Epic",
        "description": "Test Description",
        "status": "todo",
        "priority": "medium",
        "code": "E-01"
    }
    return {**defaults, **overrides}
```

### Parametrized Tests
```python
@pytest.mark.parametrize("status", ["todo", "doing", "review", "waiting", "done"])
def test_status_transitions(self, service, status):
    """Test all valid status transitions"""
    is_valid, error = service.validate_status(status)
    assert is_valid is True

@pytest.mark.parametrize("priority,expected_value", [
    ("low", 25), ("medium", 50), ("high", 75), ("critical", 100)
])
def test_priority_mapping(self, service, priority, expected_value):
    """Test priority to numeric mapping"""
    assert service.PRIORITY_MAPPING[priority] == expected_value
```

## 📊 Test Coverage Standards

### Coverage Requirements
- **Unit Tests**: 95% minimum coverage
- **Integration Tests**: 90% critical path coverage
- **API Tests**: 100% endpoint coverage
- **E2E Tests**: 80% user journey coverage

### Coverage Measurement
```bash
# Run tests with coverage
pytest --cov=src/server/services/projects --cov-report=html --cov-report=term

# Coverage thresholds in pytest.ini
[tool:pytest]
addopts = --cov=src --cov-fail-under=95
```

## 🚀 Implemented Test Status

### ✅ Completed Tests
- **EpicService**: `test_epic_service.py` - 16 tests ✅
- **StoryService**: `test_story_service.py` - 14 tests ✅
- **TaskService**: `test_task_service_hierarchy.py` - 18 tests ✅
- **Projects API**: `test_projects_api_polling.py` - 12 tests ✅
- **MCP Tools**: `test_task_tools.py` - 22 tests ✅

### 🔄 In Progress Tests
- API endpoint integration tests
- Hierarchy constraint validation
- Error scenario coverage

### 🎯 Future Test Priorities
- Performance tests (load testing)
- Security tests (authorization, input validation)
- Database transaction tests
- Concurrent access tests

## 🏃‍♂️ Running Tests

### Local Development
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_epic_service.py

# Run with coverage
pytest --cov=src/server/services/projects

# Run only TRAXIS hierarchy tests
pytest tests/test_epic_service.py tests/test_story_service.py tests/test_task_service_hierarchy.py
```

### CI/CD Pipeline
```bash
# Full test suite with strict coverage
pytest --cov=src --cov-fail-under=95 --cov-report=xml
```

## 🎯 Testing Standards Checklist

For any new service/feature, ensure:

- [ ] **Unit tests**: All methods tested with success/error cases
- [ ] **Validation tests**: All field validations covered
- [ ] **CRUD tests**: Create, read, update, delete operations
- [ ] **Integration tests**: API endpoints tested
- [ ] **Hierarchy tests**: Parent-child relationships validated
- [ ] **Error tests**: Exception scenarios covered
- [ ] **Mock setup**: Proper mocking of external dependencies
- [ ] **Test data**: Factories for consistent test data
- [ ] **Coverage**: Meets minimum coverage requirements
- [ ] **Documentation**: Test purpose and scenarios documented

---
**Maintainer**: Backend Team
**Review Cycle**: After each major feature addition
**Related**: `service-patterns.md`, `error-handling.md`