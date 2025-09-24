"""
Task CRUD Service - Basic create, read, update, delete operations for tasks
Extracted from TaskService to reduce file size and improve maintainability
"""

from typing import Any
from ...utils import get_supabase_client
from ...config.logfire_config import logfire


class TaskCRUDService:
    def __init__(self, supabase_client=None):
        self.supabase_client = supabase_client or get_supabase_client()

    async def _execute_query(self, query_func):
        """Common error handling wrapper for database queries"""
        try:
            return await query_func()
        except Exception as e:
            return False, {"error": str(e)}

    def validate_priority(self, priority: str) -> tuple[bool, str]:
        """Validate task priority value"""
        valid_priorities = ["low", "medium", "high", "critical"]
        if priority not in valid_priorities:
            return False, f"Priority must be one of: {', '.join(valid_priorities)}"
        return True, ""

    def validate_status(self, status: str) -> tuple[bool, str]:
        """Validate task status value"""
        valid_statuses = ["brainstorming", "todo", "doing", "review", "done", "waiting"]
        if status not in valid_statuses:
            return False, f"Status must be one of: {', '.join(valid_statuses)}"
        return True, ""

    def validate_assignee(self, assignee: str) -> tuple[bool, str]:
        """Validate task assignee"""
        if assignee and len(assignee.strip()) == 0:
            return False, "Assignee cannot be empty string"
        return True, ""

    async def create_task(
        self,
        story_id: str,
        title: str,
        description: str = "",
        status: str = "todo",
        priority: str = "medium",
        assignee: str = "User",
        parent_task_id: str = None,
        task_order: int = 0,
        feature: str = None,
    ) -> tuple[bool, dict[str, Any]]:
        """Create a new task with comprehensive validation and hierarchy support"""
        try:
            logfire.info(
                f"Creating task | story_id={story_id} | title={title} | parent_task_id={parent_task_id}"
            )

            # Validate required fields
            if not title or not title.strip():
                return False, {"error": "Title is required and cannot be empty"}

            # Validate priority
            priority_valid, priority_msg = self.validate_priority(priority)
            if not priority_valid:
                return False, {"error": priority_msg}

            # Validate status
            status_valid, status_msg = self.validate_status(status)
            if not status_valid:
                return False, {"error": status_msg}

            # Validate assignee
            assignee_valid, assignee_msg = self.validate_assignee(assignee)
            if not assignee_valid:
                return False, {"error": assignee_msg}

            # Verify story exists
            story_check = (
                self.supabase_client.table("archon_stories")
                .select("id, project_id")
                .eq("id", story_id)
                .execute()
            )

            if not story_check.data:
                return False, {"error": f"Story with ID {story_id} not found"}

            story = story_check.data[0]
            project_id = story["project_id"]

            # Hierarchy validation for subtasks
            depth = 0
            if parent_task_id:
                # Verify parent task exists and belongs to same story
                parent_check = (
                    self.supabase_client.table("archon_tasks")
                    .select("id, story_id, parent_task_id")
                    .eq("id", parent_task_id)
                    .eq("archived", False)
                    .execute()
                )

                if not parent_check.data:
                    return False, {"error": f"Parent task with ID {parent_task_id} not found"}

                parent_task = parent_check.data[0]
                parent_story_id = parent_task["story_id"]

                # Ensure parent and child belong to same story
                if parent_story_id != story_id:
                    return False, {
                        "error": f"Parent task belongs to story {parent_story_id}, but task belongs to {story_id}"
                    }

                # Calculate depth to prevent excessive nesting (max 10 levels)
                current_task = parent_task
                depth = 1
                while current_task.get("parent_task_id") and depth < 10:
                    parent_parent_check = (
                        self.supabase_client.table("archon_tasks")
                        .select("parent_task_id")
                        .eq("id", current_task["parent_task_id"])
                        .execute()
                    )

                    if parent_parent_check.data:
                        current_task = {"parent_task_id": parent_parent_check.data[0]["parent_task_id"]}
                        depth += 1
                    else:
                        break

                if depth >= 10:
                    return False, {"error": f"Parent task is already at depth {depth}, maximum is 10"}

                # Cannot create subtask under archived parent
                archived_check = (
                    self.supabase_client.table("archon_tasks")
                    .select("archived")
                    .eq("id", parent_task_id)
                    .execute()
                )

                if archived_check.data and archived_check.data[0].get("archived"):
                    return False, {"error": f"Cannot create subtask under archived parent task {parent_task_id}"}

            # Prepare task data
            task_data = {
                "story_id": story_id,
                "project_id": project_id,
                "title": title.strip(),
                "description": description.strip() if description else "",
                "status": status,
                "priority": priority,
                "assignee": assignee if assignee else "User",
                "task_order": task_order,
                "archived": False,
            }

            if parent_task_id:
                task_data["parent_task_id"] = parent_task_id

            if feature:
                task_data["feature"] = feature.strip()

            # Insert task
            result = self.supabase_client.table("archon_tasks").insert(task_data).execute()

            if result.data:
                created_task = result.data[0]
                task_type = "subtask" if parent_task_id else "task"

                logfire.info(
                    f"Task created successfully | task_id={created_task['id']} | type={task_type} | depth={depth}"
                )

                return True, {"task": created_task}
            else:
                return False, {"error": "Failed to create task"}

        except Exception as e:
            logfire.error(f"Error creating task: {str(e)}")
            return False, {"error": f"Error creating task: {str(e)}"}

    async def get_task(self, task_id: str) -> tuple[bool, dict[str, Any]]:
        """Get a single task by ID with source info"""
        try:
            result = (
                self.supabase_client.table("archon_tasks")
                .select("*, sources:task_sources(*)")
                .eq("id", task_id)
                .execute()
            )

            if result.data:
                return True, {"task": result.data[0]}
            else:
                return False, {"error": f"Task with ID {task_id} not found"}
        except Exception as e:
            return False, {"error": f"Error getting task: {str(e)}"}

    async def update_task(
        self,
        task_id: str,
        title: str = None,
        description: str = None,
        status: str = None,
        priority: str = None,
        assignee: str = None,
        task_order: int = None,
        feature: str = None,
    ) -> tuple[bool, dict[str, Any]]:
        """Update task with validation"""
        try:
            # Check if task exists
            task_check = (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("id", task_id)
                .execute()
            )

            if not task_check.data:
                return False, {"error": f"Task with ID {task_id} not found"}

            # Build update data
            update_data = {}

            if title is not None:
                if not title.strip():
                    return False, {"error": "Title cannot be empty"}
                update_data["title"] = title.strip()

            if description is not None:
                update_data["description"] = description.strip()

            if status is not None:
                status_valid, status_msg = self.validate_status(status)
                if not status_valid:
                    return False, {"error": status_msg}
                update_data["status"] = status

            if priority is not None:
                priority_valid, priority_msg = self.validate_priority(priority)
                if not priority_valid:
                    return False, {"error": priority_msg}
                update_data["priority"] = priority

            if assignee is not None:
                assignee_valid, assignee_msg = self.validate_assignee(assignee)
                if not assignee_valid:
                    return False, {"error": assignee_msg}
                update_data["assignee"] = assignee

            if task_order is not None:
                update_data["task_order"] = task_order

            if feature is not None:
                update_data["feature"] = feature.strip() if feature else None

            if not update_data:
                return False, {"error": "No valid fields provided for update"}

            # Update task
            result = (
                self.supabase_client.table("archon_tasks")
                .update(update_data)
                .eq("id", task_id)
                .execute()
            )

            if result.data:
                logfire.info(f"Task updated successfully | task_id={task_id}")
                return True, {"task": result.data[0]}
            else:
                return False, {"error": "Failed to update task"}

        except Exception as e:
            logfire.error(f"Error updating task: {str(e)}")
            return False, {"error": f"Error updating task: {str(e)}"}

    async def archive_task(self, task_id: str) -> tuple[bool, dict[str, Any]]:
        """Archive a single task (soft delete)"""
        try:
            # Check if task exists and is not already archived
            task_check = (
                self.supabase_client.table("archon_tasks")
                .select("archived")
                .eq("id", task_id)
                .execute()
            )

            if not task_check.data:
                return False, {"error": f"Task with ID {task_id} not found"}

            if task_check.data[0].get("archived"):
                return False, {"error": f"Task with ID {task_id} is already archived"}

            # Archive the task
            from datetime import datetime
            result = (
                self.supabase_client.table("archon_tasks")
                .update({
                    "archived": True,
                    "archived_at": datetime.utcnow().isoformat(),
                    "archived_by": "system"
                })
                .eq("id", task_id)
                .execute()
            )

            if result.data:
                logfire.info(f"Task archived successfully | task_id={task_id}")
                return True, {"message": "Task archived successfully"}
            else:
                return False, {"error": "Failed to archive task"}

        except Exception as e:
            logfire.error(f"Error archiving task: {str(e)}")
            return False, {"error": f"Error archiving task: {str(e)}"}