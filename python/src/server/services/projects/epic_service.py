"""
Epic Service Module for Archon-TRAXIS

This module provides core business logic for epic operations following
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
        self.field = field
        super().__init__(
            f"Validation error for field '{field}': {message}",
            "EPIC_VALIDATION_ERROR"
        )


class ParentNotFoundError(EpicServiceError):
    """Parent resource not found error"""
    def __init__(self, parent_type: str, parent_id: str):
        super().__init__(
            f"{parent_type} with ID {parent_id} not found",
            "PARENT_NOT_FOUND"
        )


class EpicService:
    """Service class for epic operations"""

    VALID_STATUSES = ["todo", "doing", "review", "waiting", "done"]
    VALID_PRIORITIES = ["low", "medium", "high", "critical"]
    PRIORITY_MAPPING = {"low": 25, "medium": 50, "high": 75, "critical": 100}

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    def validate_status(self, status: str) -> tuple[bool, str]:
        """Validate epic status - Returns (is_valid, error_message)"""
        if not isinstance(status, str):
            return False, "Status must be a string"
        if status not in self.VALID_STATUSES:
            return (
                False,
                f"Invalid status '{status}'. Must be one of: {', '.join(self.VALID_STATUSES)}",
            )
        return True, ""

    def validate_priority(self, priority: str) -> tuple[bool, str]:
        """Validate epic priority - Returns (is_valid, error_message)"""
        if not isinstance(priority, str):
            return False, "Priority must be a string"
        if priority not in self.VALID_PRIORITIES:
            return (
                False,
                f"Invalid priority '{priority}'. Must be one of: {', '.join(self.VALID_PRIORITIES)}",
            )
        return True, ""

    def validate_title(self, title: str) -> tuple[bool, str]:
        """Validate epic title - Returns (is_valid, error_message)"""
        if not isinstance(title, str):
            return False, "Title must be a string"
        if not title or len(title.strip()) == 0:
            return False, "Title is required and cannot be empty"
        if len(title.strip()) > 200:
            return False, "Title cannot exceed 200 characters"
        return True, ""

    def validate_business_value(self, business_value: dict[str, Any]) -> tuple[bool, str]:
        """Validate business value format - Returns (is_valid, error_message)"""
        if business_value is not None and not isinstance(business_value, dict):
            return False, "Business value must be a dictionary"
        return True, ""

    async def _validate_project_exists(self, project_id: str) -> bool:
        """Validate project exists - Returns True if exists"""
        try:
            result = (
                self.supabase_client.table("archon_projects")
                .select("id")
                .eq("id", project_id)
                .execute()
            )
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Error validating project existence: {str(e)}")
            return False

    async def _generate_next_epic_code(self, project_id: str) -> str:
        """
        Generate the next unique epic code globally (due to DB unique constraint).

        Since the DB has a global unique constraint on 'code', we need to generate
        globally unique codes. This is a workaround until the constraint is fixed
        to be UNIQUE(project_id, code).

        Returns:
            String in format compatible with existing codes
        """
        try:
            # Get all existing codes globally and find the highest number
            response = (
                self.supabase_client.table("archon_epics")
                .select("code")
                .execute()
            )

            max_number = 0
            if response.data:
                for item in response.data:
                    code = item["code"]
                    try:
                        # Extract number from codes like "E-01", "E-02", etc.
                        if code.startswith("E-") and len(code.split("-")) == 2:
                            number = int(code.split("-")[1])
                            max_number = max(max_number, number)
                    except (ValueError, IndexError):
                        # Skip malformed codes
                        continue

            # Generate next sequential number
            next_number = max_number + 1
            return f"E-{next_number:02d}"

        except Exception as e:
            logger.warning(f"Error generating epic code: {str(e)}")
            # Use timestamp as fallback to ensure uniqueness
            import time
            timestamp = int(time.time()) % 10000
            return f"E-{timestamp:04d}"

    async def create_epic(
        self,
        project_id: str,
        title: str,
        description: str = "",
        status: str = "todo",
        priority: str = "medium",
        business_value: dict[str, Any] | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a new epic under a project with comprehensive validation.

        Args:
            project_id: UUID of the parent project
            title: Epic title (1-200 characters)
            description: Optional epic description
            status: Epic status (todo, doing, review, waiting, done)
            priority: Epic priority (low, medium, high, critical)
            business_value: Optional business value metadata

        Returns:
            Created epic data

        Raises:
            EpicValidationError: For validation failures
            ParentNotFoundError: If project doesn't exist
            EpicServiceError: For database or unexpected errors
        """
        try:
            # Comprehensive input validation
            if not project_id or not isinstance(project_id, str):
                raise EpicValidationError("project_id", "Project ID is required and must be a string")

            # Validate title
            is_valid, error_msg = self.validate_title(title)
            if not is_valid:
                raise EpicValidationError("title", error_msg)

            # Validate status
            is_valid, error_msg = self.validate_status(status)
            if not is_valid:
                raise EpicValidationError("status", error_msg)

            # Validate priority
            is_valid, error_msg = self.validate_priority(priority)
            if not is_valid:
                raise EpicValidationError("priority", error_msg)

            # Validate business_value
            is_valid, error_msg = self.validate_business_value(business_value)
            if not is_valid:
                raise EpicValidationError("business_value", error_msg)

            # Validate parent project exists
            if not await self._validate_project_exists(project_id):
                raise ParentNotFoundError("Project", project_id)

            # Generate unique epic code
            epic_code = await self._generate_next_epic_code(project_id)
            logger.info(f"Creating epic for project {project_id} with code {epic_code}")

            # Prepare epic data
            epic_data = {
                "project_id": project_id,
                "title": title.strip(),
                "description": description.strip() if description else "",
                "status": status,
                "priority": self.PRIORITY_MAPPING[priority],
                "code": epic_code,
                "business_value": business_value or {},
                "progress_percentage": 0,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

            # Database operation
            result = (
                self.supabase_client.table("archon_epics")
                .insert(epic_data)
                .execute()
            )

            if result.data is None or len(result.data) == 0:
                logger.error(f"Database error creating epic: {result}")
                raise EpicServiceError(
                    "Failed to create epic due to database error",
                    "DATABASE_ERROR"
                )

            created_epic = result.data[0]
            logger.info(f"Epic created successfully: {created_epic['id']}")
            return True, {"epic": created_epic}

        except EpicServiceError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            # Catch-all for unexpected errors
            logger.error(f"Unexpected error creating epic: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise EpicServiceError(
                f"Unexpected error creating epic: {str(e)}",
                "UNEXPECTED_ERROR"
            )

    async def get_epic(self, epic_id: str) -> dict[str, Any]:
        """
        Get an epic by ID.

        Args:
            epic_id: UUID of the epic to retrieve

        Returns:
            Epic data

        Raises:
            EpicNotFoundError: If epic doesn't exist
            EpicServiceError: For database or unexpected errors
        """
        try:
            if not epic_id or not isinstance(epic_id, str):
                raise EpicValidationError("epic_id", "Epic ID is required and must be a string")

            result = (
                self.supabase_client.table("archon_epics")
                .select("*")
                .eq("id", epic_id)
                .single()
                .execute()
            )

            if result.data is None:
                raise EpicNotFoundError(epic_id)

            return result.data

        except EpicServiceError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            logger.error(f"Error getting epic {epic_id}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise EpicServiceError(
                f"Error getting epic: {str(e)}",
                "DATABASE_ERROR"
            )

    async def update_epic(
        self,
        epic_id: str,
        updates: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Update an epic with validation and progress recalculation.

        Args:
            epic_id: UUID of the epic to update
            updates: Dictionary of fields to update
                    Valid keys: title, description, status, priority, business_value

        Returns:
            Updated epic data

        Raises:
            EpicNotFoundError: If epic doesn't exist
            EpicValidationError: For validation failures
            EpicServiceError: For database or unexpected errors
        """
        try:
            if not epic_id or not isinstance(epic_id, str):
                raise EpicValidationError("epic_id", "Epic ID is required and must be a string")

            if not isinstance(updates, dict) or not updates:
                raise EpicValidationError("updates", "Updates must be a non-empty dictionary")

            # Verify epic exists first
            current_epic = await self.get_epic(epic_id)  # Will raise EpicNotFoundError if not found
            old_status = current_epic["status"]

            # Build validated update data
            update_data = {"updated_at": datetime.now().isoformat()}

            # Validate and process each update field
            if "title" in updates:
                is_valid, error_msg = self.validate_title(updates["title"])
                if not is_valid:
                    raise EpicValidationError("title", error_msg)
                update_data["title"] = updates["title"].strip()

            if "description" in updates:
                if updates["description"] is not None:
                    update_data["description"] = str(updates["description"]).strip()
                else:
                    update_data["description"] = ""

            if "status" in updates:
                is_valid, error_msg = self.validate_status(updates["status"])
                if not is_valid:
                    raise EpicValidationError("status", error_msg)
                update_data["status"] = updates["status"]

            if "priority" in updates:
                is_valid, error_msg = self.validate_priority(updates["priority"])
                if not is_valid:
                    raise EpicValidationError("priority", error_msg)
                update_data["priority"] = self.PRIORITY_MAPPING[updates["priority"]]

            if "business_value" in updates:
                is_valid, error_msg = self.validate_business_value(updates["business_value"])
                if not is_valid:
                    raise EpicValidationError("business_value", error_msg)
                update_data["business_value"] = updates["business_value"] or {}

            # Perform database update
            result = (
                self.supabase_client.table("archon_epics")
                .update(update_data)
                .eq("id", epic_id)
                .execute()
            )

            if result.data is None or len(result.data) == 0:
                logger.error(f"Database error updating epic: {result}")
                raise EpicServiceError(
                    "Failed to update epic due to database error",
                    "DATABASE_ERROR"
                )

            updated_epic = result.data[0]
            logger.info(f"Epic updated successfully: {epic_id}")

            # If status changed, trigger progress recalculation
            if "status" in updates and updates["status"] != old_status:
                logger.debug(f"Status changed from {old_status} to {updates['status']}, recalculating progress")
                await self.calculate_epic_progress(epic_id)

            return updated_epic

        except EpicServiceError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            logger.error(f"Error updating epic {epic_id}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise EpicServiceError(
                f"Error updating epic: {str(e)}",
                "UNEXPECTED_ERROR"
            )

    async def delete_epic(self, epic_id: str) -> dict[str, Any]:
        """
        Delete an epic (soft delete following BMAD standards).

        Note: Implements soft delete pattern as per service standards.
        Hard delete only performed if epic has no children.

        Args:
            epic_id: UUID of the epic to delete

        Returns:
            Deletion result message

        Raises:
            EpicNotFoundError: If epic doesn't exist
            EpicServiceError: If epic has children or database error
        """
        try:
            if not epic_id or not isinstance(epic_id, str):
                raise EpicValidationError("epic_id", "Epic ID is required and must be a string")

            # Verify epic exists first
            await self.get_epic(epic_id)  # Will raise EpicNotFoundError if not found

            # Check if epic has stories
            stories_response = (
                self.supabase_client.table("archon_stories")
                .select("id")
                .eq("epic_id", epic_id)
                .execute()
            )

            if stories_response.data and len(stories_response.data) > 0:
                raise EpicServiceError(
                    f"Cannot delete epic {epic_id} - it has {len(stories_response.data)} stories",
                    "CONSTRAINT_VIOLATION"
                )

            # Perform hard delete (since no children)
            result = (
                self.supabase_client.table("archon_epics")
                .delete()
                .eq("id", epic_id)
                .execute()
            )

            if result.data is None or len(result.data) == 0:
                logger.error(f"Database error deleting epic: {result}")
                raise EpicServiceError(
                    "Failed to delete epic due to database error",
                    "DATABASE_ERROR"
                )

            logger.info(f"Epic deleted successfully: {epic_id}")
            return {"message": f"Epic {epic_id} deleted successfully"}

        except EpicServiceError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            logger.error(f"Error deleting epic {epic_id}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise EpicServiceError(
                f"Error deleting epic: {str(e)}",
                "UNEXPECTED_ERROR"
            )

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
        include_archived: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """
        List epics for a project with optional filters and pagination.

        Args:
            project_id: UUID of the parent project
            status: Filter by status (optional)
            priority: Filter by priority (optional)
            include_archived: Include archived epics (default: False)
            limit: Maximum results to return (default: 100, max: 1000)
            offset: Pagination offset (default: 0)

        Returns:
            List of epic data

        Raises:
            EpicValidationError: For invalid parameters
            EpicServiceError: For database errors
        """
        try:
            if not project_id or not isinstance(project_id, str):
                raise EpicValidationError("project_id", "Project ID is required and must be a string")

            # Validate optional filters
            if status and not self.validate_status(status)[0]:
                raise EpicValidationError("status", f"Invalid status filter: {status}")

            if priority and not self.validate_priority(priority)[0]:
                raise EpicValidationError("priority", f"Invalid priority filter: {priority}")

            # Validate pagination parameters
            if limit < 1 or limit > 1000:
                raise EpicValidationError("limit", "Limit must be between 1 and 1000")

            if offset < 0:
                raise EpicValidationError("offset", "Offset must be non-negative")

            query = (
                self.supabase_client.table("archon_epics")
                .select("*", count="exact")
                .eq("project_id", project_id)
            )

            # Apply filters
            if status:
                query = query.eq("status", status)

            if priority:
                # Convert priority name to numeric value for filtering
                priority_value = self.PRIORITY_MAPPING.get(priority)
                if priority_value:
                    query = query.eq("priority", priority_value)

            # Note: archived functionality not yet implemented in database schema
            # if not include_archived:
            #     query = query.eq("archived", False)

            # Apply ordering and pagination
            query = query.order("created_at", desc=False)
            query = query.range(offset, offset + limit - 1)

            result = query.execute()

            if result.data is None:
                logger.warning(f"No epics found for project {project_id}")
                return []

            logger.debug(f"Retrieved {len(result.data)} epics for project {project_id}")
            return result.data

        except EpicServiceError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            logger.error(f"Error listing epics for project {project_id}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise EpicServiceError(
                f"Error listing epics: {str(e)}",
                "DATABASE_ERROR"
            )

    async def calculate_epic_progress(self, epic_id: str) -> dict[str, Any]:
        """
        Calculate and update epic progress based on its stories.

        Args:
            epic_id: UUID of the epic to calculate progress for

        Returns:
            Progress calculation result

        Raises:
            EpicNotFoundError: If epic doesn't exist
            EpicServiceError: For database or calculation errors
        """
        try:
            if not epic_id or not isinstance(epic_id, str):
                raise EpicValidationError("epic_id", "Epic ID is required and must be a string")

            # Verify epic exists
            await self.get_epic(epic_id)  # Will raise EpicNotFoundError if not found

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
                logger.debug(f"Epic {epic_id} has no stories, setting progress to 0%")
            else:
                # Calculate progress based on story statuses
                total_stories = len(stories_response.data)
                done_stories = sum(1 for s in stories_response.data if s["status"] == "done")
                progress = (done_stories / total_stories) * 100 if total_stories > 0 else 0.0
                logger.debug(f"Epic {epic_id}: {done_stories}/{total_stories} stories done = {progress:.1f}%")

            # Update epic progress
            update_result = (
                self.supabase_client.table("archon_epics")
                .update({
                    "progress_percentage": int(progress),
                    "updated_at": datetime.now().isoformat(),
                })
                .eq("id", epic_id)
                .execute()
            )

            if update_result.data is None or len(update_result.data) == 0:
                logger.error(f"Database error updating epic progress: {update_result}")
                raise EpicServiceError(
                    f"Failed to update progress for epic {epic_id}",
                    "DATABASE_ERROR"
                )

            logger.info(f"Epic {epic_id} progress updated to {progress:.1f}%")
            return {
                "epic_id": epic_id,
                "progress_percentage": int(progress),
                "total_stories": len(stories_response.data) if stories_response.data else 0,
                "done_stories": sum(1 for s in stories_response.data if s["status"] == "done") if stories_response.data else 0
            }

        except EpicServiceError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            logger.error(f"Error calculating epic progress for {epic_id}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise EpicServiceError(
                f"Error calculating epic progress: {str(e)}",
                "UNEXPECTED_ERROR"
            )

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