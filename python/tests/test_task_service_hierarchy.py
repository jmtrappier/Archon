"""
Test suite for TaskService Hierarchical Extensions
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

from src.server.services.projects.task_service import TaskService


class TestTaskServiceHierarchy:
    """Test cases for TaskService hierarchical extensions"""

    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client"""
        mock = Mock()
        return mock

    @pytest.fixture
    def task_service(self, mock_supabase):
        """Create a TaskService instance with mock Supabase client"""
        return TaskService(supabase_client=mock_supabase)

    @pytest.mark.asyncio
    async def test_get_tasks_by_story_success(self, task_service, mock_supabase):
        """Test successful retrieval of tasks by story"""
        story_id = str(uuid4())
        task_id = str(uuid4())

        # Mock story exists
        mock_story_response = Mock()
        mock_story_response.data = {
            "id": story_id,
            "title": "Test Story",
            "epic_id": str(uuid4())
        }

        # Mock tasks response
        mock_tasks_response = Mock()
        mock_tasks_response.data = [{
            "id": task_id,
            "story_id": story_id,
            "title": "Test Task",
            "status": "todo"
        }]

        # Setup mock chain
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_story_response
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = mock_tasks_response

        # Mock get_task_subtasks_recursive for include_subtasks
        async def mock_get_subtasks(task_id):
            return True, {"subtasks": []}

        with patch.object(task_service, 'get_task_subtasks_recursive', side_effect=mock_get_subtasks):
            success, result = await task_service.get_tasks_by_story(
                story_id=story_id,
                include_subtasks=True
            )

        assert success is True
        assert "story" in result
        assert "tasks" in result
        assert result["story"]["id"] == story_id
        assert len(result["tasks"]) == 1
        assert result["tasks"][0]["id"] == task_id

    @pytest.mark.asyncio
    async def test_get_tasks_by_story_not_found(self, task_service, mock_supabase):
        """Test get_tasks_by_story when story doesn't exist"""
        story_id = str(uuid4())

        # Mock story not found
        mock_story_response = Mock()
        mock_story_response.data = None

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_story_response

        success, result = await task_service.get_tasks_by_story(story_id)

        assert success is False
        assert "error" in result
        assert f"Story with ID {story_id} not found" in result["error"]

    @pytest.mark.asyncio
    async def test_get_subtasks_by_task_success(self, task_service, mock_supabase):
        """Test successful retrieval of subtasks by task"""
        task_id = str(uuid4())

        # Mock parent task exists
        mock_parent_response = Mock()
        mock_parent_response.data = {
            "id": task_id,
            "title": "Parent Task",
            "story_id": str(uuid4()),
            "project_id": str(uuid4())
        }

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_parent_response

        # Mock get_task_subtasks_recursive
        async def mock_get_subtasks(task_id, max_depth=10, exclude_large_fields=False, include_archived=False):
            return True, {
                "subtasks": [
                    {"id": str(uuid4()), "title": "Subtask 1"},
                    {"id": str(uuid4()), "title": "Subtask 2"}
                ],
                "levels_count": 2
            }

        with patch.object(task_service, 'get_task_subtasks_recursive', side_effect=mock_get_subtasks):
            success, result = await task_service.get_subtasks_by_task(task_id)

        assert success is True
        assert "parent_task" in result
        assert "subtasks" in result
        assert result["parent_task"]["id"] == task_id
        assert len(result["subtasks"]) == 2
        assert result["total_count"] == 2
        assert result["max_depth_reached"] == 2

    @pytest.mark.asyncio
    async def test_validate_hierarchy_consistency_cycle_detected(self, task_service, mock_supabase):
        """Test cycle detection in hierarchy validation"""
        task_id = str(uuid4())
        parent_task_id = str(uuid4())

        # Mock get_task_hierarchy_path to return a path that includes task_id
        async def mock_get_hierarchy_path(parent_id):
            # The hierarchy path for parent should include the task_id to create a cycle
            return True, {
                "hierarchy": [
                    {"id": task_id, "title": "Current Task"},  # This creates the cycle
                    {"id": parent_id, "title": "Parent Task"}
                ]
            }

        with patch.object(task_service, 'get_task_hierarchy_path', side_effect=mock_get_hierarchy_path):
            success, result = await task_service.validate_hierarchy_consistency(
                task_id=task_id,
                parent_task_id=parent_task_id
            )

        assert success is True
        assert result["is_valid"] is False
        assert len(result["validation_errors"]) == 1
        assert result["validation_errors"][0]["type"] == "cycle_detected"

    @pytest.mark.asyncio
    async def test_validate_hierarchy_consistency_max_depth_exceeded(self, task_service, mock_supabase):
        """Test max depth validation"""
        task_id = str(uuid4())
        parent_task_id = str(uuid4())

        # Mock get_task_hierarchy_path to return a deep hierarchy
        async def mock_get_hierarchy_path(parent_id):
            return True, {
                "hierarchy": [{"id": str(uuid4()), "title": f"Level {i}"} for i in range(11)]  # 11 levels
            }

        with patch.object(task_service, 'get_task_hierarchy_path', side_effect=mock_get_hierarchy_path):
            success, result = await task_service.validate_hierarchy_consistency(
                task_id=task_id,
                parent_task_id=parent_task_id
            )

        assert success is True
        assert result["is_valid"] is False
        assert len(result["validation_errors"]) == 1
        assert result["validation_errors"][0]["type"] == "max_depth_exceeded"

    @pytest.mark.asyncio
    async def test_validate_hierarchy_consistency_story_mismatch(self, task_service, mock_supabase):
        """Test story consistency validation"""
        task_id = str(uuid4())
        parent_task_id = str(uuid4())
        story_id = str(uuid4())
        parent_story_id = str(uuid4())

        # Mock get_task_hierarchy_path (no cycle)
        async def mock_get_hierarchy_path(task_id):
            return True, {"hierarchy": []}

        # Mock parent task response with different story_id
        mock_parent_response = Mock()
        mock_parent_response.data = {
            "story_id": parent_story_id,
            "project_id": str(uuid4())
        }

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_parent_response

        with patch.object(task_service, 'get_task_hierarchy_path', side_effect=mock_get_hierarchy_path):
            success, result = await task_service.validate_hierarchy_consistency(
                task_id=task_id,
                parent_task_id=parent_task_id,
                story_id=story_id
            )

        assert success is True
        assert result["is_valid"] is False
        assert len(result["validation_errors"]) == 1
        assert result["validation_errors"][0]["type"] == "story_mismatch"

    @pytest.mark.asyncio
    async def test_validate_hierarchy_consistency_valid(self, task_service, mock_supabase):
        """Test successful hierarchy validation"""
        task_id = str(uuid4())
        parent_task_id = str(uuid4())
        story_id = str(uuid4())

        # Mock get_task_hierarchy_path (no cycle, reasonable depth)
        async def mock_get_hierarchy_path(task_id):
            return True, {
                "hierarchy": [{"id": str(uuid4()), "title": "Parent"}]  # Only 1 level
            }

        # Mock parent task response with same story_id
        mock_parent_response = Mock()
        mock_parent_response.data = {
            "story_id": story_id,
            "project_id": str(uuid4())
        }

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_parent_response

        with patch.object(task_service, 'get_task_hierarchy_path', side_effect=mock_get_hierarchy_path):
            success, result = await task_service.validate_hierarchy_consistency(
                task_id=task_id,
                parent_task_id=parent_task_id,
                story_id=story_id
            )

        assert success is True
        assert result["is_valid"] is True
        assert len(result["validation_errors"]) == 0

    @pytest.mark.asyncio
    async def test_get_tasks_with_epic_story_info_success(self, task_service, mock_supabase):
        """Test getting tasks with epic and story information"""
        project_id = str(uuid4())
        story_id = str(uuid4())
        epic_id = str(uuid4())

        # Mock tasks response
        mock_tasks_response = Mock()
        mock_tasks_response.data = [{
            "id": str(uuid4()),
            "project_id": project_id,
            "story_id": story_id,
            "title": "Test Task",
            "status": "todo"
        }]

        # Mock story response
        mock_story_response = Mock()
        mock_story_response.data = {
            "id": story_id,
            "title": "Test Story",
            "epic_id": epic_id
        }

        # Mock epic response
        mock_epic_response = Mock()
        mock_epic_response.data = {
            "id": epic_id,
            "title": "Test Epic",
            "project_id": project_id
        }

        # Setup mock chain for tasks query
        mock_query = Mock()
        mock_query.eq.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.execute.return_value = mock_tasks_response

        mock_supabase.table.return_value.select.return_value = mock_query

        # Setup mock chain for story and epic queries
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = [
            mock_story_response,  # First call for story
            mock_epic_response    # Second call for epic
        ]

        success, result = await task_service.get_tasks_with_epic_story_info(
            project_id=project_id
        )

        assert success is True
        assert "tasks" in result
        assert len(result["tasks"]) == 1

        task = result["tasks"][0]
        assert "story_info" in task
        assert "epic_info" in task
        assert task["story_info"]["id"] == story_id
        assert task["epic_info"]["id"] == epic_id

    @pytest.mark.asyncio
    async def test_update_task_with_hierarchy_validation_success(self, task_service, mock_supabase):
        """Test successful task update with hierarchy validation"""
        task_id = str(uuid4())
        story_id = str(uuid4())

        # Mock validation success
        async def mock_validate_hierarchy(task_id, parent_task_id=None, story_id=None):
            return True, {
                "is_valid": True,
                "validation_errors": []
            }

        # Mock update response
        mock_update_response = Mock()
        mock_update_response.data = [{
            "id": task_id,
            "story_id": story_id,
            "title": "Updated Task"
        }]

        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update_response

        # Mock StoryService for progress calculation
        with patch.object(task_service, 'validate_hierarchy_consistency', side_effect=mock_validate_hierarchy):
            with patch('src.server.services.projects.story_service.StoryService') as MockStoryService:
                mock_story_service = Mock()
                MockStoryService.return_value = mock_story_service

                async def mock_calculate_progress(story_id):
                    return True, {"progress": 50.0}

                mock_story_service.calculate_story_progress = mock_calculate_progress

                success, result = await task_service.update_task_with_hierarchy_validation(
                    task_id=task_id,
                    story_id=story_id,
                    title="Updated Task"
                )

        assert success is True
        assert "task" in result
        assert result["task"]["id"] == task_id

    @pytest.mark.asyncio
    async def test_update_task_with_hierarchy_validation_failed(self, task_service, mock_supabase):
        """Test task update with failed hierarchy validation"""
        task_id = str(uuid4())
        parent_task_id = str(uuid4())

        # Mock validation failure
        async def mock_validate_hierarchy(task_id, parent_task_id=None, story_id=None):
            return True, {
                "is_valid": False,
                "validation_errors": [{
                    "type": "cycle_detected",
                    "message": "Would create cycle"
                }]
            }

        with patch.object(task_service, 'validate_hierarchy_consistency', side_effect=mock_validate_hierarchy):
            success, result = await task_service.update_task_with_hierarchy_validation(
                task_id=task_id,
                parent_task_id=parent_task_id
            )

        assert success is False
        assert "error" in result
        assert "Hierarchy validation failed" in result["error"]
        assert "validation_errors" in result

    def test_list_tasks_with_story_id_filter(self, task_service, mock_supabase):
        """Test list_tasks with story_id filter"""
        project_id = str(uuid4())
        story_id = str(uuid4())
        task_id = str(uuid4())

        # Mock task data that will be returned
        mock_task_data = [{
            "id": task_id,
            "project_id": project_id,
            "story_id": story_id,
            "title": "Test Task",
            "description": "Test Description",
            "status": "todo",
            "assignee": "User",
            "task_order": 0,
            "feature": None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "archived": False,
            "sources": [],
            "code_examples": []
        }]

        # Mock response
        mock_response = Mock()
        mock_response.data = mock_task_data

        # Mock query chain - make sure it returns real Mock objects, not further nesting
        mock_query = Mock()
        mock_query.eq.return_value = mock_query
        mock_query.neq.return_value = mock_query
        mock_query.or_.return_value = mock_query  # Add missing or_ mock
        mock_query.order.return_value = mock_query
        mock_query.execute.return_value = mock_response

        # Mock the table chain
        mock_table = Mock()
        mock_table.select.return_value = mock_query
        mock_supabase.table.return_value = mock_table

        success, result = task_service.list_tasks(
            project_id=project_id,
            story_id=story_id
        )

        assert success is True
        assert "tasks" in result
        assert len(result["tasks"]) == 1
        assert result["tasks"][0]["story_id"] == story_id
        assert f"story_id={story_id}" in result["filters_applied"]

    def test_list_tasks_with_epic_id_filter(self, task_service, mock_supabase):
        """Test list_tasks with epic_id filter"""
        project_id = str(uuid4())
        story_id = str(uuid4())
        epic_id = str(uuid4())
        task_id = str(uuid4())

        # Mock task data that will be returned (with story_id)
        mock_task_data = [{
            "id": task_id,
            "project_id": project_id,
            "story_id": story_id,
            "title": "Test Task",
            "description": "Test Description",
            "status": "todo",
            "assignee": "User",
            "task_order": 0,
            "feature": None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "archived": False,
            "sources": [],
            "code_examples": []
        }]

        # Mock tasks response
        mock_tasks_response = Mock()
        mock_tasks_response.data = mock_task_data

        # Mock story response for epic filtering
        mock_story_response = Mock()
        mock_story_response.data = {"epic_id": epic_id}

        # Setup mock behavior for table calls
        def mock_table_side_effect(table_name):
            if table_name == "archon_tasks":
                mock_table = Mock()
                mock_query = Mock()
                mock_query.eq.return_value = mock_query
                mock_query.neq.return_value = mock_query
                mock_query.or_.return_value = mock_query  # Add missing or_ mock
                mock_query.order.return_value = mock_query
                mock_query.execute.return_value = mock_tasks_response
                mock_table.select.return_value = mock_query
                return mock_table
            elif table_name == "archon_stories":
                mock_table = Mock()
                mock_query = Mock()
                mock_query.eq.return_value = mock_query
                mock_query.single.return_value = mock_query
                mock_query.execute.return_value = mock_story_response
                mock_table.select.return_value = mock_query
                return mock_table

        mock_supabase.table.side_effect = mock_table_side_effect

        success, result = task_service.list_tasks(
            project_id=project_id,
            epic_id=epic_id
        )

        assert success is True
        assert "tasks" in result
        assert len(result["tasks"]) == 1  # Task should be included because its story belongs to the epic
        assert result["tasks"][0]["story_id"] == story_id
        assert f"epic_id={epic_id}" in result["filters_applied"]