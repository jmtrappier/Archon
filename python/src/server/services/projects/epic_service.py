"""
Epic Service Module for Archon-TRAXIS

This module provides core business logic for epic operations following
the TaskService patterns for consistency.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from src.server.utils import get_supabase_client

from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class EpicService:
    """Service class for epic operations"""

    VALID_STATUSES = ["todo", "doing", "review", "waiting", "done"]
    VALID_PRIORITIES = ["low", "medium", "high", "critical"]
    PRIORITY_MAPPING = {"low": 25, "medium": 50, "high": 75, "critical": 100}

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    def validate_status(self, status: str) -> tuple[bool, str]:
        """Validate epic status"""
        if status not in self.VALID_STATUSES:
            return (
                False,
                f"Invalid status '{status}'. Must be one of: {', '.join(self.VALID_STATUSES)}",
            )
        return True, ""

    def validate_priority(self, priority: str) -> tuple[bool, str]:
        """Validate epic priority"""
        if priority not in self.VALID_PRIORITIES:
            return (
                False,
                f"Invalid priority '{priority}'. Must be one of: {', '.join(self.VALID_PRIORITIES)}",
            )
        return True, ""

    async def create_epic(
        self,
        project_id: str,
        title: str,
        description: str = "",
        status: str = "todo",
        priority: str = "medium",
        # mvp_flag: bool = False,  # Not in TRAXIS schema
        business_value: dict[str, Any] | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a new epic under a project.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Validate inputs
            if not title or not isinstance(title, str) or len(title.strip()) == 0:
                return False, {"error": "Epic title is required and must be a non-empty string"}

            if not project_id or not isinstance(project_id, str):
                return False, {"error": "Project ID is required and must be a string"}

            # Validate status
            is_valid, error_msg = self.validate_status(status)
            if not is_valid:
                return False, {"error": error_msg}

            # Validate priority
            is_valid, error_msg = self.validate_priority(priority)
            if not is_valid:
                return False, {"error": error_msg}

            # Create the epic
            response = self.supabase_client.table("archon_epics").insert({
                "project_id": project_id,
                "title": title.strip(),
                "description": description.strip() if description else "",
                "status": status,
                "priority": self.PRIORITY_MAPPING[priority],
                # "mvp_flag": mvp_flag,  # Not in TRAXIS schema
                "business_value": business_value or {},
                "progress_percentage": 0,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }).execute()

            if response.data:
                created_epic = response.data[0]
                logger.info(f"Epic created successfully: {created_epic['id']}")
                return True, {"epic": created_epic}
            else:
                return False, {"error": "Failed to create epic"}

        except Exception as e:
            logger.error(f"Error creating epic: {str(e)}")
            return False, {"error": f"Error creating epic: {str(e)}"}

    async def get_epic(self, epic_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get an epic by ID.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            response = (
                self.supabase_client.table("archon_epics")
                .select("*")
                .eq("id", epic_id)
                .single()
                .execute()
            )

            if response.data:
                return True, {"epic": response.data}
            else:
                return False, {"error": f"Epic with ID {epic_id} not found"}

        except Exception as e:
            logger.error(f"Error getting epic: {str(e)}")
            return False, {"error": f"Error getting epic: {str(e)}"}

    async def update_epic(
        self,
        epic_id: str,
        title: str | None = None,
        description: str | None = None,
        status: str | None = None,
        priority: str | None = None,
        # mvp_flag: bool | None = None,  # Not in TRAXIS schema
        business_value: dict[str, Any] | None = None,
        # archived: bool | None = None,  # Not implemented in DB yet
        # archived_at: str | None = None,  # Not implemented in DB yet
        # archived_by: str | None = None,  # Not implemented in DB yet
    ) -> tuple[bool, dict[str, Any]]:
        """
        Update an epic.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Build update data
            update_data = {"updated_at": datetime.now().isoformat()}

            if title is not None:
                if not title or not isinstance(title, str) or len(title.strip()) == 0:
                    return False, {"error": "Epic title must be a non-empty string"}
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
                update_data["priority"] = self.PRIORITY_MAPPING[priority]

            # if mvp_flag is not None:  # Not in TRAXIS schema
            #     update_data["mvp_flag"] = mvp_flag

            if business_value is not None:
                update_data["business_value"] = business_value

            # Archiving not implemented in database schema yet
            # if archived is not None:
            #     update_data["archived"] = archived
            #     if archived:
            #         update_data["archived_at"] = archived_at or datetime.now().isoformat()
            #         update_data["archived_by"] = archived_by or "system"

            # Update the epic
            response = (
                self.supabase_client.table("archon_epics")
                .update(update_data)
                .eq("id", epic_id)
                .execute()
            )

            if response.data:
                updated_epic = response.data[0]
                logger.info(f"Epic updated successfully: {epic_id}")

                # If status changed, trigger progress recalculation
                if status is not None:
                    await self.calculate_epic_progress(epic_id)

                return True, {"epic": updated_epic}
            else:
                return False, {"error": f"Epic with ID {epic_id} not found"}

        except Exception as e:
            logger.error(f"Error updating epic: {str(e)}")
            return False, {"error": f"Error updating epic: {str(e)}"}

    async def delete_epic(self, epic_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Delete an epic (hard delete).

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Check if epic has stories
            stories_response = (
                self.supabase_client.table("archon_stories")
                .select("id")
                .eq("epic_id", epic_id)
                .execute()
            )

            if stories_response.data and len(stories_response.data) > 0:
                return False, {"error": f"Cannot delete epic {epic_id} - it has {len(stories_response.data)} stories"}

            # Delete the epic
            response = (
                self.supabase_client.table("archon_epics")
                .delete()
                .eq("id", epic_id)
                .execute()
            )

            if response.data:
                logger.info(f"Epic deleted successfully: {epic_id}")
                return True, {"message": f"Epic {epic_id} deleted successfully"}
            else:
                return False, {"error": f"Epic with ID {epic_id} not found"}

        except Exception as e:
            logger.error(f"Error deleting epic: {str(e)}")
            return False, {"error": f"Error deleting epic: {str(e)}"}

    async def archive_epic(
        self,
        epic_id: str,
        archived_by: str = "system",
    ) -> tuple[bool, dict[str, Any]]:
        """
        Archive an epic (soft delete).
        NOTE: Archiving functionality not implemented in database schema yet.

        Returns:
            Tuple of (success, result_dict)
        """
        return False, {"error": "Archiving functionality not implemented yet"}

    async def list_epics(
        self,
        project_id: str,
        status: str | None = None,
        priority: str | None = None,
        mvp_only: bool = False,
        include_archived: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[bool, dict[str, Any]]:
        """
        List epics for a project with optional filters.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            query = (
                self.supabase_client.table("archon_epics")
                .select("*", count="exact")
                .eq("project_id", project_id)
            )

            # Apply filters
            if status:
                query = query.eq("status", status)

            if priority:
                query = query.eq("priority", priority)

            # if mvp_only:  # Not in TRAXIS schema
            #     query = query.eq("mvp_flag", True)

            # Note: archived functionality not yet implemented in database schema

            # Apply pagination and ordering
            query = query.order("created_at", desc=False)
            query = query.range(offset, offset + limit - 1)

            response = query.execute()

            if response.data is not None:
                return True, {
                    "epics": response.data,
                    "total_count": response.count if response.count is not None else len(response.data),
                }
            else:
                return True, {"epics": [], "total_count": 0}

        except Exception as e:
            logger.error(f"Error listing epics: {str(e)}")
            return False, {"error": f"Error listing epics: {str(e)}"}

    async def calculate_epic_progress(self, epic_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Calculate and update epic progress based on its stories.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Get all stories for this epic
            stories_response = (
                self.supabase_client.table("archon_stories")
                .select("status")
                .eq("epic_id", epic_id)
                .execute()
            )

            if not stories_response.data:
                # No stories, set progress to 0
                progress = 0.0
            else:
                # Calculate progress based on story statuses
                total_stories = len(stories_response.data)
                done_stories = sum(1 for s in stories_response.data if s["status"] == "done")
                progress = (done_stories / total_stories) * 100 if total_stories > 0 else 0.0

            # Update epic progress
            update_response = (
                self.supabase_client.table("archon_epics")
                .update({
                    "progress_percentage": int(progress),
                    "updated_at": datetime.now().isoformat(),
                })
                .eq("id", epic_id)
                .execute()
            )

            if update_response.data:
                logger.info(f"Epic {epic_id} progress updated to {progress:.1f}%")
                return True, {"progress": progress, "epic_id": epic_id}
            else:
                return False, {"error": f"Failed to update progress for epic {epic_id}"}

        except Exception as e:
            logger.error(f"Error calculating epic progress: {str(e)}")
            return False, {"error": f"Error calculating epic progress: {str(e)}"}

    async def get_epic_stories_count(self, epic_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get count of stories for an epic grouped by status.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Get all stories for this epic
            stories_response = (
                self.supabase_client.table("archon_stories")
                .select("status")
                .eq("epic_id", epic_id)
                .execute()
            )

            # Count by status
            status_counts = {status: 0 for status in self.VALID_STATUSES}
            total_count = 0

            if stories_response.data:
                for story in stories_response.data:
                    status = story.get("status", "todo")
                    if status in status_counts:
                        status_counts[status] += 1
                        total_count += 1

            return True, {
                "epic_id": epic_id,
                "total_count": total_count,
                "status_counts": status_counts,
            }

        except Exception as e:
            logger.error(f"Error getting epic stories count: {str(e)}")
            return False, {"error": f"Error getting epic stories count: {str(e)}"}