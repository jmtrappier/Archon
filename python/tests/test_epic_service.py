"""
Test suite for EpicService
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

from src.server.services.projects.epic_service import EpicService


class TestEpicService:
    """Test cases for EpicService"""

    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client"""
        mock = Mock()
        return mock

    @pytest.fixture
    def epic_service(self, mock_supabase):
        """Create an EpicService instance with mock Supabase client"""
        return EpicService(supabase_client=mock_supabase)

    def test_validate_status_valid(self, epic_service):
        """Test status validation with valid status"""
        valid_statuses = ["todo", "doing", "review", "waiting", "done"]
        for status in valid_statuses:
            is_valid, error_msg = epic_service.validate_status(status)
            assert is_valid is True
            assert error_msg == ""

    def test_validate_status_invalid(self, epic_service):
        """Test status validation with invalid status"""
        invalid_statuses = ["pending", "completed", "invalid", ""]
        for status in invalid_statuses:
            is_valid, error_msg = epic_service.validate_status(status)
            assert is_valid is False
            assert "Invalid status" in error_msg

    def test_validate_priority_valid(self, epic_service):
        """Test priority validation with valid priority"""
        valid_priorities = ["low", "medium", "high", "critical"]
        for priority in valid_priorities:
            is_valid, error_msg = epic_service.validate_priority(priority)
            assert is_valid is True
            assert error_msg == ""

    def test_validate_priority_invalid(self, epic_service):
        """Test priority validation with invalid priority"""
        invalid_priorities = ["urgent", "normal", "minor", ""]
        for priority in invalid_priorities:
            is_valid, error_msg = epic_service.validate_priority(priority)
            assert is_valid is False
            assert "Invalid priority" in error_msg

    @pytest.mark.asyncio
    async def test_create_epic_success(self, epic_service, mock_supabase):
        """Test successful epic creation"""
        project_id = str(uuid4())
        epic_id = str(uuid4())

        # Mock the insert response
        mock_response = Mock()
        mock_response.data = [{
            "id": epic_id,
            "project_id": project_id,
            "title": "Test Epic",
            "description": "Test Description",
            "status": "todo",
            "priority": "medium",
            "mvp_flag": False,
            "progress": 0.0,
        }]

        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_response

        success, result = await epic_service.create_epic(
            project_id=project_id,
            title="Test Epic",
            description="Test Description",
        )

        assert success is True
        assert "epic" in result
        assert result["epic"]["id"] == epic_id
        assert result["epic"]["title"] == "Test Epic"
        mock_supabase.table.assert_called_with("archon_epics")

    @pytest.mark.asyncio
    async def test_create_epic_invalid_title(self, epic_service, mock_supabase):
        """Test epic creation with invalid title"""
        success, result = await epic_service.create_epic(
            project_id=str(uuid4()),
            title="",  # Empty title
        )

        assert success is False
        assert "error" in result
        assert "title is required" in result["error"]

    @pytest.mark.asyncio
    async def test_create_epic_invalid_status(self, epic_service, mock_supabase):
        """Test epic creation with invalid status"""
        success, result = await epic_service.create_epic(
            project_id=str(uuid4()),
            title="Test Epic",
            status="invalid_status",
        )

        assert success is False
        assert "error" in result
        assert "Invalid status" in result["error"]

    @pytest.mark.asyncio
    async def test_get_epic_success(self, epic_service, mock_supabase):
        """Test successful epic retrieval"""
        epic_id = str(uuid4())
        epic_data = {
            "id": epic_id,
            "title": "Test Epic",
            "status": "todo",
        }

        mock_response = Mock()
        mock_response.data = epic_data

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response

        success, result = await epic_service.get_epic(epic_id)

        assert success is True
        assert "epic" in result
        assert result["epic"]["id"] == epic_id

    @pytest.mark.asyncio
    async def test_get_epic_not_found(self, epic_service, mock_supabase):
        """Test epic retrieval when epic doesn't exist"""
        epic_id = str(uuid4())

        mock_response = Mock()
        mock_response.data = None

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response

        success, result = await epic_service.get_epic(epic_id)

        assert success is False
        assert "error" in result
        assert f"Epic with ID {epic_id} not found" in result["error"]

    @pytest.mark.asyncio
    async def test_update_epic_success(self, epic_service, mock_supabase):
        """Test successful epic update"""
        epic_id = str(uuid4())

        mock_response = Mock()
        mock_response.data = [{
            "id": epic_id,
            "title": "Updated Epic",
            "status": "doing",
        }]

        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_response

        # Mock calculate_epic_progress
        with patch.object(epic_service, 'calculate_epic_progress', return_value=(True, {"progress": 50.0})):
            success, result = await epic_service.update_epic(
                epic_id=epic_id,
                title="Updated Epic",
                status="doing",
            )

        assert success is True
        assert "epic" in result
        assert result["epic"]["title"] == "Updated Epic"

    @pytest.mark.asyncio
    async def test_archive_epic_success(self, epic_service, mock_supabase):
        """Test successful epic archiving"""
        epic_id = str(uuid4())

        # Mock get_epic to return unarchived epic
        with patch.object(epic_service, 'get_epic', return_value=(True, {"epic": {"id": epic_id, "archived": False}})):
            # Mock update_epic
            with patch.object(epic_service, 'update_epic', return_value=(True, {"epic": {"id": epic_id, "archived": True}})):
                success, result = await epic_service.archive_epic(epic_id)

        assert success is True
        assert result["epic"]["archived"] is True

    @pytest.mark.asyncio
    async def test_archive_epic_already_archived(self, epic_service, mock_supabase):
        """Test archiving an already archived epic"""
        epic_id = str(uuid4())

        # Mock get_epic to return archived epic
        with patch.object(epic_service, 'get_epic', return_value=(True, {"epic": {"id": epic_id, "archived": True}})):
            success, result = await epic_service.archive_epic(epic_id)

        assert success is False
        assert "error" in result
        assert "already archived" in result["error"]

    @pytest.mark.asyncio
    async def test_delete_epic_with_stories(self, epic_service, mock_supabase):
        """Test deleting epic that has stories"""
        epic_id = str(uuid4())

        # Mock stories response to have stories
        mock_stories_response = Mock()
        mock_stories_response.data = [{"id": "story1"}, {"id": "story2"}]

        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_stories_response

        success, result = await epic_service.delete_epic(epic_id)

        assert success is False
        assert "error" in result
        assert "Cannot delete epic" in result["error"]
        assert "2 stories" in result["error"]

    @pytest.mark.asyncio
    async def test_calculate_epic_progress_no_stories(self, epic_service, mock_supabase):
        """Test progress calculation when epic has no stories"""
        epic_id = str(uuid4())

        # Mock empty stories response
        mock_stories_response = Mock()
        mock_stories_response.data = []

        # Mock update response
        mock_update_response = Mock()
        mock_update_response.data = [{"id": epic_id, "progress": 0.0}]

        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_stories_response
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update_response

        success, result = await epic_service.calculate_epic_progress(epic_id)

        assert success is True
        assert result["progress"] == 0.0

    @pytest.mark.asyncio
    async def test_calculate_epic_progress_with_stories(self, epic_service, mock_supabase):
        """Test progress calculation when epic has stories"""
        epic_id = str(uuid4())

        # Mock stories response with mixed statuses
        mock_stories_response = Mock()
        mock_stories_response.data = [
            {"status": "done"},
            {"status": "done"},
            {"status": "doing"},
            {"status": "todo"},
        ]

        # Mock update response
        mock_update_response = Mock()
        mock_update_response.data = [{"id": epic_id, "progress": 50.0}]

        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_stories_response
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update_response

        success, result = await epic_service.calculate_epic_progress(epic_id)

        assert success is True
        assert result["progress"] == 50.0  # 2 done out of 4 = 50%

    @pytest.mark.asyncio
    async def test_list_epics_with_filters(self, epic_service, mock_supabase):
        """Test listing epics with various filters"""
        project_id = str(uuid4())

        # Create mock query chain
        mock_query = Mock()
        mock_response = Mock()
        mock_response.data = [
            {"id": "epic1", "status": "todo"},
            {"id": "epic2", "status": "todo"},
        ]
        mock_response.count = 2

        # Chain all the query methods
        mock_supabase.table.return_value.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.range.return_value = mock_query
        mock_query.execute.return_value = mock_response

        success, result = await epic_service.list_epics(
            project_id=project_id,
            status="todo",
            priority="high",
            mvp_only=True,
            include_archived=False,
        )

        assert success is True
        assert "epics" in result
        assert len(result["epics"]) == 2
        assert result["total_count"] == 2