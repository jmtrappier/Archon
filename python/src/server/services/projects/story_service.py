"""
Story Service Module for Archon-TRAXIS

This module provides core business logic for story operations following
the TaskService patterns for consistency.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from src.server.utils import get_supabase_client

from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class StoryService:
    """Service class for story operations"""

    VALID_STATUSES = ["todo", "doing", "review", "waiting", "done"]
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

    def validate_priority(self, priority: str) -> tuple[bool, str]:
        """Validate story priority"""
        if priority not in self.VALID_PRIORITIES:
            return (
                False,
                f"Invalid priority '{priority}'. Must be one of: {', '.join(self.VALID_PRIORITIES)}",
            )
        return True, ""

    def validate_acceptance_criteria(self, criteria: list[str]) -> tuple[bool, str]:
        """Validate acceptance criteria format"""
        if criteria is not None:
            if not isinstance(criteria, list):
                return False, "Acceptance criteria must be a list of strings"
            for item in criteria:
                if not isinstance(item, str) or len(item.strip()) == 0:
                    return False, "Each acceptance criterion must be a non-empty string"
        return True, ""

    async def create_story(
        self,
        epic_id: str,
        title: str,
        description: str = "",
        status: str = "todo",
        priority: str = "medium",
        mvp_flag: bool = False,
        acceptance_criteria: list[str] | None = None,
        business_value: dict[str, Any] | None = None,
        story_points: int | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a new story under an epic.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Validate inputs
            if not title or not isinstance(title, str) or len(title.strip()) == 0:
                return False, {"error": "Story title is required and must be a non-empty string"}

            if not epic_id or not isinstance(epic_id, str):
                return False, {"error": "Epic ID is required and must be a string"}

            # Validate epic exists
            epic_response = (
                self.supabase_client.table("archon_epics")
                .select("id, project_id, archived")
                .eq("id", epic_id)
                .single()
                .execute()
            )

            if not epic_response.data:
                return False, {"error": f"Epic with ID {epic_id} not found"}

            epic = epic_response.data
            if epic.get("archived"):
                return False, {"error": f"Cannot create story under archived epic {epic_id}"}

            # Validate status
            is_valid, error_msg = self.validate_status(status)
            if not is_valid:
                return False, {"error": error_msg}

            # Validate priority
            is_valid, error_msg = self.validate_priority(priority)
            if not is_valid:
                return False, {"error": error_msg}

            # Validate acceptance criteria
            is_valid, error_msg = self.validate_acceptance_criteria(acceptance_criteria)
            if not is_valid:
                return False, {"error": error_msg}

            # Create the story
            response = self.supabase_client.table("archon_stories").insert({
                "epic_id": epic_id,
                "project_id": epic["project_id"],  # Inherit from epic
                "title": title.strip(),
                "description": description.strip() if description else "",
                "status": status,
                "priority": priority,
                "mvp_flag": mvp_flag,
                "acceptance_criteria": acceptance_criteria or [],
                "business_value": business_value or {},
                "story_points": story_points,
                "progress": 0.0,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }).execute()

            if response.data:
                created_story = response.data[0]
                logger.info(f"Story created successfully: {created_story['id']}")

                # Trigger epic progress recalculation
                from src.server.services.projects.epic_service import EpicService
                epic_service = EpicService(self.supabase_client)
                await epic_service.calculate_epic_progress(epic_id)

                return True, {"story": created_story}
            else:
                return False, {"error": "Failed to create story"}

        except Exception as e:
            logger.error(f"Error creating story: {str(e)}")
            return False, {"error": f"Error creating story: {str(e)}"}

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
        business_value: dict[str, Any] | None = None,
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

            if business_value is not None:
                update_data["business_value"] = business_value

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

            if mvp_only:
                query = query.eq("mvp_flag", True)

            if not include_archived:
                query = query.eq("archived", False)

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
                .eq("archived", False)
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

            # Update story progress
            update_response = (
                self.supabase_client.table("archon_stories")
                .update({
                    "progress": progress,
                    "updated_at": datetime.now().isoformat(),
                })
                .eq("id", story_id)
                .execute()
            )

            if update_response.data:
                logger.info(f"Story {story_id} progress updated to {progress:.1f}%")
                return True, {"progress": progress, "story_id": story_id}
            else:
                return False, {"error": f"Failed to update progress for story {story_id}"}

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
                .eq("archived", False)
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