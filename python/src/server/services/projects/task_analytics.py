"""
Task Analytics Service - Task counts, metrics and analytics
Extracted from TaskService to reduce file size and improve maintainability
"""

from typing import Any, Dict, List, Optional
from ...utils import get_supabase_client
from ...config.logfire_config import logfire


class TaskAnalyticsService:
    def __init__(self, supabase_client=None):
        self.supabase_client = supabase_client or get_supabase_client()

    async def get_all_project_task_counts(self) -> tuple[bool, Dict[str, Dict[str, int]]]:
        """
        Get task counts for all projects in a single batch query.
        Returns counts grouped by project_id with todo, doing, and done counts.
        Review status is included in doing count to match frontend logic.
        """
        try:
            logfire.debug("Getting task counts for all projects")

            # Single query to get all task counts grouped by project and status
            # Note: Review tasks are counted as "doing" to match frontend expectations
            query = """
                SELECT
                    project_id,
                    status,
                    COUNT(*) as count
                FROM archon_tasks
                WHERE archived = false OR archived IS NULL
                GROUP BY project_id, status
                ORDER BY project_id;
            """

            result = self.supabase_client.rpc('execute_sql', {'query': query}).execute()

            if not result.data:
                logfire.debug("No task count data found")
                return True, {}

            # Process results into expected format
            project_counts = {}

            for row in result.data:
                project_id = row['project_id']
                status = row['status']
                count = row['count']

                if project_id not in project_counts:
                    project_counts[project_id] = {
                        'todo': 0,
                        'doing': 0,
                        'done': 0,
                        'total': 0
                    }

                # Map statuses to frontend categories
                if status == 'todo':
                    project_counts[project_id]['todo'] += count
                elif status in ['doing', 'review']:  # review counts as doing
                    project_counts[project_id]['doing'] += count
                elif status == 'done':
                    project_counts[project_id]['done'] += count

                project_counts[project_id]['total'] += count

            logfire.debug(f"Task counts retrieved for {len(project_counts)} projects")
            return True, project_counts

        except Exception as e:
            logfire.error(f"Error fetching task counts: {str(e)}")
            return False, {"error": f"Error fetching task counts: {str(e)}"}

    async def list_tasks(
        self,
        project_id: str = None,
        story_id: str = None,
        assignee: str = None,
        status: str = None,
        include_closed: bool = True,
        include_archived: bool = False,
        limit: int = None,
        offset: int = 0,
    ) -> tuple[bool, dict[str, Any]]:
        """List tasks with filtering and pagination"""
        try:
            logfire.debug(
                f"Listing tasks | project_id={project_id} | story_id={story_id} | "
                f"assignee={assignee} | status={status} | include_closed={include_closed} | "
                f"include_archived={include_archived} | limit={limit} | offset={offset}"
            )

            # Base query with source info
            query = self.supabase_client.table("archon_tasks").select(
                "*, sources:task_sources(*), code_examples:task_code_examples(*)"
            )

            # Apply filters
            filters_applied = []

            if project_id:
                query = query.eq("project_id", project_id)
                filters_applied.append(f"project_id={project_id}")

            if story_id:
                query = query.eq("story_id", story_id)
                filters_applied.append(f"story_id={story_id}")

            if assignee:
                query = query.eq("assignee", assignee)
                filters_applied.append(f"assignee={assignee}")

            if status:
                query = query.eq("status", status)
                filters_applied.append(f"status={status}")

            if not include_closed:
                query = query.neq("status", "done")
                filters_applied.append("exclude_done=true")

            if not include_archived:
                query = query.or_("archived.is.null,archived.is.false")
                filters_applied.append("include_archived=false")

            # Order by creation date (newest first)
            query = query.order("created_at", desc=True)

            # Apply pagination
            if limit:
                query = query.limit(limit)
            if offset:
                query = query.offset(offset)

            result = query.execute()

            tasks = result.data or []

            # Add computed fields for each task
            for task in tasks:
                # Add source counts
                task["sources_count"] = len(task.get("sources", []))
                task["code_examples_count"] = len(task.get("code_examples", []))

            logfire.debug(
                f"Tasks listed successfully | count={len(tasks)} | "
                f"filters_applied={filters_applied}"
            )

            return True, {
                "tasks": tasks,
                "total_count": len(tasks),
                "filters_applied": filters_applied,
            }

        except Exception as e:
            logfire.error(f"Error listing tasks: {str(e)}")
            return False, {"error": f"Error listing tasks: {str(e)}"}

    async def get_tasks_by_story(
        self,
        story_id: str,
        include_archived: bool = False
    ) -> tuple[bool, dict[str, Any]]:
        """Get all tasks for a specific story"""
        try:
            logfire.debug(f"Getting tasks by story | story_id={story_id} | include_archived={include_archived}")

            query = self.supabase_client.table("archon_tasks").select("*").eq("story_id", story_id)

            if not include_archived:
                query = query.or_("archived.is.null,archived.is.false")

            query = query.order("task_order", desc=False).order("created_at", desc=False)

            result = query.execute()

            if result.data is not None:
                logfire.debug(f"Tasks retrieved | story_id={story_id} | count={len(result.data)}")
                return True, {"tasks": result.data, "total_count": len(result.data)}
            else:
                return False, {"error": "Failed to retrieve tasks"}

        except Exception as e:
            logfire.error(f"Error getting tasks by story: {str(e)}")
            return False, {"error": f"Error getting tasks by story: {str(e)}"}

    async def get_tasks_with_epic_story_info(
        self,
        project_id: str = None,
        epic_id: str = None,
        story_id: str = None,
        include_archived: bool = False,
        limit: int = None,
    ) -> tuple[bool, dict[str, Any]]:
        """Get tasks with enriched epic and story information for dashboard display"""
        try:
            logfire.debug(
                f"Getting tasks with epic/story info | project_id={project_id} | "
                f"epic_id={epic_id} | story_id={story_id} | include_archived={include_archived}"
            )

            # Use a SQL query to join tasks with stories and epics for efficient data retrieval
            base_query = """
                SELECT
                    t.*,
                    s.title as story_title,
                    s.epic_id,
                    e.title as epic_title,
                    e.code as epic_code
                FROM archon_tasks t
                LEFT JOIN archon_stories s ON t.story_id = s.id
                LEFT JOIN archon_epics e ON s.epic_id = e.id
                WHERE 1=1
            """

            params = {}
            conditions = []

            if not include_archived:
                conditions.append("AND (t.archived = false OR t.archived IS NULL)")

            if project_id:
                conditions.append("AND t.project_id = %(project_id)s")
                params["project_id"] = project_id

            if epic_id:
                conditions.append("AND s.epic_id = %(epic_id)s")
                params["epic_id"] = epic_id

            if story_id:
                conditions.append("AND t.story_id = %(story_id)s")
                params["story_id"] = story_id

            query = base_query + " ".join(conditions) + " ORDER BY t.created_at DESC"

            if limit:
                query += f" LIMIT {limit}"

            # Execute the raw SQL query
            result = self.supabase_client.rpc(
                'execute_sql',
                {'query': query, 'params': params}
            ).execute()

            tasks_with_info = result.data or []

            logfire.debug(
                f"Tasks with epic/story info retrieved | count={len(tasks_with_info)} | "
                f"project_id={project_id} | epic_id={epic_id} | story_id={story_id}"
            )

            return True, {
                "tasks": tasks_with_info,
                "total_count": len(tasks_with_info),
            }

        except Exception as e:
            logfire.error(f"Error getting tasks with epic/story info: {str(e)}")
            return False, {"error": f"Error getting tasks with epic/story info: {str(e)}"}