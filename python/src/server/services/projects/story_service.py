"""
Story Service Module for Archon-TRAXIS

This module provides core business logic for story operations following
the BMAD standards defined in docs/backend/service-patterns.md.

Compliant with:
- Service patterns (docs/backend/service-patterns.md)
- API design standards (docs/backend/api-design-standards.md)
- Error handling (docs/backend/error-handling.md)
- Testing strategy (docs/backend/testing-strategy.md)
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4
import traceback

from src.server.utils import get_supabase_client
from ...config.logfire_config import get_logger

logger = get_logger(__name__)


# Custom Exceptions following docs/backend/error-handling.md
class StoryServiceError(Exception):
    """Base exception for StoryService errors"""
    def __init__(self, message: str, error_code: str = "STORY_SERVICE_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class StoryNotFoundError(StoryServiceError):
    """Story not found error"""
    def __init__(self, story_id: str):
        super().__init__(
            f"Story with ID {story_id} not found",
            "STORY_NOT_FOUND"
        )


class StoryValidationError(StoryServiceError):
    """Story validation error"""
    def __init__(self, field: str, message: str):
        self.field = field
        super().__init__(
            f"Validation error for field '{field}': {message}",
            "STORY_VALIDATION_ERROR"
        )


class ParentNotFoundError(StoryServiceError):
    """Parent resource not found error"""
    def __init__(self, parent_type: str, parent_id: str):
        super().__init__(
            f"{parent_type} with ID {parent_id} not found",
            "PARENT_NOT_FOUND"
        )


class StoryService:
    """Service class for story operations"""

    VALID_STATUSES = ["backlog", "todo", "doing", "review", "waiting", "done"]
    VALID_PRIORITIES = ["low", "medium", "high", "critical"]

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    def validate_status(self, status: str) -> tuple[bool, str]:
        """Validate story status"""
        if status not in self.VALID_STATUSES:
            return (
                False,
                f"Invalid status '{status}'. Must be one of: {', '.join(self.VALID_STATUSES)}",
            )
        return True, ""

    def validate_priority(self, priority: int) -> tuple[bool, str]:
        """Validate story priority (numeric 1-100)"""
        if not isinstance(priority, int):
            return False, "Priority must be an integer"
        if priority < 1 or priority > 100:
            return False, "Priority must be between 1 and 100"
        return True, ""

    def validate_acceptance_criteria(self, criteria: list[str]) -> tuple[bool, str]:
        """Validate acceptance criteria format - Returns (is_valid, error_message)"""
        if criteria is not None:
            if not isinstance(criteria, list):
                return False, "Acceptance criteria must be a list of strings"
            for item in criteria:
                if not isinstance(item, str) or len(item.strip()) == 0:
                    return False, "Each acceptance criterion must be a non-empty string"
        return True, ""

    def validate_title(self, title: str) -> tuple[bool, str]:
        """Validate story title - Returns (is_valid, error_message)"""
        if not isinstance(title, str):
            return False, "Title must be a string"
        if not title or len(title.strip()) == 0:
            return False, "Title is required and cannot be empty"
        if len(title.strip()) > 200:
            return False, "Title cannot exceed 200 characters"
        return True, ""


    async def _validate_epic_exists(self, epic_id: str) -> bool:
        """Validate epic exists - Returns True if exists"""
        try:
            result = (
                self.supabase_client.table("archon_epics")
                .select("id")
                .eq("id", epic_id)
                .execute()
            )
            if not result.data or len(result.data) == 0:
                return False
            # Epic exists and is valid
            return True
        except Exception as e:
            logger.error(f"Error validating epic existence: {str(e)}")
            return False

    async def create_story(
        self,
        epic_id: str,
        title: str,
        description: str = "",
        status: str = "backlog",
        priority: int = 50,
        acceptance_criteria: list[str] | None = None,
        story_points: int | None = None,
    ) -> dict[str, Any]:
        """
        Create a new story under an epic with comprehensive validation.

        Args:
            epic_id: UUID of the parent epic
            title: Story title (1-200 characters)
            description: Optional story description
            status: Story status (todo, doing, review, waiting, done)
            priority: Story priority (low, medium, high, critical)
            mvp_flag: Whether story is part of MVP
            acceptance_criteria: List of acceptance criteria
            story_points: Optional story point estimation

        Returns:
            Created story data

        Raises:
            StoryValidationError: For validation failures
            ParentNotFoundError: If epic doesn't exist
            StoryServiceError: For database or unexpected errors
        """
        try:
            # Comprehensive input validation
            if not epic_id or not isinstance(epic_id, str):
                raise StoryValidationError("epic_id", "Epic ID is required and must be a string")

            # Validate title
            is_valid, error_msg = self.validate_title(title)
            if not is_valid:
                raise StoryValidationError("title", error_msg)

            # Validate status
            is_valid, error_msg = self.validate_status(status)
            if not is_valid:
                raise StoryValidationError("status", error_msg)

            # Validate priority
            is_valid, error_msg = self.validate_priority(priority)
            if not is_valid:
                raise StoryValidationError("priority", error_msg)

            # Validate acceptance criteria
            is_valid, error_msg = self.validate_acceptance_criteria(acceptance_criteria)
            if not is_valid:
                raise StoryValidationError("acceptance_criteria", error_msg)


            # Validate parent epic exists and is not archived
            if not await self._validate_epic_exists(epic_id):
                raise ParentNotFoundError("Epic", epic_id)

            # Get epic details for project_id inheritance
            epic_response = (
                self.supabase_client.table("archon_epics")
                .select("id, project_id")
                .eq("id", epic_id)
                .single()
                .execute()
            )

            if not epic_response.data:
                raise ParentNotFoundError("Epic", epic_id)

            epic = epic_response.data
            logger.info(f"Creating story for epic {epic_id} in project {epic['project_id']}")

            # Prepare story data (matching current database schema)
            story_data = {
                "epic_id": epic_id,
                "project_id": epic["project_id"],  # Inherit from epic
                "title": title.strip(),
                "description": description.strip() if description else "",
                "status": status,
                "priority": priority,
                "acceptance_criteria": acceptance_criteria or [],
                "story_points": story_points,
            }

            # Database operation
            result = (
                self.supabase_client.table("archon_stories")
                .insert(story_data)
                .execute()
            )

            if result.data is None or len(result.data) == 0:
                logger.error(f"Database error creating story: {result}")
                raise StoryServiceError(
                    "Failed to create story due to database error",
                    "DATABASE_ERROR"
                )

            created_story = result.data[0]
            logger.info(f"Story created successfully: {created_story['id']}")

            # Trigger epic progress recalculation
            try:
                from .epic_service import EpicService
                epic_service = EpicService(self.supabase_client)
                await epic_service.calculate_epic_progress(epic_id)
            except Exception as e:
                logger.warning(f"Failed to update epic progress after story creation: {str(e)}")
                # Don't fail the story creation for this

            return created_story

        except StoryServiceError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            # Catch-all for unexpected errors
            logger.error(f"Unexpected error creating story: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise StoryServiceError(
                f"Unexpected error creating story: {str(e)}",
                "UNEXPECTED_ERROR"
            )

    async def get_story(self, story_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get a story by ID.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            response = (
                self.supabase_client.table("archon_stories")
                .select("*")
                .eq("id", story_id)
                .single()
                .execute()
            )

            if response.data:
                return True, {"story": response.data}
            else:
                return False, {"error": f"Story with ID {story_id} not found"}

        except Exception as e:
            logger.error(f"Error getting story: {str(e)}")
            return False, {"error": f"Error getting story: {str(e)}"}

    async def update_story(
        self,
        story_id: str,
        title: str | None = None,
        description: str | None = None,
        status: str | None = None,
        priority: str | None = None,
        mvp_flag: bool | None = None,
        acceptance_criteria: list[str] | None = None,
        story_points: int | None = None,
        archived: bool | None = None,
        archived_at: str | None = None,
        archived_by: str | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Update a story.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Get current story to find epic_id for progress update
            current_story_result = await self.get_story(story_id)
            if not current_story_result[0]:
                return current_story_result

            current_story = current_story_result[1]["story"]
            epic_id = current_story["epic_id"]
            old_status = current_story["status"]

            # Build update data
            update_data = {"updated_at": datetime.now().isoformat()}

            if title is not None:
                if not title or not isinstance(title, str) or len(title.strip()) == 0:
                    return False, {"error": "Story title must be a non-empty string"}
                update_data["title"] = title.strip()

            if description is not None:
                update_data["description"] = description.strip()

            if status is not None:
                is_valid, error_msg = self.validate_status(status)
                if not is_valid:
                    return False, {"error": error_msg}
                update_data["status"] = status

            if priority is not None:
                is_valid, error_msg = self.validate_priority(priority)
                if not is_valid:
                    return False, {"error": error_msg}
                update_data["priority"] = priority

            if mvp_flag is not None:
                update_data["mvp_flag"] = mvp_flag

            if acceptance_criteria is not None:
                is_valid, error_msg = self.validate_acceptance_criteria(acceptance_criteria)
                if not is_valid:
                    return False, {"error": error_msg}
                update_data["acceptance_criteria"] = acceptance_criteria


            if story_points is not None:
                update_data["story_points"] = story_points

            if archived is not None:
                update_data["archived"] = archived
                if archived:
                    update_data["archived_at"] = archived_at or datetime.now().isoformat()
                    update_data["archived_by"] = archived_by or "system"

            # Update the story
            response = (
                self.supabase_client.table("archon_stories")
                .update(update_data)
                .eq("id", story_id)
                .execute()
            )

            if response.data:
                updated_story = response.data[0]
                logger.info(f"Story updated successfully: {story_id}")

                # If status changed, trigger progress recalculation
                if status is not None and status != old_status:
                    await self.calculate_story_progress(story_id)

                    # Also update epic progress
                    from .epic_service import EpicService
                    epic_service = EpicService(self.supabase_client)
                    await epic_service.calculate_epic_progress(epic_id)

                return True, {"story": updated_story}
            else:
                return False, {"error": f"Story with ID {story_id} not found"}

        except Exception as e:
            logger.error(f"Error updating story: {str(e)}")
            return False, {"error": f"Error updating story: {str(e)}"}

    async def delete_story(self, story_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Delete a story (hard delete).

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Get story to find epic_id
            story_result = await self.get_story(story_id)
            if not story_result[0]:
                return story_result

            epic_id = story_result[1]["story"]["epic_id"]

            # Check if story has tasks
            tasks_response = (
                self.supabase_client.table("archon_tasks")
                .select("id")
                .eq("story_id", story_id)
                .execute()
            )

            if tasks_response.data and len(tasks_response.data) > 0:
                return False, {"error": f"Cannot delete story {story_id} - it has {len(tasks_response.data)} tasks"}

            # Delete the story
            response = (
                self.supabase_client.table("archon_stories")
                .delete()
                .eq("id", story_id)
                .execute()
            )

            if response.data:
                logger.info(f"Story deleted successfully: {story_id}")

                # Update epic progress
                from .epic_service import EpicService
                epic_service = EpicService(self.supabase_client)
                await epic_service.calculate_epic_progress(epic_id)

                return True, {"message": f"Story {story_id} deleted successfully"}
            else:
                return False, {"error": f"Story with ID {story_id} not found"}

        except Exception as e:
            logger.error(f"Error deleting story: {str(e)}")
            return False, {"error": f"Error deleting story: {str(e)}"}

    async def archive_story(
        self,
        story_id: str,
        archived_by: str = "system",
    ) -> tuple[bool, dict[str, Any]]:
        """
        Archive a story (soft delete).

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Check if story exists and is not already archived
            story_result = await self.get_story(story_id)
            if not story_result[0]:
                return story_result

            story = story_result[1]["story"]
            if story.get("archived"):
                return False, {"error": f"Story with ID {story_id} is already archived"}

            # Archive the story
            return await self.update_story(
                story_id=story_id,
                archived=True,
                archived_at=datetime.now().isoformat(),
                archived_by=archived_by,
            )

        except Exception as e:
            logger.error(f"Error archiving story: {str(e)}")
            return False, {"error": f"Error archiving story: {str(e)}"}

    async def list_stories(
        self,
        epic_id: str | None = None,
        project_id: str | None = None,
        status: str | None = None,
        priority: str | None = None,
        mvp_only: bool = False,
        include_archived: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[bool, dict[str, Any]]:
        """
        List stories with optional filters.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            query = self.supabase_client.table("archon_stories").select("*", count="exact")

            # Apply filters
            if epic_id:
                query = query.eq("epic_id", epic_id)

            if project_id:
                query = query.eq("project_id", project_id)

            if status:
                query = query.eq("status", status)

            if priority:
                query = query.eq("priority", priority)

            # Note: mvp_flag column doesn't exist in current schema
            # if mvp_only:
            #     query = query.eq("mvp_flag", True)

            # Note: archived column doesn't exist in current schema
            # if not include_archived:
            #     query = query.eq("archived", False)

            # Apply pagination and ordering
            query = query.order("created_at", desc=False)
            query = query.range(offset, offset + limit - 1)

            response = query.execute()

            if response.data is not None:
                return True, {
                    "stories": response.data,
                    "total_count": response.count if response.count is not None else len(response.data),
                }
            else:
                return True, {"stories": [], "total_count": 0}

        except Exception as e:
            logger.error(f"Error listing stories: {str(e)}")
            return False, {"error": f"Error listing stories: {str(e)}"}

    async def calculate_story_progress(self, story_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Calculate and update story progress based on its tasks.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Get all tasks for this story
            tasks_response = (
                self.supabase_client.table("archon_tasks")
                .select("status")
                .eq("story_id", story_id)
                # .eq("archived", False)  # Column doesn't exist in current schema
                .execute()
            )

            if not tasks_response.data:
                # No tasks, set progress to 0
                progress = 0.0
            else:
                # Calculate progress based on task statuses
                total_tasks = len(tasks_response.data)
                done_tasks = sum(1 for t in tasks_response.data if t["status"] == "done")
                progress = (done_tasks / total_tasks) * 100 if total_tasks > 0 else 0.0

            # Update story progress (progress column doesn't exist in current schema)
            # update_response = (
            #     self.supabase_client.table("archon_stories")
            #     .update({
            #         "progress": progress,
            #         "updated_at": datetime.now().isoformat(),
            #     })
            #     .eq("id", story_id)
            #     .execute()
            # )

            # For now, just return the calculated progress without storing it
            logger.info(f"Story {story_id} progress calculated as {progress:.1f}% (not stored - progress column doesn't exist)")
            return True, {"progress": progress, "story_id": story_id}

        except Exception as e:
            logger.error(f"Error calculating story progress: {str(e)}")
            return False, {"error": f"Error calculating story progress: {str(e)}"}

    async def get_story_tasks_count(self, story_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get count of tasks for a story grouped by status.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Get all tasks for this story
            tasks_response = (
                self.supabase_client.table("archon_tasks")
                .select("status")
                .eq("story_id", story_id)
                # .eq("archived", False)  # Column doesn't exist in current schema
                .execute()
            )

            # Count by status
            status_counts = {status: 0 for status in self.VALID_STATUSES}
            total_count = 0

            if tasks_response.data:
                for task in tasks_response.data:
                    status = task.get("status", "todo")
                    if status in status_counts:
                        status_counts[status] += 1
                        total_count += 1

            return True, {
                "story_id": story_id,
                "total_count": total_count,
                "status_counts": status_counts,
            }

        except Exception as e:
            logger.error(f"Error getting story tasks count: {str(e)}")
            return False, {"error": f"Error getting story tasks count: {str(e)}"}

    async def get_stories_by_epic(
        self,
        epic_id: str,
        include_tasks: bool = False,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all stories for an epic with optional task details.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Get stories for the epic
            stories_result = await self.list_stories(
                epic_id=epic_id,
                include_archived=False,
                limit=1000,  # Get all stories
            )

            if not stories_result[0]:
                return stories_result

            stories = stories_result[1]["stories"]

            # Optionally include task counts for each story
            if include_tasks:
                for story in stories:
                    tasks_count_result = await self.get_story_tasks_count(story["id"])
                    if tasks_count_result[0]:
                        story["tasks_summary"] = tasks_count_result[1]

            return True, {
                "epic_id": epic_id,
                "stories": stories,
                "total_count": len(stories),
            }

        except Exception as e:
            logger.error(f"Error getting stories by epic: {str(e)}")
            return False, {"error": f"Error getting stories by epic: {str(e)}"}

    async def get_all_epic_story_counts(self, project_id: str | None = None) -> tuple[bool, dict[str, Any]]:
        """
        Get story counts for all epics, grouped by status.
        Optimized to avoid N+1 queries by fetching all data in one query.

        Args:
            project_id: Optional project filter

        Returns:
            Tuple of (success, result_dict)
            Result format: {
                "epic_id": {
                    "todo": count,
                    "doing": count,
                    "review": count,
                    "waiting": count,
                    "done": count,
                    "backlog": count
                }
            }
        """
        try:
            # Build query to get all stories with epic_id
            query = (
                self.supabase_client.table("archon_stories")
                .select("epic_id, status")
            )

            # Apply project filter if provided
            if project_id:
                query = query.eq("project_id", project_id)

            # Execute query
            response = query.execute()

            if response.data is None:
                return True, {}

            # Initialize counts dictionary
            epic_counts = {}

            # Process each story and count by epic_id and status
            for story in response.data:
                epic_id = story["epic_id"]
                status = story.get("status", "todo")

                # Initialize epic entry if not exists
                if epic_id not in epic_counts:
                    epic_counts[epic_id] = {
                        "todo": 0,
                        "doing": 0,
                        "review": 0,
                        "waiting": 0,
                        "done": 0,
                        "backlog": 0
                    }

                # Increment count for this status
                if status in epic_counts[epic_id]:
                    epic_counts[epic_id][status] += 1
                else:
                    # Handle unknown statuses by defaulting to todo
                    epic_counts[epic_id]["todo"] += 1

            logger.info(f"Retrieved story counts for {len(epic_counts)} epics")
            return True, epic_counts

        except Exception as e:
            logger.error(f"Error getting all epic story counts: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False, {"error": f"Error getting all epic story counts: {str(e)}"}
