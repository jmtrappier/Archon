"""
Task Hierarchy Service - Subtasks, hierarchy validation and tree operations
Extracted from TaskService to reduce file size and improve maintainability
"""

from typing import Any, Dict, List, Optional
from ...utils import get_supabase_client
from ...config.logfire_config import logfire
from datetime import datetime


class TaskHierarchyService:
    def __init__(self, supabase_client=None):
        self.supabase_client = supabase_client or get_supabase_client()

    async def create_subtask(
        self,
        parent_task_id: str,
        title: str,
        description: str = "",
        status: str = "todo",
        priority: str = "medium",
        assignee: str = "User",
        task_order: int = 0,
    ) -> tuple[bool, dict[str, Any]]:
        """Create a subtask under a parent task"""
        try:
            # Verify parent task exists and get its story_id
            parent_check = (
                self.supabase_client.table("archon_tasks")
                .select("id, story_id, project_id, archived")
                .eq("id", parent_task_id)
                .execute()
            )

            if not parent_check.data:
                return False, {"error": f"Parent task with ID {parent_task_id} not found"}

            parent_task = parent_check.data[0]

            if parent_task.get("archived"):
                return False, {"error": f"Cannot create subtask under archived parent task {parent_task_id}"}

            story_id = parent_task["story_id"]
            project_id = parent_task["project_id"]

            # Use TaskCRUDService to create the task with parent_task_id
            from .task_crud_service import TaskCRUDService
            crud_service = TaskCRUDService(self.supabase_client)

            return await crud_service.create_task(
                story_id=story_id,
                title=title,
                description=description,
                status=status,
                priority=priority,
                assignee=assignee,
                parent_task_id=parent_task_id,
                task_order=task_order,
            )

        except Exception as e:
            logfire.error(f"Error creating subtask: {str(e)}")
            return False, {"error": f"Error creating subtask: {str(e)}"}

    async def get_subtasks_by_parent(
        self, parent_task_id: str, include_archived: bool = False
    ) -> tuple[bool, dict[str, Any]]:
        """Get all direct children of a parent task"""
        try:
            query = (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("parent_task_id", parent_task_id)
            )

            if not include_archived:
                query = query.or_("archived.is.null,archived.is.false")

            query = query.order("task_order", desc=False).order("created_at", desc=False)

            result = query.execute()

            if result.data is not None:
                return True, {"subtasks": result.data, "total_count": len(result.data)}
            else:
                return False, {"error": "Failed to retrieve subtasks"}

        except Exception as e:
            logfire.error(f"Error getting subtasks: {str(e)}")
            return False, {"error": f"Error getting subtasks: {str(e)}"}

    async def get_task_subtasks_recursive(
        self, task_id: str, include_archived: bool = False
    ) -> tuple[bool, dict[str, Any]]:
        """Get all subtasks recursively for a task (entire subtree)"""
        try:
            # Use recursive CTE to get all descendants
            recursive_query = f"""
                WITH RECURSIVE task_tree AS (
                    -- Base case: direct children
                    SELECT id, parent_task_id, title, status, priority, assignee,
                           task_order, created_at, archived, 1 as depth
                    FROM archon_tasks
                    WHERE parent_task_id = '{task_id}'
                    {'AND (archived = false OR archived IS NULL)' if not include_archived else ''}

                    UNION ALL

                    -- Recursive case: children of children
                    SELECT t.id, t.parent_task_id, t.title, t.status, t.priority,
                           t.assignee, t.task_order, t.created_at, t.archived, tt.depth + 1
                    FROM archon_tasks t
                    INNER JOIN task_tree tt ON t.parent_task_id = tt.id
                    WHERE tt.depth < 10  -- Prevent infinite recursion
                    {'AND (t.archived = false OR t.archived IS NULL)' if not include_archived else ''}
                )
                SELECT * FROM task_tree
                ORDER BY depth, task_order, created_at;
            """

            result = self.supabase_client.rpc('execute_sql', {'query': recursive_query}).execute()

            if result.data is not None:
                return True, {"subtasks": result.data, "total_count": len(result.data)}
            else:
                return False, {"error": "Failed to retrieve recursive subtasks"}

        except Exception as e:
            logfire.error(f"Error getting recursive subtasks: {str(e)}")
            return False, {"error": f"Error getting recursive subtasks: {str(e)}"}

    async def get_task_hierarchy_path(self, task_id: str) -> tuple[bool, dict[str, Any]]:
        """Get the full hierarchy path from root to this task"""
        try:
            # Use recursive CTE to get path to root
            path_query = f"""
                WITH RECURSIVE task_path AS (
                    -- Start with the target task
                    SELECT id, parent_task_id, title, 0 as depth
                    FROM archon_tasks
                    WHERE id = '{task_id}'

                    UNION ALL

                    -- Go up the hierarchy
                    SELECT t.id, t.parent_task_id, t.title, tp.depth + 1
                    FROM archon_tasks t
                    INNER JOIN task_path tp ON t.id = tp.parent_task_id
                    WHERE tp.depth < 10  -- Prevent infinite recursion
                )
                SELECT * FROM task_path
                ORDER BY depth DESC;  -- Root first, target task last
            """

            result = self.supabase_client.rpc('execute_sql', {'query': path_query}).execute()

            if result.data is not None:
                path = result.data
                return True, {
                    "hierarchy_path": path,
                    "path_depth": len(path),
                    "root_task_id": path[0]["id"] if path else None,
                }
            else:
                return False, {"error": "Failed to retrieve task hierarchy path"}

        except Exception as e:
            logfire.error(f"Error getting task hierarchy path: {str(e)}")
            return False, {"error": f"Error getting task hierarchy path: {str(e)}"}

    async def archive_task_with_subtasks(
        self, task_id: str, archived_by: str = "system"
    ) -> tuple[bool, dict[str, Any]]:
        """Archive a task and all its subtasks recursively"""
        try:
            # First get all subtasks recursively
            success, subtasks_result = await self.get_task_subtasks_recursive(task_id, include_archived=False)

            if not success:
                return False, {"error": f"Failed to get subtasks: {subtasks_result.get('error')}"}

            all_task_ids = [task_id] + [subtask["id"] for subtask in subtasks_result.get("subtasks", [])]

            # Archive all tasks in one batch
            current_time = datetime.utcnow().isoformat()
            result = (
                self.supabase_client.table("archon_tasks")
                .update({
                    "archived": True,
                    "archived_at": current_time,
                    "archived_by": archived_by,
                })
                .in_("id", all_task_ids)
                .execute()
            )

            if result.data:
                archived_count = len(result.data)
                logfire.info(f"Task and subtasks archived | task_id={task_id} | total_archived={archived_count}")

                message = "Task archived successfully" if archived_count == 1 else f"Task and {archived_count-1} subtasks archived successfully"

                return True, {
                    "message": message,
                    "total_archived": archived_count,
                    "archived_tasks": result.data,
                }
            else:
                return False, {"error": f"Failed to archive task {task_id}"}

        except Exception as e:
            logfire.error(f"Error archiving task with subtasks: {str(e)}")
            return False, {"error": f"Error archiving task with subtasks: {str(e)}"}

    async def get_task_hierarchy(
        self, project_id: str, include_archived: bool = False
    ) -> tuple[bool, dict[str, Any]]:
        """Get complete task hierarchy for a project as a tree structure"""
        try:
            # Get all tasks for the project
            query = (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("project_id", project_id)
            )

            if not include_archived:
                query = query.or_("archived.is.null,archived.is.false")

            query = query.order("story_id").order("task_order").order("created_at")

            result = query.execute()

            if result.data is None:
                return False, {"error": "Failed to retrieve tasks"}

            tasks = result.data

            # Build hierarchy tree
            task_map = {task["id"]: {**task, "subtasks": []} for task in tasks}
            root_tasks = []
            subtask_count = 0

            for task in tasks:
                parent_id = task.get("parent_task_id")
                if parent_id and parent_id in task_map:
                    # This is a subtask
                    task_map[parent_id]["subtasks"].append(task_map[task["id"]])
                    subtask_count += 1
                else:
                    # This is a root task
                    root_tasks.append(task_map[task["id"]])

            return True, {
                "hierarchy": root_tasks,
                "levels_count": len(root_tasks),
                "subtasks_count": subtask_count,
                "total_count": len(tasks),
            }

        except Exception as e:
            logfire.error(f"Error getting task hierarchy: {str(e)}")
            return False, {"error": f"Error getting task hierarchy: {str(e)}"}

    async def validate_hierarchy_consistency(
        self, project_id: str = None
    ) -> tuple[bool, dict[str, Any]]:
        """Validate task hierarchy integrity and detect issues"""
        try:
            # Base query
            query = self.supabase_client.table("archon_tasks").select("id, parent_task_id, story_id")

            if project_id:
                query = query.eq("project_id", project_id)

            result = query.execute()

            if result.data is None:
                return False, {"error": "Failed to retrieve tasks for validation"}

            tasks = result.data
            task_ids = set(task["id"] for task in tasks)
            issues = []

            # Check for orphaned tasks (parent_task_id points to non-existent task)
            missing_parents = []
            for task in tasks:
                if task["parent_task_id"] and task["parent_task_id"] not in task_ids:
                    missing_parents.append(task["id"])

            if missing_parents:
                issues.append({
                    "type": "missing_parents",
                    "description": "Tasks with non-existent parent tasks",
                    "missing_task_ids": missing_parents,
                })

            # Check for cycles in hierarchy (task cannot be its own ancestor)
            cycles = []
            for task in tasks:
                if task["parent_task_id"]:
                    visited = set()
                    current_id = task["parent_task_id"]
                    path = [task["id"]]

                    while current_id and current_id not in visited:
                        if current_id == task["id"]:
                            cycles.append({
                                "task_id": task["id"],
                                "cycle_path": path + [current_id],
                            })
                            break

                        visited.add(current_id)
                        path.append(current_id)

                        # Find parent of current task
                        parent_task = next(
                            (t for t in tasks if t["id"] == current_id), None
                        )
                        current_id = parent_task["parent_task_id"] if parent_task else None

            if cycles:
                issues.append({
                    "type": "hierarchy_cycles",
                    "description": "Tasks that create circular dependencies",
                    "cycles": cycles,
                })

            # Check depth limits (max 10 levels)
            excessive_depth = []
            for task in tasks:
                if not task["parent_task_id"]:  # Start from root tasks
                    depth = self._calculate_max_depth(task["id"], tasks)
                    if depth > 10:
                        excessive_depth.append({
                            "root_task_id": task["id"],
                            "max_depth_reached": depth,
                        })

            if excessive_depth:
                issues.append({
                    "type": "excessive_depth",
                    "description": "Task hierarchies exceeding maximum depth of 10",
                    "tasks": excessive_depth,
                })

            is_valid = len(issues) == 0

            return True, {
                "is_valid": is_valid,
                "validation_errors": issues,
                "total_tasks_checked": len(tasks),
            }

        except Exception as e:
            logfire.error(f"Error validating hierarchy consistency: {str(e)}")
            return False, {"error": f"Error validating hierarchy consistency: {str(e)}"}

    def _calculate_max_depth(self, root_task_id: str, all_tasks: List[Dict]) -> int:
        """Helper method to calculate maximum depth from a root task"""
        max_depth = 0
        children = [task for task in all_tasks if task["parent_task_id"] == root_task_id]

        for child in children:
            child_depth = 1 + self._calculate_max_depth(child["id"], all_tasks)
            max_depth = max(max_depth, child_depth)

        return max_depth

    async def get_subtasks_by_task(
        self, task_id: str, include_archived: bool = False
    ) -> tuple[bool, dict[str, Any]]:
        """Get subtasks for a specific task (direct children only)"""
        try:
            return await self.get_subtasks_by_parent(task_id, include_archived)
        except Exception as e:
            logfire.error(f"Error getting subtasks by task: {str(e)}")
            return False, {"error": f"Error getting subtasks by task: {str(e)}"}