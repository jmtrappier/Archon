"""
Task Service Module for Archon

This module provides core business logic for task operations that can be
shared between MCP tools and FastAPI endpoints.
"""

# Removed direct logging import - using unified config
from datetime import datetime
from typing import Any

from src.server.utils import get_supabase_client

from ...config.logfire_config import get_logger

logger = get_logger(__name__)

# Task updates are handled via polling - no broadcasting needed


class TaskService:
    async def _execute_query(self, query_func):
        """Helper to execute Supabase queries asynchronously"""
        import asyncio
        return await asyncio.get_event_loop().run_in_executor(None, query_func)
    VALID_PRIORITIES = {"critical", "high", "medium", "low"}

    def validate_priority(self, priority: str) -> tuple[bool, str]:
        """Validate task priority string and return normalized value."""
        if not isinstance(priority, str):
            return False, "Priority must be a string"
        normalized = priority.lower()
        if normalized not in self.VALID_PRIORITIES:
            return False, (
                "Invalid priority value. Must be one of: "
                + ", ".join(sorted(self.VALID_PRIORITIES))
            )
        return True, normalized

    """Service class for task operations"""

    VALID_STATUSES = ["todo", "doing", "review", "waiting", "done"]

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    def validate_status(self, status: str) -> tuple[bool, str]:
        """Validate task status"""
        if status not in self.VALID_STATUSES:
            return (
                False,
                f"Invalid status '{status}'. Must be one of: {', '.join(self.VALID_STATUSES)}",
            )
        return True, ""

    def validate_assignee(self, assignee: str) -> tuple[bool, str]:
        """Validate task assignee"""
        if not assignee or not isinstance(assignee, str) or len(assignee.strip()) == 0:
            return False, "Assignee must be a non-empty string"
        return True, ""

    async def create_task(
        self,
        project_id: str,
        title: str,
        description: str = "",
        assignee: str = "User",
        task_order: int = 0,
        feature: str | None = None,
        sources: list[dict[str, Any]] = None,
        code_examples: list[dict[str, Any]] = None,
        story_id: str | None = None,
        priority: str = "medium",
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a new task under a project with automatic reordering.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Validate inputs
            if not title or not isinstance(title, str) or len(title.strip()) == 0:
                return False, {"error": "Task title is required and must be a non-empty string"}

            if not project_id or not isinstance(project_id, str):
                return False, {"error": "Project ID is required and must be a string"}

            # Validate assignee
            is_valid, error_msg = self.validate_assignee(assignee)
            if not is_valid:
                return False, {"error": error_msg}

            task_status = "todo"

            # Normalize and validate priority
            priority_input = priority or "medium"
            is_valid_priority, priority_result = self.validate_priority(priority_input)
            if not is_valid_priority:
                return False, {"error": priority_result}
            priority_value = priority_result

            # REORDERING LOGIC: If inserting at a specific position, increment existing tasks
            if task_order > 0:
                # Get all tasks in the same project and status with task_order >= new task's order
                existing_tasks_response = await self._execute_query(
                    lambda: self.supabase_client.table("archon_tasks")
                    .select("id, task_order")
                    .eq("project_id", project_id)
                    .eq("status", task_status)
                    .gte("task_order", task_order)
                    .execute()
                )

                if existing_tasks_response.data:
                    logger.info(f"Reordering {len(existing_tasks_response.data)} existing tasks")

                    # Increment task_order for all affected tasks
                    for existing_task in existing_tasks_response.data:
                        new_order = existing_task["task_order"] + 1
                        await self._execute_query(
                            lambda: self.supabase_client.table("archon_tasks").update({
                                "task_order": new_order,
                                "updated_at": datetime.now().isoformat(),
                            }).eq("id", existing_task["id"]).execute()
                        )

            task_data = {
                "project_id": project_id,
                "title": title,
                "description": description,
                "status": task_status,
                "assignee": assignee,
                "task_order": task_order,
                "sources": sources or [],
                "code_examples": code_examples or [],
                "priority": priority_value,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

            if feature:
                task_data["feature"] = feature

            if story_id:
                task_data["story_id"] = story_id

            response = await self._execute_query(
                lambda: self.supabase_client.table("archon_tasks").insert(task_data).execute()
            )

            if response.data:
                task = response.data[0]


                return True, {
                    "task": {
                        "id": task["id"],
                        "project_id": task["project_id"],
                        "title": task["title"],
                        "description": task["description"],
                        "status": task["status"],
                        "assignee": task["assignee"],
                        "task_order": task["task_order"],
                        "priority": task.get("priority"),
                        "created_at": task["created_at"],
                    }
                }
            else:
                return False, {"error": "Failed to create task"}

        except Exception as e:
            logger.error(f"Error creating task: {e}")
            return False, {"error": f"Error creating task: {str(e)}"}

    async def list_tasks(
        self,
        project_id: str = None,
        status: str = None,
        include_closed: bool = False,
        exclude_large_fields: bool = False,
        include_archived: bool = False,
        search_query: str = None,
        story_id: str = None,
        epic_id: str = None
    ) -> tuple[bool, dict[str, Any]]:
        """
        List tasks with various filters.

        Args:
            project_id: Filter by project
            status: Filter by status
            include_closed: Include done tasks
            exclude_large_fields: If True, excludes sources and code_examples fields
            include_archived: If True, includes archived tasks
            search_query: Keyword search in title, description, and feature fields
            story_id: Filter by story ID (BMAD hierarchy)
            epic_id: Filter by epic ID (via story relationship)

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Start with base query
            if exclude_large_fields:
                # Select all fields except large JSONB ones
                query = self.supabase_client.table("archon_tasks").select(
                    "id, project_id, parent_task_id, title, description, "
                    "status, assignee, task_order, feature, archived, "
                    "archived_at, archived_by, created_at, updated_at, "
                    "sources, code_examples"  # Still fetch for counting, but will process differently
                )
            else:
                query = self.supabase_client.table("archon_tasks").select("*")

            # Track filters for debugging
            filters_applied = []

            # Apply filters
            if project_id:
                query = query.eq("project_id", project_id)
                filters_applied.append(f"project_id={project_id}")

            # BMAD Hierarchy filters
            if story_id:
                query = query.eq("story_id", story_id)
                filters_applied.append(f"story_id={story_id}")

            # For epic_id filtering, we need to use the enriched method
            # But for performance, we'll handle it after the initial query
            if epic_id:
                filters_applied.append(f"epic_id={epic_id}")

            if status:
                # Validate status
                is_valid, error_msg = self.validate_status(status)
                if not is_valid:
                    return False, {"error": error_msg}
                query = query.eq("status", status)
                filters_applied.append(f"status={status}")
                # When filtering by specific status, don't apply include_closed filter
                # as it would be redundant or potentially conflicting
            elif not include_closed:
                # Only exclude done tasks if no specific status filter is applied
                query = query.neq("status", "done")
                filters_applied.append("exclude done tasks")

            # Apply keyword search if provided
            if search_query:
                # Split search query into terms
                search_terms = search_query.lower().split()
                
                # Build the filter expression for AND-of-ORs
                # Each term must match in at least one field (OR), and all terms must match (AND)
                if len(search_terms) == 1:
                    # Single term: simple OR across fields
                    term = search_terms[0]
                    query = query.or_(
                        f"title.ilike.%{term}%,"
                        f"description.ilike.%{term}%,"
                        f"feature.ilike.%{term}%"
                    )
                else:
                    # Multiple terms: use text search for proper AND logic
                    # Note: This requires full-text search columns to be set up in the database
                    # For now, we'll search for the full phrase in any field
                    full_query = search_query.lower()
                    query = query.or_(
                        f"title.ilike.%{full_query}%,"
                        f"description.ilike.%{full_query}%,"
                        f"feature.ilike.%{full_query}%"
                    )
                filters_applied.append(f"search={search_query}")

            # Filter out archived tasks only if not including them
            if not include_archived:
                query = query.or_("archived.is.null,archived.is.false")
                filters_applied.append("exclude archived tasks (null or false)")
            else:
                filters_applied.append("include all tasks (including archived)")

            logger.debug(f"Listing tasks with filters: {', '.join(filters_applied)}")

            # Execute query and get raw response
            import asyncio
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: query.order("task_order", desc=False).order("created_at", desc=False).execute()
            )

            # Debug: Log task status distribution and filter effectiveness
            if response.data:
                status_counts = {}
                archived_counts = {"null": 0, "true": 0, "false": 0}

                for task in response.data:
                    task_status = task.get("status", "unknown")
                    status_counts[task_status] = status_counts.get(task_status, 0) + 1

                    # Check archived field
                    archived_value = task.get("archived")
                    if archived_value is None:
                        archived_counts["null"] += 1
                    elif archived_value is True:
                        archived_counts["true"] += 1
                    else:
                        archived_counts["false"] += 1

                logger.debug(
                    f"Retrieved {len(response.data)} tasks. Status distribution: {status_counts}"
                )
                logger.debug(f"Archived field distribution: {archived_counts}")

                # If we're filtering by status and getting wrong results, log sample
                if status and len(response.data) > 0:
                    first_task = response.data[0]
                    logger.warning(
                        f"Status filter: {status}, First task status: {first_task.get('status')}, archived: {first_task.get('archived')}"
                    )
            else:
                logger.debug("No tasks found with current filters")

            tasks = []
            for task in response.data:
                task_data = {
                    "id": task["id"],
                    "project_id": task["project_id"],
                    "story_id": task.get("story_id"),
                    "title": task["title"],
                    "description": task["description"],
                    "status": task["status"],
                    "assignee": task.get("assignee", "User"),
                    "task_order": task.get("task_order", 0),
                    "feature": task.get("feature"),
                    "priority": task.get("priority", "medium"),
                    "created_at": task["created_at"],
                    "updated_at": task["updated_at"],
                    "archived": task.get("archived", False),
                }

                if not exclude_large_fields:
                    # Include full JSONB fields
                    task_data["sources"] = task.get("sources", [])
                    task_data["code_examples"] = task.get("code_examples", [])
                else:
                    # Add counts instead of full content
                    task_data["stats"] = {
                        "sources_count": len(task.get("sources", [])),
                        "code_examples_count": len(task.get("code_examples", []))
                    }

                tasks.append(task_data)

            # Apply epic_id filtering if specified (post-query filtering)
            if epic_id:
                filtered_tasks = []
                for task in tasks:
                    # Check if task has story_id, then get story's epic_id
                    if task.get("story_id"):
                        story_response = await (
                            self.supabase_client.table("archon_stories")
                            .select("epic_id")
                            .eq("id", task["story_id"])
                            .single()
                            .aexecute()
                        )
                        if story_response.data and story_response.data.get("epic_id") == epic_id:
                            filtered_tasks.append(task)
                tasks = filtered_tasks

            filter_info = []
            if project_id:
                filter_info.append(f"project_id={project_id}")
            if story_id:
                filter_info.append(f"story_id={story_id}")
            if epic_id:
                filter_info.append(f"epic_id={epic_id}")
            if status:
                filter_info.append(f"status={status}")
            if not include_closed:
                filter_info.append("excluding closed tasks")

            return True, {
                "tasks": tasks,
                "total_count": len(tasks),
                "filters_applied": ", ".join(filter_info) if filter_info else "none",
                "include_closed": include_closed,
            }

        except Exception as e:
            logger.error(f"Error listing tasks: {e}")
            return False, {"error": f"Error listing tasks: {str(e)}"}

    async def get_task(self, task_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get a specific task by ID.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            response = await self._execute_query(
                lambda: self.supabase_client.table("archon_tasks").select("*").eq("id", task_id).execute()
            )

            if response.data:
                task = response.data[0]
                return True, {"task": task}
            else:
                return False, {"error": f"Task with ID {task_id} not found"}

        except Exception as e:
            logger.error(f"Error getting task: {e}")
            return False, {"error": f"Error getting task: {str(e)}"}

    async def update_task(
        self, task_id: str, update_fields: dict[str, Any]
    ) -> tuple[bool, dict[str, Any]]:
        """
        Update task with specified fields.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            logger.info(f"🔧 TaskService.update_task START | task_id={task_id} | update_fields={update_fields}")

            # Build update data
            update_data = {"updated_at": datetime.now().isoformat()}

            # Validate and add fields
            if "title" in update_fields:
                update_data["title"] = update_fields["title"]

            if "description" in update_fields:
                update_data["description"] = update_fields["description"]

            if "status" in update_fields:
                is_valid, error_msg = self.validate_status(update_fields["status"])
                if not is_valid:
                    logger.error(f"Status validation failed: {error_msg}")
                    return False, {"error": error_msg}
                update_data["status"] = update_fields["status"]

            if "assignee" in update_fields:
                is_valid, error_msg = self.validate_assignee(update_fields["assignee"])
                if not is_valid:
                    logger.error(f"Assignee validation failed: {error_msg}")
                    return False, {"error": error_msg}
                update_data["assignee"] = update_fields["assignee"]

            if "task_order" in update_fields:
                update_data["task_order"] = update_fields["task_order"]

            if "feature" in update_fields:
                update_data["feature"] = update_fields["feature"]

            if "priority" in update_fields:
                is_valid_priority, priority_result = self.validate_priority(update_fields["priority"])
                if not is_valid_priority:
                    logger.error(f"Priority validation failed: {priority_result}")
                    return False, {"error": priority_result}
                logger.info(f"Priority validation success: {update_fields['priority']} -> {priority_result}")
                update_data["priority"] = priority_result

            if "story_id" in update_fields:
                update_data["story_id"] = update_fields["story_id"]

            if "parent_task_id" in update_fields:
                update_data["parent_task_id"] = update_fields["parent_task_id"]

            # Update task
            logger.info(f"🔧 TaskService.update_task calling Supabase update | task_id={task_id} | update_data={update_data}")
            response = await (
                self.supabase_client.table("archon_tasks")
                .update(update_data)
                .eq("id", task_id)
                .aexecute()
            )

            logger.info(f"🔧 TaskService.update_task Supabase response | task_id={task_id} | response_data_count={len(response.data) if response.data else 0}")

            if response.data:
                task = response.data[0]
                logger.info(f"🔧 TaskService.update_task SUCCESS | task_id={task_id} | task_data={task}")
                return True, {"task": task, "message": "Task updated successfully"}
            else:
                logger.error(f"🔧 TaskService.update_task NO DATA RETURNED | task_id={task_id}")
                return False, {"error": f"Task with ID {task_id} not found"}

        except Exception as e:
            logger.error(f"🔧 TaskService.update_task EXCEPTION | task_id={task_id} | error={e} | error_type={type(e).__name__}")
            return False, {"error": f"Error updating task: {str(e)}"}

    async def archive_task(
        self, task_id: str, archived_by: str = "mcp"
    ) -> tuple[bool, dict[str, Any]]:
        """
        Archive a task and all its subtasks (soft delete).

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # First, check if task exists and is not already archived
            task_response = await (
                self.supabase_client.table("archon_tasks").select("*").eq("id", task_id).aexecute()
            )
            if not task_response.data:
                return False, {"error": f"Task with ID {task_id} not found"}

            task = task_response.data[0]
            if task.get("archived") is True:
                return False, {"error": f"Task with ID {task_id} is already archived"}

            # Archive the task
            archive_data = {
                "archived": True,
                "archived_at": datetime.now().isoformat(),
                "archived_by": archived_by,
                "updated_at": datetime.now().isoformat(),
            }

            # Archive the main task
            response = await (
                self.supabase_client.table("archon_tasks")
                .update(archive_data)
                .eq("id", task_id)
                .aexecute()
            )

            if response.data:

                return True, {"task_id": task_id, "message": "Task archived successfully"}
            else:
                return False, {"error": f"Failed to archive task {task_id}"}

        except Exception as e:
            logger.error(f"Error archiving task: {e}")
            return False, {"error": f"Error archiving task: {str(e)}"}

    async def get_all_project_task_counts(self) -> tuple[bool, dict[str, dict[str, int]]]:
        """
        Get task counts for all projects in a single optimized query.

        Returns task counts grouped by project_id and status.

        Returns:
            Tuple of (success, counts_dict) where counts_dict is:
            {"project-id": {"todo": 5, "doing": 2, "review": 3, "done": 10}}
        """
        try:
            logger.debug("Fetching task counts for all projects in batch")

            # Query all non-archived tasks grouped by project_id and status
            response = await self._execute_query(
                lambda: (
                    self.supabase_client.table("archon_tasks")
                    .select("project_id, status")
                    .or_("archived.is.null,archived.is.false")
                    .execute()
                )
            )

            if not response.data:
                logger.debug("No tasks found")
                return True, {}

            # Process results into counts by project and status
            counts_by_project = {}

            for task in response.data:
                project_id = task.get("project_id")
                status = task.get("status")

                if not project_id or not status:
                    continue

                # Initialize project counts if not exists
                if project_id not in counts_by_project:
                    counts_by_project[project_id] = {
                        "todo": 0,
                        "doing": 0,
                        "review": 0,
                        "done": 0
                    }

                # Count all statuses separately
                if status in ["todo", "doing", "review", "done"]:
                    counts_by_project[project_id][status] += 1

            logger.debug(f"Task counts fetched for {len(counts_by_project)} projects")

            return True, counts_by_project

        except Exception as e:
            logger.error(f"Error fetching task counts: {e}")
            return False, {"error": f"Error fetching task counts: {str(e)}"}

    async def create_subtask(
        self,
        parent_task_id: str,
        title: str,
        description: str = "",
        assignee: str = "User",
        task_order: int = 0,
        feature: str | None = None,
        priority: str = "medium",
        sources: list[dict[str, Any]] = None,
        code_examples: list[dict[str, Any]] = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a new subtask under a parent task.
        Inherits project_id and story_id from parent task.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Get parent task to inherit project_id and story_id
            parent_response = await (
                self.supabase_client.table("archon_tasks")
                .select("project_id, story_id, archived")
                .eq("id", parent_task_id)
                .aexecute()
            )

            if not parent_response.data:
                return False, {"error": f"Parent task with ID {parent_task_id} not found"}

            parent_task = parent_response.data[0]
            if parent_task.get("archived") is True:
                return False, {"error": f"Cannot create subtask under archived parent task {parent_task_id}"}

            # Validate inputs
            if not title or not isinstance(title, str) or len(title.strip()) == 0:
                return False, {"error": "Subtask title is required and must be a non-empty string"}

            # Validate assignee
            is_valid, error_msg = self.validate_assignee(assignee)
            if not is_valid:
                return False, {"error": error_msg}

            # Inherit from parent task
            project_id = parent_task["project_id"]
            story_id = parent_task.get("story_id")

            priority_input = priority or "medium"
            is_valid_priority, priority_result = self.validate_priority(priority_input)
            if not is_valid_priority:
                return False, {"error": priority_result}
            priority_value = priority_result

            subtask_data = {
                "project_id": project_id,
                "parent_task_id": parent_task_id,
                "title": title,
                "description": description,
                "status": "todo",
                "assignee": assignee,
                "task_order": task_order,
                "priority": priority_value,
                "sources": sources or [],
                "code_examples": code_examples or [],
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

            if story_id:
                subtask_data["story_id"] = story_id

            if feature:
                subtask_data["feature"] = feature

            response = await self._execute_query(
                lambda: self.supabase_client.table("archon_tasks").insert(subtask_data).execute()
            )

            if response.data:
                subtask = response.data[0]
                logger.info(f"Subtask created: {subtask['id']} under parent {parent_task_id}")

                return True, {
                    "subtask": {
                        "id": subtask["id"],
                        "project_id": subtask["project_id"],
                        "parent_task_id": subtask["parent_task_id"],
                        "story_id": subtask.get("story_id"),
                        "title": subtask["title"],
                        "description": subtask["description"],
                        "status": subtask["status"],
                        "assignee": subtask["assignee"],
                        "task_order": subtask["task_order"],
                        "priority": subtask.get("priority"),
                        "created_at": subtask["created_at"],
                    }
                }
            else:
                return False, {"error": "Failed to create subtask"}

        except Exception as e:
            logger.error(f"Error creating subtask: {e}")
            return False, {"error": f"Error creating subtask: {str(e)}"}

    async def get_subtasks_by_parent(
        self,
        parent_task_id: str,
        include_archived: bool = False
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get direct subtasks of a parent task (non-recursive).

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            query = (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("parent_task_id", parent_task_id)
            )

            if not include_archived:
                query = query.or_("archived.is.null,archived.is.false")

            response = await query.order("task_order", desc=False).aexecute()

            subtasks = []
            for subtask in response.data:
                subtask_data = {
                    "id": subtask["id"],
                    "project_id": subtask["project_id"],
                    "parent_task_id": subtask["parent_task_id"],
                    "story_id": subtask.get("story_id"),
                    "title": subtask["title"],
                    "description": subtask["description"],
                    "status": subtask["status"],
                    "assignee": subtask.get("assignee", "User"),
                    "task_order": subtask.get("task_order", 0),
                    "feature": subtask.get("feature"),
                    "priority": subtask.get("priority", "medium"),
                    "created_at": subtask["created_at"],
                    "updated_at": subtask["updated_at"],
                    "archived": subtask.get("archived", False),
                }
                subtasks.append(subtask_data)

            return True, {
                "subtasks": subtasks,
                "parent_task_id": parent_task_id,
                "total_count": len(subtasks),
            }

        except Exception as e:
            logger.error(f"Error getting subtasks for parent {parent_task_id}: {e}")
            return False, {"error": f"Error getting subtasks: {str(e)}"}

    async def get_task_subtasks_recursive(
        self,
        task_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all subtasks of a task recursively using the database function.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Use the recursive database function created in the migration
            response = await (
                self.supabase_client.rpc(
                    "get_task_subtasks_recursive",
                    {"task_uuid": task_id}
                ).aexecute()
            )

            if response.data is not None:
                subtasks = []
                for subtask in response.data:
                    subtask_data = {
                        "id": subtask["id"],
                        "title": subtask["title"],
                        "description": subtask["description"],
                        "status": subtask["status"],
                        "assignee": subtask["assignee"],
                        "task_order": subtask["task_order"],
                        "depth": subtask["depth"],
                    }
                    subtasks.append(subtask_data)

                return True, {
                    "subtasks": subtasks,
                    "root_task_id": task_id,
                    "total_count": len(subtasks),
                }
            else:
                return False, {"error": "Failed to get recursive subtasks"}

        except Exception as e:
            logger.error(f"Error getting recursive subtasks for task {task_id}: {e}")
            return False, {"error": f"Error getting recursive subtasks: {str(e)}"}

    async def get_task_hierarchy_path(
        self,
        task_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get the hierarchy path of a task using the database function.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Use the hierarchy path database function created in the migration
            response = await (
                self.supabase_client.rpc(
                    "get_task_hierarchy_path",
                    {"task_uuid": task_id}
                ).aexecute()
            )

            if response.data is not None:
                hierarchy = []
                for level in response.data:
                    level_data = {
                        "level_name": level["level_name"],
                        "id": level["id"],
                        "title": level["title"],
                    }
                    hierarchy.append(level_data)

                return True, {
                    "hierarchy": hierarchy,
                    "task_id": task_id,
                    "levels_count": len(hierarchy),
                }
            else:
                return False, {"error": "Failed to get task hierarchy path"}

        except Exception as e:
            logger.error(f"Error getting hierarchy path for task {task_id}: {e}")
            return False, {"error": f"Error getting task hierarchy path: {str(e)}"}

    async def archive_task_with_subtasks(
        self,
        task_id: str,
        archived_by: str = "mcp"
    ) -> tuple[bool, dict[str, Any]]:
        """
        Archive a task and all its subtasks recursively (soft delete).

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # First, get all subtasks recursively
            success, subtasks_result = self.get_task_subtasks_recursive(task_id)
            if not success:
                return False, {"error": f"Failed to get subtasks: {subtasks_result.get('error')}"}

            archive_data = {
                "archived": True,
                "archived_at": datetime.now().isoformat(),
                "archived_by": archived_by,
                "updated_at": datetime.now().isoformat(),
            }

            archived_tasks = []

            # Archive the main task
            main_response = await (
                self.supabase_client.table("archon_tasks")
                .update(archive_data)
                .eq("id", task_id)
                .aexecute()
            )

            if main_response.data:
                archived_tasks.append({"id": task_id, "type": "main_task"})

            # Archive all subtasks
            for subtask in subtasks_result.get("subtasks", []):
                subtask_response = await (
                    self.supabase_client.table("archon_tasks")
                    .update(archive_data)
                    .eq("id", subtask["id"])
                    .aexecute()
                )

                if subtask_response.data:
                    archived_tasks.append({
                        "id": subtask["id"],
                        "type": "subtask",
                        "depth": subtask["depth"]
                    })

            logger.info(f"Archived task {task_id} with {len(archived_tasks)-1} subtasks")

            return True, {
                "archived_tasks": archived_tasks,
                "main_task_id": task_id,
                "total_archived": len(archived_tasks),
                "message": f"Task and {len(archived_tasks)-1} subtasks archived successfully"
            }

        except Exception as e:
            logger.error(f"Error archiving task with subtasks: {e}")
            return False, {"error": f"Error archiving task with subtasks: {str(e)}"}

    # ============================================================
    # NEW HIERARCHICAL METHODS FOR BMAD-TRAXIS INTEGRATION
    # ============================================================

    async def get_tasks_by_story(
        self,
        story_id: str,
        include_subtasks: bool = True,
        exclude_large_fields: bool = False,
        include_archived: bool = False,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all tasks for a specific story with optional subtasks.

        Args:
            story_id: Story ID to filter by
            include_subtasks: Include all subtasks recursively
            exclude_large_fields: Exclude sources and code_examples
            include_archived: Include archived tasks

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Validate story exists
            story_response = (
                self.supabase_client.table("archon_stories")
                .select("id, title, epic_id")
                .eq("id", story_id)
                .single()
                .aexecute()
            )

            if not story_response.data:
                return False, {"error": f"Story with ID {story_id} not found"}

            story = story_response.data

            # Get main tasks (tasks directly under the story)
            if exclude_large_fields:
                query = self.supabase_client.table("archon_tasks").select(
                    "id, project_id, parent_task_id, story_id, title, description, "
                    "status, assignee, task_order, feature, archived, "
                    "archived_at, archived_by, created_at, updated_at"
                )
            else:
                query = self.supabase_client.table("archon_tasks").select("*")

            query = query.eq("story_id", story_id)

            if not include_archived:
                query = query.eq("archived", False)

            # Order by task_order
            query = query.order("task_order", desc=False)

            tasks_response = await query.aexecute()

            if tasks_response.data is None:
                return True, {
                    "story": story,
                    "tasks": [],
                    "total_count": 0,
                }

            tasks = tasks_response.data

            # If include_subtasks is True, fetch all subtasks recursively
            if include_subtasks:
                all_tasks = []
                for task in tasks:
                    all_tasks.append(task)

                    # Get all subtasks for this task
                    subtasks_result = await self.get_task_subtasks_recursive(task["id"])
                    if subtasks_result[0]:  # success
                        subtasks = subtasks_result[1].get("subtasks", [])
                        all_tasks.extend(subtasks)

                tasks = all_tasks

            return True, {
                "story": story,
                "tasks": tasks,
                "total_count": len(tasks),
            }

        except Exception as e:
            logger.error(f"Error getting tasks by story: {str(e)}")
            return False, {"error": f"Error getting tasks by story: {str(e)}"}

    async def get_subtasks_by_task(
        self,
        task_id: str,
        max_depth: int = 10,
        exclude_large_fields: bool = False,
        include_archived: bool = False,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all subtasks for a specific task with depth tracking.

        Args:
            task_id: Parent task ID
            max_depth: Maximum depth to traverse (default: 10)
            exclude_large_fields: Exclude sources and code_examples
            include_archived: Include archived tasks

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Validate parent task exists
            parent_task_response = (
                self.supabase_client.table("archon_tasks")
                .select("id, title, story_id, project_id")
                .eq("id", task_id)
                .single()
                .aexecute()
            )

            if not parent_task_response.data:
                return False, {"error": f"Task with ID {task_id} not found"}

            parent_task = parent_task_response.data

            # Get subtasks recursively
            subtasks_result = await self.get_task_subtasks_recursive(
                task_id,
                max_depth=max_depth,
                exclude_large_fields=exclude_large_fields,
                include_archived=include_archived
            )

            if not subtasks_result[0]:
                return subtasks_result

            return True, {
                "parent_task": parent_task,
                "subtasks": subtasks_result[1].get("subtasks", []),
                "total_count": len(subtasks_result[1].get("subtasks", [])),
                "max_depth_reached": subtasks_result[1].get("levels_count", 0),
            }

        except Exception as e:
            logger.error(f"Error getting subtasks by task: {str(e)}")
            return False, {"error": f"Error getting subtasks by task: {str(e)}"}

    async def get_task_hierarchy(
        self,
        task_id: str,
        include_siblings: bool = False,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get complete hierarchy for a task (path from root + subtasks).

        Args:
            task_id: Task ID to get hierarchy for
            include_siblings: Include sibling tasks at each level

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Get the hierarchy path (from root to this task)
            path_result = await self.get_task_hierarchy_path(task_id)
            if not path_result[0]:
                return path_result

            hierarchy_path = path_result[1].get("hierarchy", [])

            # Get all subtasks
            subtasks_result = await self.get_subtasks_by_task(task_id)
            if not subtasks_result[0]:
                return subtasks_result

            subtasks = subtasks_result[1].get("subtasks", [])

            # If include_siblings, get siblings for each level in the path
            siblings_by_level = {}
            if include_siblings:
                for level_task in hierarchy_path:
                    parent_id = level_task.get("parent_task_id")
                    if parent_id:
                        siblings_result = await self.get_subtasks_by_task(parent_id)
                        if siblings_result[0]:
                            siblings = siblings_result[1].get("subtasks", [])
                            # Filter out the current task from siblings
                            siblings = [s for s in siblings if s["id"] != level_task["id"]]
                            siblings_by_level[level_task["id"]] = siblings

            return True, {
                "task_id": task_id,
                "hierarchy_path": hierarchy_path,
                "subtasks": subtasks,
                "siblings_by_level": siblings_by_level if include_siblings else {},
                "path_depth": len(hierarchy_path),
                "subtasks_count": len(subtasks),
            }

        except Exception as e:
            logger.error(f"Error getting task hierarchy: {str(e)}")
            return False, {"error": f"Error getting task hierarchy: {str(e)}"}

    async def validate_hierarchy_consistency(
        self,
        task_id: str,
        parent_task_id: str | None = None,
        story_id: str | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Validate hierarchy consistency and detect cycles.

        Args:
            task_id: Task ID to validate
            parent_task_id: New parent task ID (for updates)
            story_id: Story ID (for consistency checks)

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            validation_errors = []

            # 1. Check for cycles if parent_task_id is provided
            if parent_task_id:
                # Get hierarchy path for the proposed parent
                parent_path_result = await self.get_task_hierarchy_path(parent_task_id)
                if parent_path_result[0]:
                    parent_hierarchy = parent_path_result[1].get("hierarchy", [])
                    # Check if task_id is in the parent's hierarchy (would create cycle)
                    parent_task_ids = [t["id"] for t in parent_hierarchy]
                    if task_id in parent_task_ids:
                        validation_errors.append({
                            "type": "cycle_detected",
                            "message": f"Setting parent {parent_task_id} would create a cycle",
                            "cycle_path": parent_task_ids + [task_id]
                        })

            # 2. Check maximum depth
            if parent_task_id:
                parent_path_result = await self.get_task_hierarchy_path(parent_task_id)
                if parent_path_result[0]:
                    parent_depth = len(parent_path_result[1].get("hierarchy", []))
                    if parent_depth >= 10:  # Max depth limit
                        validation_errors.append({
                            "type": "max_depth_exceeded",
                            "message": f"Parent task is already at depth {parent_depth}, maximum is 10",
                            "current_depth": parent_depth
                        })

            # 3. Check story consistency if story_id is provided
            if story_id and parent_task_id:
                # Get parent task's story_id
                parent_response = (
                    self.supabase_client.table("archon_tasks")
                    .select("story_id, project_id")
                    .eq("id", parent_task_id)
                    .single()
                    .aexecute()
                )

                if parent_response.data:
                    parent_story_id = parent_response.data.get("story_id")
                    if parent_story_id and parent_story_id != story_id:
                        validation_errors.append({
                            "type": "story_mismatch",
                            "message": f"Parent task belongs to story {parent_story_id}, but task belongs to {story_id}",
                            "parent_story_id": parent_story_id,
                            "task_story_id": story_id
                        })

            # Return results
            is_valid = len(validation_errors) == 0

            return True, {
                "is_valid": is_valid,
                "validation_errors": validation_errors,
                "task_id": task_id,
                "parent_task_id": parent_task_id,
                "story_id": story_id,
            }

        except Exception as e:
            logger.error(f"Error validating hierarchy consistency: {str(e)}")
            return False, {"error": f"Error validating hierarchy consistency: {str(e)}"}

    async def get_tasks_with_epic_story_info(
        self,
        project_id: str | None = None,
        epic_id: str | None = None,
        story_id: str | None = None,
        status: str | None = None,
        include_archived: bool = False,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get tasks with full hierarchical context (Epic -> Story -> Task).

        Args:
            project_id: Filter by project
            epic_id: Filter by epic
            story_id: Filter by story
            status: Filter by task status
            include_archived: Include archived tasks

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Build the query with JOINs to get epic and story information
            query = """
            SELECT
                t.*,
                s.id as story_id_resolved,
                s.title as story_title,
                s.epic_id,
                e.id as epic_id_resolved,
                e.title as epic_title,
                e.project_id as epic_project_id
            FROM archon_tasks t
            LEFT JOIN archon_stories s ON t.story_id = s.id
            LEFT JOIN archon_epics e ON s.epic_id = e.id
            WHERE 1=1
            """

            params = []

            if project_id:
                query += " AND t.project_id = %s"
                params.append(project_id)

            if epic_id:
                query += " AND e.id = %s"
                params.append(epic_id)

            if story_id:
                query += " AND t.story_id = %s"
                params.append(story_id)

            if status:
                # Validate status first
                is_valid, error_msg = self.validate_status(status)
                if not is_valid:
                    return False, {"error": error_msg}
                query += " AND t.status = %s"
                params.append(status)

            if not include_archived:
                query += " AND t.archived = FALSE"

            query += " ORDER BY t.task_order ASC, t.created_at ASC"

            # Execute raw query (note: this is a simplified example,
            # in a real implementation you'd use Supabase's query builder
            # or a proper ORM for complex joins)

            # For now, let's implement this using separate queries
            # and join the data in Python (less efficient but works with Supabase)

            # Get tasks first
            task_query = self.supabase_client.table("archon_tasks").select("*")

            if project_id:
                task_query = task_query.eq("project_id", project_id)
            if story_id:
                task_query = task_query.eq("story_id", story_id)
            if status:
                task_query = task_query.eq("status", status)
            if not include_archived:
                task_query = task_query.eq("archived", False)

            task_query = task_query.order("task_order", desc=False)
            tasks_response = await task_query.aexecute()

            if not tasks_response.data:
                return True, {"tasks": [], "total_count": 0}

            tasks = tasks_response.data
            enriched_tasks = []

            for task in tasks:
                enriched_task = dict(task)

                # Get story information if story_id exists
                if task.get("story_id"):
                    story_response = (
                        self.supabase_client.table("archon_stories")
                        .select("id, title, epic_id")
                        .eq("id", task["story_id"])
                        .single()
                        .aexecute()
                    )

                    if story_response.data:
                        story = story_response.data
                        enriched_task["story_info"] = story

                        # Get epic information if epic_id exists
                        if story.get("epic_id"):
                            epic_response = (
                                self.supabase_client.table("archon_epics")
                                .select("id, title, project_id")
                                .eq("id", story["epic_id"])
                                .single()
                                .aexecute()
                            )

                            if epic_response.data:
                                enriched_task["epic_info"] = epic_response.data

                # Filter by epic_id if specified and we have epic info
                if epic_id and enriched_task.get("epic_info", {}).get("id") != epic_id:
                    continue

                enriched_tasks.append(enriched_task)

            return True, {
                "tasks": enriched_tasks,
                "total_count": len(enriched_tasks),
                "filters_applied": {
                    "project_id": project_id,
                    "epic_id": epic_id,
                    "story_id": story_id,
                    "status": status,
                    "include_archived": include_archived,
                }
            }

        except Exception as e:
            logger.error(f"Error getting tasks with epic/story info: {str(e)}")
            return False, {"error": f"Error getting tasks with epic/story info: {str(e)}"}

    async def update_task_with_hierarchy_validation(
        self,
        task_id: str,
        parent_task_id: str | None = None,
        story_id: str | None = None,
        **kwargs
    ) -> tuple[bool, dict[str, Any]]:
        """
        Update task with hierarchy validation to prevent cycles and inconsistencies.

        Args:
            task_id: Task ID to update
            parent_task_id: New parent task ID
            story_id: New story ID
            **kwargs: Other update fields

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Validate hierarchy consistency first
            validation_result = await self.validate_hierarchy_consistency(
                task_id=task_id,
                parent_task_id=parent_task_id,
                story_id=story_id,
            )

            if not validation_result[0]:
                return validation_result

            validation_data = validation_result[1]
            if not validation_data["is_valid"]:
                return False, {
                    "error": "Hierarchy validation failed",
                    "validation_errors": validation_data["validation_errors"]
                }

            # Proceed with normal update if validation passes
            update_data = {"updated_at": datetime.now().isoformat()}

            if parent_task_id is not None:
                update_data["parent_task_id"] = parent_task_id

            if story_id is not None:
                update_data["story_id"] = story_id

            # Add other fields from kwargs
            for key, value in kwargs.items():
                if key not in ["task_id", "parent_task_id", "story_id"]:
                    update_data[key] = value

            # Update the task
            response = await (
                self.supabase_client.table("archon_tasks")
                .update(update_data)
                .eq("id", task_id)
                .aexecute()
            )

            if response.data:
                updated_task = response.data[0]
                logger.info(f"Task updated with hierarchy validation: {task_id}")

                # Trigger progress recalculation if story changed
                if story_id is not None:
                    from src.server.services.projects.story_service import StoryService
                    story_service = StoryService(self.supabase_client)
                    await story_service.calculate_story_progress(story_id)

                return True, {"task": updated_task}
            else:
                return False, {"error": f"Task with ID {task_id} not found"}

        except Exception as e:
            logger.error(f"Error updating task with hierarchy validation: {str(e)}")
            return False, {"error": f"Error updating task with hierarchy validation: {str(e)}"}

    async def reorder_tasks_in_story(
        self,
        story_id: str,
        ordered_task_ids: list[str],
    ) -> tuple[bool, dict[str, Any]]:
        """Reorder root-level tasks within a story."""
        if not ordered_task_ids:
            return False, {"error": "task_ids list cannot be empty"}

        try:
            response = await (
                self.supabase_client.table("archon_tasks")
                .select("id")
                .eq("story_id", story_id)
                .eq("parent_task_id", None)
                .aexecute()
            )

            existing_task_ids = [task["id"] for task in (response.data or []) if task.get("id")]

            if not existing_task_ids:
                return False, {"error": f"Story {story_id} has no tasks to reorder"}

            missing_ids = [task_id for task_id in ordered_task_ids if task_id not in existing_task_ids]
            if missing_ids:
                return False, {
                    "error": "One or more tasks do not belong to the target story",
                    "missing_task_ids": missing_ids,
                }

            final_order = ordered_task_ids + [task_id for task_id in existing_task_ids if task_id not in ordered_task_ids]
            reorder_timestamp = datetime.now().isoformat()

            for index, task_id in enumerate(final_order, start=1):
                await self.supabase_client.table("archon_tasks").update(
                    {
                        "task_order": index,
                        "updated_at": reorder_timestamp,
                    }
                ).eq("id", task_id).aexecute()

            updated_response = await (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("story_id", story_id)
                .eq("parent_task_id", None)
                .order("task_order", desc=False)
                .aexecute()
            )

            tasks = updated_response.data or []
            logger.info(f"Reordered {len(final_order)} tasks within story {story_id}")

            return True, {"tasks": tasks}

        except Exception as e:
            logger.error(f"Error reordering tasks in story {story_id}: {str(e)}")
            return False, {"error": f"Error reordering tasks in story: {str(e)}"}

    async def reorder_subtasks_in_task(
        self,
        parent_task_id: str,
        ordered_subtask_ids: list[str],
    ) -> tuple[bool, dict[str, Any]]:
        """Reorder subtasks within a parent task."""
        if not ordered_subtask_ids:
            return False, {"error": "subtask_ids list cannot be empty"}

        try:
            response = await (
                self.supabase_client.table("archon_tasks")
                .select("id")
                .eq("parent_task_id", parent_task_id)
                .aexecute()
            )

            existing_subtask_ids = [task["id"] for task in (response.data or []) if task.get("id")]

            if not existing_subtask_ids:
                return False, {"error": f"Task {parent_task_id} has no subtasks to reorder"}

            missing_ids = [task_id for task_id in ordered_subtask_ids if task_id not in existing_subtask_ids]
            if missing_ids:
                return False, {
                    "error": "One or more subtasks do not belong to the target parent",
                    "missing_subtask_ids": missing_ids,
                }

            final_order = ordered_subtask_ids + [task_id for task_id in existing_subtask_ids if task_id not in ordered_subtask_ids]
            reorder_timestamp = datetime.now().isoformat()

            for index, task_id in enumerate(final_order, start=1):
                await self.supabase_client.table("archon_tasks").update(
                    {
                        "task_order": index,
                        "updated_at": reorder_timestamp,
                    }
                ).eq("id", task_id).aexecute()

            updated_response = await (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("parent_task_id", parent_task_id)
                .order("task_order", desc=False)
                .aexecute()
            )

            subtasks = updated_response.data or []
            logger.info(f"Reordered {len(final_order)} subtasks within parent task {parent_task_id}")

            return True, {"subtasks": subtasks}

        except Exception as e:
            logger.error(f"Error reordering subtasks in task {parent_task_id}: {str(e)}")
            return False, {"error": f"Error reordering subtasks in task: {str(e)}"}

    async def move_task_to_story(
        self,
        task_id: str,
        target_story_id: str,
        *,
        target_position: int | None = None,
        moved_by: str | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        """Move a root-level task to another story."""
        try:
            task_response = (
                self.supabase_client.table("archon_tasks")
                .select("id, story_id, parent_task_id, project_id, epic_id")
                .eq("id", task_id)
                .single()
                .aexecute()
            )

            task = task_response.data
            if not task:
                return False, {"error": f"Task with ID {task_id} not found"}

            if task.get("parent_task_id"):
                return False, {"error": "move_task_to_story only supports root tasks", "task_id": task_id}

            if task.get("story_id") == target_story_id:
                return True, {"task": task, "changed": False}

            story_response = (
                self.supabase_client.table("archon_stories")
                .select("id, epic_id, project_id")
                .eq("id", target_story_id)
                .single()
                .aexecute()
            )

            if not story_response.data:
                return False, {"error": f"Story with ID {target_story_id} not found"}

            target_story = story_response.data

            next_order_response = (
                self.supabase_client.table("archon_tasks")
                .select("task_order")
                .eq("story_id", target_story_id)
                .eq("parent_task_id", None)
                .order("task_order", desc=True)
                .limit(1)
                .aexecute()
            )

            if next_order_response.data:
                order_values = [row.get("task_order") for row in next_order_response.data if row.get("task_order") is not None]
                next_order = (max(order_values) if order_values else 0) + 1
            else:
                next_order = 1

            update_success, update_result = await self.update_task_with_hierarchy_validation(
                task_id=task_id,
                parent_task_id=None,
                story_id=target_story_id,
                task_order=next_order,
                epic_id=target_story.get("epic_id"),
                project_id=target_story.get("project_id") or task.get("project_id"),
            )

            if not update_success:
                return update_result

            updated_task = update_result["task"]
            old_story_id = task.get("story_id")

            from src.server.services.projects.story_service import StoryService

            story_service = StoryService(self.supabase_client)
            try:
                if old_story_id and old_story_id != target_story_id:
                    await story_service.calculate_story_progress(old_story_id)
                await story_service.calculate_story_progress(target_story_id)
            except Exception as progress_error:
                logger.warning(
                    f"Failed to recalculate story progress during task move | task_id={task_id} | error={progress_error}"
                )

            reordered_task = updated_task
            if target_position is not None:
                tasks_resp = (
                    self.supabase_client.table("archon_tasks")
                    .select("id")
                    .eq("story_id", target_story_id)
                    .eq("parent_task_id", None)
                    .order("task_order", desc=False)
                    .aexecute()
                )

                task_ids = [row["id"] for row in (tasks_resp.data or []) if row.get("id")]

                if task_id not in task_ids:
                    task_ids.append(task_id)

                task_ids = [tid for tid in task_ids if tid != task_id]
                insert_index = max(0, min(target_position, len(task_ids)))
                task_ids.insert(insert_index, task_id)

                reorder_success, reorder_result = await self.reorder_tasks_in_story(target_story_id, task_ids)
                if reorder_success:
                    for task_row in reorder_result.get("tasks", []):
                        if task_row.get("id") == task_id:
                            reordered_task = task_row
                            break

            logger.info(
                f"Task {task_id} moved from story {old_story_id} to {target_story_id} "
                f"by {moved_by or 'system'} | position={target_position}"
            )

            return True, {
                "task": reordered_task,
                "old_story_id": old_story_id,
                "new_story_id": target_story_id,
                "moved_by": moved_by or "system",
            }

        except Exception as e:
            logger.error(f"Error moving task {task_id} to story {target_story_id}: {str(e)}")
            return False, {"error": f"Error moving task: {str(e)}"}

    async def move_subtask_to_parent(
        self,
        task_id: str,
        target_parent_id: str,
        *,
        target_position: int | None = None,
        moved_by: str | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        """Move a subtask under a different parent task."""
        try:
            subtask_response = (
                self.supabase_client.table("archon_tasks")
                .select("id, story_id, parent_task_id, project_id, epic_id")
                .eq("id", task_id)
                .single()
                .aexecute()
            )

            subtask = subtask_response.data
            if not subtask:
                return False, {"error": f"Task with ID {task_id} not found"}

            parent_response = (
                self.supabase_client.table("archon_tasks")
                .select("id, story_id, project_id, epic_id")
                .eq("id", target_parent_id)
                .single()
                .aexecute()
            )

            parent_task = parent_response.data
            if not parent_task:
                return False, {"error": f"Parent task with ID {target_parent_id} not found"}

            target_story_id = parent_task.get("story_id")

            next_order_response = (
                self.supabase_client.table("archon_tasks")
                .select("task_order")
                .eq("parent_task_id", target_parent_id)
                .order("task_order", desc=True)
                .limit(1)
                .aexecute()
            )

            if next_order_response.data:
                order_values = [row.get("task_order") for row in next_order_response.data if row.get("task_order") is not None]
                next_order = (max(order_values) if order_values else 0) + 1
            else:
                next_order = 1

            update_success, update_result = await self.update_task_with_hierarchy_validation(
                task_id=task_id,
                parent_task_id=target_parent_id,
                story_id=target_story_id,
                task_order=next_order,
                epic_id=parent_task.get("epic_id"),
                project_id=parent_task.get("project_id") or subtask.get("project_id"),
            )

            if not update_success:
                return update_result

            updated_task = update_result["task"]
            old_parent_id = subtask.get("parent_task_id")

            reordered_task = updated_task
            if target_position is not None:
                subtasks_resp = (
                    self.supabase_client.table("archon_tasks")
                    .select("id")
                    .eq("parent_task_id", target_parent_id)
                    .order("task_order", desc=False)
                    .aexecute()
                )

                subtask_ids = [row["id"] for row in (subtasks_resp.data or []) if row.get("id")]

                if task_id not in subtask_ids:
                    subtask_ids.append(task_id)

                subtask_ids = [sid for sid in subtask_ids if sid != task_id]
                insert_index = max(0, min(target_position, len(subtask_ids)))
                subtask_ids.insert(insert_index, task_id)

                reorder_success, reorder_result = await self.reorder_subtasks_in_task(target_parent_id, subtask_ids)
                if reorder_success:
                    for task_row in reorder_result.get("subtasks", []):
                        if task_row.get("id") == task_id:
                            reordered_task = task_row
                            break

            logger.info(
                f"Subtask {task_id} moved from parent {old_parent_id} to {target_parent_id} "
                f"by {moved_by or 'system'} | position={target_position}"
            )

            return True, {
                "task": reordered_task,
                "old_parent_task_id": old_parent_id,
                "new_parent_task_id": target_parent_id,
                "moved_by": moved_by or "system",
            }

        except Exception as e:
            logger.error(f"Error moving subtask {task_id} to parent {target_parent_id}: {str(e)}")
            return False, {"error": f"Error moving subtask: {str(e)}"}
