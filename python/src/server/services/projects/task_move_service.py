"""
Task Move Service - Task reordering, moving between stories and parent changes
Extracted from TaskService to reduce file size and improve maintainability
"""

from typing import Any, Dict, List, Optional
from ...utils import get_supabase_client
from ...config.logfire_config import logfire
from datetime import datetime


class TaskMoveService:
    def __init__(self, supabase_client=None):
        self.supabase_client = supabase_client or get_supabase_client()

    async def update_task_with_hierarchy_validation(
        self,
        task_id: str,
        title: str = None,
        description: str = None,
        status: str = None,
        priority: str = None,
        assignee: str = None,
        task_order: int = None,
        feature: str = None,
        parent_task_id: str = None,
    ) -> tuple[bool, dict[str, Any]]:
        """Update task with hierarchy validation when parent changes"""
        try:
            # Get current task
            current_task_result = (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("id", task_id)
                .execute()
            )

            if not current_task_result.data:
                return False, {"error": f"Task with ID {task_id} not found"}

            current_task = current_task_result.data[0]

            # If parent_task_id is changing, validate the new hierarchy
            if parent_task_id is not None and parent_task_id != current_task.get("parent_task_id"):
                # Validate new parent
                if parent_task_id:  # Not moving to root level
                    parent_check = (
                        self.supabase_client.table("archon_tasks")
                        .select("id, story_id, archived")
                        .eq("id", parent_task_id)
                        .execute()
                    )

                    if not parent_check.data:
                        return False, {"error": f"Parent task with ID {parent_task_id} not found"}

                    parent_task = parent_check.data[0]
                    parent_story_id = parent_task["story_id"]

                    # Ensure parent belongs to same story
                    if parent_story_id != current_task["story_id"]:
                        return False, {
                            "error": f"Parent task belongs to story {parent_story_id}, but task belongs to {current_task['story_id']}"
                        }

                    # Check for potential cycles
                    if await self._would_create_cycle(task_id, parent_task_id):
                        return False, {"error": f"Setting parent {parent_task_id} would create a cycle"}

                    # Validate depth limits
                    from .task_hierarchy_service import TaskHierarchyService
                    hierarchy_service = TaskHierarchyService(self.supabase_client)
                    success, path_result = await hierarchy_service.get_task_hierarchy_path(parent_task_id)

                    if success:
                        current_depth = path_result.get("path_depth", 0)
                        if current_depth >= 10:
                            return False, {"error": f"Parent task is already at depth {current_depth}, maximum is 10"}

            # Use TaskCRUDService for the actual update
            from .task_crud_service import TaskCRUDService
            crud_service = TaskCRUDService(self.supabase_client)

            # Perform update with all parameters
            update_result = await crud_service.update_task(
                task_id=task_id,
                title=title,
                description=description,
                status=status,
                priority=priority,
                assignee=assignee,
                task_order=task_order,
                feature=feature,
            )

            if not update_result[0]:
                return update_result

            # If parent_task_id needs to be updated separately
            if parent_task_id is not None and parent_task_id != current_task.get("parent_task_id"):
                parent_update_data = {"parent_task_id": parent_task_id if parent_task_id else None}

                parent_update_result = (
                    self.supabase_client.table("archon_tasks")
                    .update(parent_update_data)
                    .eq("id", task_id)
                    .execute()
                )

                if not parent_update_result.data:
                    return False, {"error": "Failed to update parent task relationship"}

                logfire.info(f"Task parent updated | task_id={task_id} | new_parent={parent_task_id}")

            return update_result

        except Exception as e:
            logfire.error(f"Error updating task with hierarchy validation: {str(e)}")
            return False, {"error": f"Error updating task with hierarchy validation: {str(e)}"}

    async def _would_create_cycle(self, task_id: str, new_parent_id: str) -> bool:
        """Check if setting new_parent_id as parent of task_id would create a cycle"""
        try:
            # Check if new_parent_id is a descendant of task_id
            from .task_hierarchy_service import TaskHierarchyService
            hierarchy_service = TaskHierarchyService(self.supabase_client)

            success, subtasks_result = await hierarchy_service.get_task_subtasks_recursive(task_id)

            if not success:
                return False  # If we can't check, allow the operation

            descendant_ids = [subtask["id"] for subtask in subtasks_result.get("subtasks", [])]
            return new_parent_id in descendant_ids

        except Exception:
            return False  # If we can't check, allow the operation

    async def reorder_tasks_in_story(
        self, story_id: str, task_ids: List[str], moved_by: str = "User"
    ) -> tuple[bool, dict[str, Any]]:
        """Reorder tasks within a story"""
        try:
            logfire.info(f"Reordering tasks in story | story_id={story_id} | task_count={len(task_ids)}")

            # Verify story exists
            story_check = (
                self.supabase_client.table("archon_stories")
                .select("id")
                .eq("id", story_id)
                .execute()
            )

            if not story_check.data:
                return False, {"error": f"Story with ID {story_id} not found"}

            # Get current tasks in story (only root tasks, not subtasks)
            current_tasks = (
                self.supabase_client.table("archon_tasks")
                .select("id")
                .eq("story_id", story_id)
                .is_("parent_task_id", "null")
                .execute()
            )

            if not current_tasks.data:
                return False, {"error": f"Story {story_id} has no tasks to reorder"}

            current_task_ids = [task["id"] for task in current_tasks.data]

            # Validate that all provided task_ids exist and belong to the story
            if set(task_ids) != set(current_task_ids):
                missing = set(current_task_ids) - set(task_ids)
                extra = set(task_ids) - set(current_task_ids)
                return False, {
                    "error": "Task ID mismatch",
                    "missing_task_ids": list(missing),
                    "extra_task_ids": list(extra),
                }

            # Update task orders
            updated_tasks = []
            for index, task_id in enumerate(task_ids):
                result = (
                    self.supabase_client.table("archon_tasks")
                    .update({"task_order": index, "moved_by": moved_by})
                    .eq("id", task_id)
                    .execute()
                )

                if result.data:
                    updated_tasks.extend(result.data)

            logfire.info(f"Tasks reordered successfully | story_id={story_id} | updated_count={len(updated_tasks)}")

            return True, {
                "message": "Tasks reordered successfully",
                "updated_tasks": updated_tasks,
            }

        except Exception as e:
            logfire.error(f"Error reordering tasks in story: {str(e)}")
            return False, {"error": f"Error reordering tasks in story: {str(e)}"}

    async def reorder_subtasks_in_task(
        self, parent_task_id: str, subtask_ids: List[str], moved_by: str = "User"
    ) -> tuple[bool, dict[str, Any]]:
        """Reorder subtasks within a parent task"""
        try:
            logfire.info(f"Reordering subtasks in task | parent_task_id={parent_task_id} | subtask_count={len(subtask_ids)}")

            # Verify parent task exists
            parent_check = (
                self.supabase_client.table("archon_tasks")
                .select("id")
                .eq("id", parent_task_id)
                .execute()
            )

            if not parent_check.data:
                return False, {"error": f"Parent task with ID {parent_task_id} not found"}

            # Get current subtasks
            current_subtasks = (
                self.supabase_client.table("archon_tasks")
                .select("id")
                .eq("parent_task_id", parent_task_id)
                .execute()
            )

            if not current_subtasks.data:
                return False, {"error": f"Task {parent_task_id} has no subtasks to reorder"}

            current_subtask_ids = [subtask["id"] for subtask in current_subtasks.data]

            # Validate subtask IDs
            if set(subtask_ids) != set(current_subtask_ids):
                missing = set(current_subtask_ids) - set(subtask_ids)
                extra = set(subtask_ids) - set(current_subtask_ids)
                return False, {
                    "error": "Subtask ID mismatch",
                    "missing_subtask_ids": list(missing),
                    "extra_subtask_ids": list(extra),
                }

            # Update subtask orders
            updated_subtasks = []
            for index, subtask_id in enumerate(subtask_ids):
                result = (
                    self.supabase_client.table("archon_tasks")
                    .update({"task_order": index, "moved_by": moved_by})
                    .eq("id", subtask_id)
                    .execute()
                )

                if result.data:
                    updated_subtasks.extend(result.data)

            logfire.info(f"Subtasks reordered successfully | parent_task_id={parent_task_id} | updated_count={len(updated_subtasks)}")

            return True, {
                "message": "Subtasks reordered successfully",
                "updated_subtasks": updated_subtasks,
            }

        except Exception as e:
            logfire.error(f"Error reordering subtasks in task: {str(e)}")
            return False, {"error": f"Error reordering subtasks in task: {str(e)}"}

    async def move_task_to_story(
        self,
        task_id: str,
        target_story_id: str,
        target_position: int = None,
        moved_by: str = "User",
    ) -> tuple[bool, dict[str, Any]]:
        """Move a task to a different story"""
        try:
            logfire.info(f"Moving task to story | task_id={task_id} | target_story_id={target_story_id}")

            # Get current task
            task_result = (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("id", task_id)
                .execute()
            )

            if not task_result.data:
                return False, {"error": f"Task with ID {task_id} not found"}

            current_task = task_result.data[0]
            old_story_id = current_task["story_id"]

            # Verify target story exists and get project_id
            story_result = (
                self.supabase_client.table("archon_stories")
                .select("id, project_id")
                .eq("id", target_story_id)
                .execute()
            )

            if not story_result.data:
                return False, {"error": f"Story with ID {target_story_id} not found"}

            target_story = story_result.data[0]

            # Update task
            update_data = {
                "story_id": target_story_id,
                "project_id": target_story["project_id"],
                "moved_by": moved_by,
                "parent_task_id": None,  # Reset parent when moving to different story
            }

            if target_position is not None:
                update_data["task_order"] = target_position

            result = (
                self.supabase_client.table("archon_tasks")
                .update(update_data)
                .eq("id", task_id)
                .execute()
            )

            if result.data:
                logfire.info(f"Task moved successfully | task_id={task_id} | old_story={old_story_id} | new_story={target_story_id}")

                return True, {
                    "message": "Task moved successfully",
                    "task": result.data[0],
                    "old_story_id": old_story_id,
                    "new_story_id": target_story_id,
                }
            else:
                return False, {"error": "Failed to move task"}

        except Exception as e:
            logfire.error(f"Error moving task: {str(e)}")
            return False, {"error": f"Error moving task: {str(e)}"}

    async def move_subtask_to_parent(
        self,
        subtask_id: str,
        target_parent_id: str,
        target_position: int = None,
        moved_by: str = "User",
    ) -> tuple[bool, dict[str, Any]]:
        """Move a subtask to a different parent task"""
        try:
            logfire.info(f"Moving subtask to parent | subtask_id={subtask_id} | target_parent_id={target_parent_id}")

            # Get current subtask
            subtask_result = (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("id", subtask_id)
                .execute()
            )

            if not subtask_result.data:
                return False, {"error": f"Task with ID {subtask_id} not found"}

            current_subtask = subtask_result.data[0]
            old_parent_task_id = current_subtask.get("parent_task_id")

            # Verify target parent exists and belongs to same story
            parent_result = (
                self.supabase_client.table("archon_tasks")
                .select("id, story_id, project_id")
                .eq("id", target_parent_id)
                .execute()
            )

            if not parent_result.data:
                return False, {"error": f"Parent task with ID {target_parent_id} not found"}

            target_parent = parent_result.data[0]

            # Ensure same story
            if target_parent["story_id"] != current_subtask["story_id"]:
                return False, {
                    "error": f"Target parent belongs to different story. Current: {current_subtask['story_id']}, Target: {target_parent['story_id']}"
                }

            # Check for cycles
            if await self._would_create_cycle(subtask_id, target_parent_id):
                return False, {"error": f"Moving to parent {target_parent_id} would create a cycle"}

            # Update subtask
            update_data = {
                "parent_task_id": target_parent_id,
                "moved_by": moved_by,
            }

            if target_position is not None:
                update_data["task_order"] = target_position

            result = (
                self.supabase_client.table("archon_tasks")
                .update(update_data)
                .eq("id", subtask_id)
                .execute()
            )

            if result.data:
                logfire.info(f"Subtask moved successfully | subtask_id={subtask_id} | old_parent={old_parent_task_id} | new_parent={target_parent_id}")

                return True, {
                    "message": "Subtask moved successfully",
                    "subtask": result.data[0],
                    "old_parent_task_id": old_parent_task_id,
                    "new_parent_task_id": target_parent_id,
                }
            else:
                return False, {"error": "Failed to move subtask"}

        except Exception as e:
            logfire.error(f"Error moving subtask: {str(e)}")
            return False, {"error": f"Error moving subtask: {str(e)}"}