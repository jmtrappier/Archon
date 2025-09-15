"""
Test suite for StoryService
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

from src.server.services.projects.story_service import StoryService


class TestStoryService:
    """Test cases for StoryService"""

    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client"""
        mock = Mock()
        return mock

    @pytest.fixture
    def story_service(self, mock_supabase):
        """Create a StoryService instance with mock Supabase client"""
        return StoryService(supabase_client=mock_supabase)

    def test_validate_status_valid(self, story_service):
        """Test status validation with valid status"""
        valid_statuses = ["todo", "doing", "review", "waiting", "done"]
        for status in valid_statuses:
            is_valid, error_msg = story_service.validate_status(status)
            assert is_valid is True
            assert error_msg == ""

    def test_validate_acceptance_criteria_valid(self, story_service):
        """Test acceptance criteria validation with valid data"""
        valid_criteria = [
            ["Criterion 1", "Criterion 2"],
            ["Single criterion"],
            None,  # None is valid
        ]
        for criteria in valid_criteria:
            is_valid, error_msg = story_service.validate_acceptance_criteria(criteria)
            assert is_valid is True
            assert error_msg == ""

    def test_validate_acceptance_criteria_invalid(self, story_service):
        """Test acceptance criteria validation with invalid data"""
        invalid_criteria = [
            "not a list",  # String instead of list
            [1, 2, 3],  # Numbers instead of strings
            ["", "Valid", ""],  # Empty strings
        ]
        for criteria in invalid_criteria:
            is_valid, error_msg = story_service.validate_acceptance_criteria(criteria)
            assert is_valid is False
            assert error_msg != ""

    @pytest.mark.asyncio
    async def test_create_story_success(self, story_service, mock_supabase):
        """Test successful story creation"""
        epic_id = str(uuid4())
        project_id = str(uuid4())
        story_id = str(uuid4())

        # Mock epic exists check
        mock_epic_response = Mock()
        mock_epic_response.data = {
            "id": epic_id,
            "project_id": project_id,
            "archived": False,
        }

        # Mock story creation response
        mock_story_response = Mock()
        mock_story_response.data = [{
            "id": story_id,
            "epic_id": epic_id,
            "title": "Test Story",
            "description": "Test Description",
            "status": "todo",
            "priority": "medium",
            "acceptance_criteria": ["Criterion 1", "Criterion 2"],
            "progress": 0.0,
        }]

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_epic_response
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_story_response

        # Mock EpicService.calculate_epic_progress to return an async coroutine
        with patch('src.server.services.projects.epic_service.EpicService') as MockEpicService:
            mock_epic_service = Mock()
            MockEpicService.return_value = mock_epic_service

            async def mock_calculate(epic_id):
                return (True, {"progress": 0.0})

            mock_epic_service.calculate_epic_progress = mock_calculate

            success, result = await story_service.create_story(
                epic_id=epic_id,
                title="Test Story",
                description="Test Description",
                acceptance_criteria=["Criterion 1", "Criterion 2"],
            )

        assert success is True
        assert "story" in result
        assert result["story"]["id"] == story_id
        assert result["story"]["title"] == "Test Story"
        assert len(result["story"]["acceptance_criteria"]) == 2

    @pytest.mark.asyncio
    async def test_create_story_epic_not_found(self, story_service, mock_supabase):
        """Test story creation when epic doesn't exist"""
        epic_id = str(uuid4())

        # Mock epic not found
        mock_epic_response = Mock()
        mock_epic_response.data = None

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_epic_response

        success, result = await story_service.create_story(
            epic_id=epic_id,
            title="Test Story",
        )

        assert success is False
        assert "error" in result
        assert f"Epic with ID {epic_id} not found" in result["error"]

    @pytest.mark.asyncio
    async def test_create_story_archived_epic(self, story_service, mock_supabase):
        """Test story creation under archived epic"""
        epic_id = str(uuid4())

        # Mock archived epic
        mock_epic_response = Mock()
        mock_epic_response.data = {
            "id": epic_id,
            "project_id": str(uuid4()),
            "archived": True,
        }

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_epic_response

        success, result = await story_service.create_story(
            epic_id=epic_id,
            title="Test Story",
        )

        assert success is False
        assert "error" in result
        assert "Cannot create story under archived epic" in result["error"]

    @pytest.mark.asyncio
    async def test_get_story_success(self, story_service, mock_supabase):
        """Test successful story retrieval"""
        story_id = str(uuid4())
        story_data = {
            "id": story_id,
            "title": "Test Story",
            "status": "todo",
        }

        mock_response = Mock()
        mock_response.data = story_data

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response

        success, result = await story_service.get_story(story_id)

        assert success is True
        assert "story" in result
        assert result["story"]["id"] == story_id

    @pytest.mark.asyncio
    async def test_update_story_with_status_change(self, story_service, mock_supabase):
        """Test story update with status change triggers progress calculation"""
        story_id = str(uuid4())
        epic_id = str(uuid4())

        # Mock get_story
        with patch.object(story_service, 'get_story', return_value=(
            True,
            {"story": {"id": story_id, "epic_id": epic_id, "status": "todo"}}
        )):
            # Mock update response
            mock_response = Mock()
            mock_response.data = [{
                "id": story_id,
                "status": "done",
            }]
            mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_response

            # Mock calculate_story_progress to return an async coroutine
            async def mock_calculate_story(story_id):
                return (True, {"progress": 100.0})

            with patch.object(story_service, 'calculate_story_progress', side_effect=mock_calculate_story):
                # Mock EpicService.calculate_epic_progress
                with patch('src.server.services.projects.epic_service.EpicService') as MockEpicService:
                    mock_epic_service = Mock()
                    MockEpicService.return_value = mock_epic_service

                    async def mock_calculate_epic(epic_id):
                        return (True, {"progress": 50.0})

                    mock_epic_service.calculate_epic_progress = mock_calculate_epic

                    success, result = await story_service.update_story(
                        story_id=story_id,
                        status="done",
                    )

        assert success is True
        assert "story" in result
        assert result["story"]["status"] == "done"

    @pytest.mark.asyncio
    async def test_delete_story_with_tasks(self, story_service, mock_supabase):
        """Test deleting story that has tasks"""
        story_id = str(uuid4())
        epic_id = str(uuid4())

        # Mock get_story
        with patch.object(story_service, 'get_story', return_value=(
            True,
            {"story": {"id": story_id, "epic_id": epic_id}}
        )):
            # Mock tasks response to have tasks
            mock_tasks_response = Mock()
            mock_tasks_response.data = [{"id": "task1"}, {"id": "task2"}]

            mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_tasks_response

            success, result = await story_service.delete_story(story_id)

        assert success is False
        assert "error" in result
        assert "Cannot delete story" in result["error"]
        assert "2 tasks" in result["error"]

    @pytest.mark.asyncio
    async def test_calculate_story_progress_no_tasks(self, story_service, mock_supabase):
        """Test progress calculation when story has no tasks"""
        story_id = str(uuid4())

        # Mock empty tasks response
        mock_tasks_response = Mock()
        mock_tasks_response.data = []

        # Mock update response
        mock_update_response = Mock()
        mock_update_response.data = [{"id": story_id, "progress": 0.0}]

        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_tasks_response
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update_response

        success, result = await story_service.calculate_story_progress(story_id)

        assert success is True
        assert result["progress"] == 0.0

    @pytest.mark.asyncio
    async def test_calculate_story_progress_with_tasks(self, story_service, mock_supabase):
        """Test progress calculation when story has tasks"""
        story_id = str(uuid4())

        # Mock tasks response with mixed statuses
        mock_tasks_response = Mock()
        mock_tasks_response.data = [
            {"status": "done"},
            {"status": "done"},
            {"status": "done"},
            {"status": "doing"},
            {"status": "todo"},
        ]

        # Mock update response
        mock_update_response = Mock()
        mock_update_response.data = [{"id": story_id, "progress": 60.0}]

        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_tasks_response
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update_response

        success, result = await story_service.calculate_story_progress(story_id)

        assert success is True
        assert result["progress"] == 60.0  # 3 done out of 5 = 60%

    @pytest.mark.asyncio
    async def test_archive_story_already_archived(self, story_service, mock_supabase):
        """Test archiving an already archived story"""
        story_id = str(uuid4())

        # Mock get_story to return archived story
        with patch.object(story_service, 'get_story', return_value=(
            True,
            {"story": {"id": story_id, "archived": True}}
        )):
            success, result = await story_service.archive_story(story_id)

        assert success is False
        assert "error" in result
        assert "already archived" in result["error"]

    @pytest.mark.asyncio
    async def test_list_stories_with_filters(self, story_service, mock_supabase):
        """Test listing stories with various filters"""
        epic_id = str(uuid4())

        # Create mock query chain
        mock_query = Mock()
        mock_response = Mock()
        mock_response.data = [
            {"id": "story1", "status": "todo"},
            {"id": "story2", "status": "todo"},
        ]
        mock_response.count = 2

        # Chain all the query methods
        mock_supabase.table.return_value.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.range.return_value = mock_query
        mock_query.execute.return_value = mock_response

        success, result = await story_service.list_stories(
            epic_id=epic_id,
            status="todo",
            priority="high",
            mvp_only=True,
            include_archived=False,
        )

        assert success is True
        assert "stories" in result
        assert len(result["stories"]) == 2
        assert result["total_count"] == 2

    @pytest.mark.asyncio
    async def test_get_stories_by_epic_with_tasks(self, story_service, mock_supabase):
        """Test getting stories by epic with task summaries"""
        epic_id = str(uuid4())

        # Mock list_stories
        with patch.object(story_service, 'list_stories', return_value=(
            True,
            {"stories": [
                {"id": "story1", "title": "Story 1"},
                {"id": "story2", "title": "Story 2"},
            ]}
        )):
            # Mock get_story_tasks_count
            with patch.object(story_service, 'get_story_tasks_count', side_effect=[
                (True, {"total_count": 5, "status_counts": {"done": 3, "todo": 2}}),
                (True, {"total_count": 3, "status_counts": {"done": 3}}),
            ]):
                success, result = await story_service.get_stories_by_epic(
                    epic_id=epic_id,
                    include_tasks=True,
                )

        assert success is True
        assert "stories" in result
        assert len(result["stories"]) == 2
        assert "tasks_summary" in result["stories"][0]
        assert result["stories"][0]["tasks_summary"]["total_count"] == 5