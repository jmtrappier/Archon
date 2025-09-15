"""
Consolidated task management tools for Archon MCP Server.

Reduces the number of individual CRUD operations while maintaining full functionality.
"""

import json
import logging
from typing import Any
from urllib.parse import urljoin

import httpx

from mcp.server.fastmcp import Context, FastMCP
from src.mcp_server.utils.error_handling import MCPErrorFormatter
from src.mcp_server.utils.timeout_config import get_default_timeout
from src.server.config.service_discovery import get_api_url

logger = logging.getLogger(__name__)

# Optimization constants
MAX_DESCRIPTION_LENGTH = 1000
DEFAULT_PAGE_SIZE = 10  # Reduced from 50

def truncate_text(text: str, max_length: int = MAX_DESCRIPTION_LENGTH) -> str:
    """Truncate text to maximum length with ellipsis."""
    if text and len(text) > max_length:
        return text[:max_length - 3] + "..."
    return text

def optimize_task_response(task: dict) -> dict:
    """Optimize task object for MCP response."""
    task = task.copy()  # Don't modify original
    
    # Truncate description if present
    if "description" in task and task["description"]:
        task["description"] = truncate_text(task["description"])
    
    # Replace arrays with counts
    if "sources" in task and isinstance(task["sources"], list):
        task["sources_count"] = len(task["sources"])
        del task["sources"]
    
    if "code_examples" in task and isinstance(task["code_examples"], list):
        task["code_examples_count"] = len(task["code_examples"])
        del task["code_examples"]
    
    return task


def register_task_tools(mcp: FastMCP):
    """Register consolidated task management tools with the MCP server."""

    @mcp.tool()
    async def find_tasks(
        ctx: Context,
        query: str | None = None,  # Add search capability
        task_id: str | None = None,  # For getting single task
        filter_by: str | None = None,
        filter_value: str | None = None,
        project_id: str | None = None,
        include_closed: bool = True,
        page: int = 1,
        per_page: int = DEFAULT_PAGE_SIZE,  # Use optimized default
    ) -> str:
        """
        Find and search tasks (consolidated: list + search + get).
        
        Args:
            query: Keyword search in title, description, feature (optional)
            task_id: Get specific task by ID (returns full details)
            filter_by: "status" | "project" | "assignee" (optional)
            filter_value: Filter value (e.g., "todo", "doing", "review", "done")
            project_id: Project UUID (optional, for additional filtering)
            include_closed: Include done tasks in results
            page: Page number for pagination
            per_page: Items per page (default: 10)
        
        Returns:
            JSON array of tasks or single task (optimized payloads for lists)
        
        Examples:
            find_tasks() # All tasks
            find_tasks(query="auth") # Search for "auth"
            find_tasks(task_id="task-123") # Get specific task (full details)
            find_tasks(filter_by="status", filter_value="todo") # Only todo tasks
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()
            
            # Single task get mode
            if task_id:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.get(urljoin(api_url, f"/api/tasks/{task_id}"))
                    
                    if response.status_code == 200:
                        task = response.json()
                        # Don't optimize single task get - return full details
                        return json.dumps({"success": True, "task": task})
                    elif response.status_code == 404:
                        return MCPErrorFormatter.format_error(
                            error_type="not_found",
                            message=f"Task {task_id} not found",
                            suggestion="Verify the task ID is correct",
                            http_status=404,
                        )
                    else:
                        return MCPErrorFormatter.from_http_error(response, "get task")
            
            # List mode with search and filters
            params: dict[str, Any] = {
                "page": page,
                "per_page": per_page,
                "exclude_large_fields": True,  # Always exclude large fields in MCP responses
            }
            
            # Add search query if provided
            if query:
                params["q"] = query
            
            if filter_by == "project" and filter_value:
                # Use project-specific endpoint for project filtering
                url = urljoin(api_url, f"/api/projects/{filter_value}/tasks")
                params["include_archived"] = False  # For backward compatibility
            elif filter_by == "status" and filter_value:
                # Use generic tasks endpoint for status filtering
                url = urljoin(api_url, "/api/tasks")
                params["status"] = filter_value
                params["include_closed"] = include_closed
                if project_id:
                    params["project_id"] = project_id
            elif project_id:
                # Direct project_id parameter provided
                url = urljoin(api_url, "/api/tasks")
                params["project_id"] = project_id
                params["include_closed"] = include_closed
            else:
                # No specific filters - get all tasks
                url = urljoin(api_url, "/api/tasks")
                params["include_closed"] = include_closed
            
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                
                result = response.json()
                
                # Normalize response format
                if isinstance(result, list):
                    tasks = result
                    total_count = len(result)
                elif isinstance(result, dict):
                    if "tasks" in result:
                        tasks = result["tasks"]
                        total_count = result.get("total_count", len(tasks))
                    elif "data" in result:
                        tasks = result["data"]
                        total_count = result.get("total", len(tasks))
                    else:
                        return MCPErrorFormatter.format_error(
                            error_type="invalid_response",
                            message="Unexpected response format from API",
                            details={"response_keys": list(result.keys())},
                        )
                else:
                    return MCPErrorFormatter.format_error(
                        error_type="invalid_response",
                        message="Invalid response type from API",
                        details={"response_type": type(result).__name__},
                    )
                
                # Optimize task responses
                optimized_tasks = [optimize_task_response(task) for task in tasks]
                
                return json.dumps({
                    "success": True,
                    "tasks": optimized_tasks,
                    "total_count": total_count,
                    "count": len(optimized_tasks),
                    "query": query,  # Include search query in response
                })
                
        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(
                e, "list tasks", {"filter_by": filter_by, "filter_value": filter_value}
            )
        except Exception as e:
            logger.error(f"Error listing tasks: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "list tasks")

    @mcp.tool()
    async def manage_task(
        ctx: Context,
        action: str,  # "create" | "update" | "delete"
        task_id: str | None = None,
        project_id: str | None = None,
        parent_task_id: str | None = None,  # For subtasks
        story_id: str | None = None,  # For BMAD hierarchy
        title: str | None = None,
        description: str | None = None,
        status: str | None = None,
        assignee: str | None = None,
        task_order: int | None = None,
        feature: str | None = None
    ) -> str:
        """
        Manage tasks (consolidated: create/update/delete).

        Args:
            action: "create" | "update" | "delete"
            task_id: Task UUID for update/delete
            project_id: Project UUID for create
            parent_task_id: Parent task UUID for creating subtasks
            story_id: Story UUID for BMAD hierarchy
            title: Task title text
            description: Detailed task description
            status: "todo" | "doing" | "review" | "waiting" | "done"
            assignee: "User" | "Archon" | "AI IDE Agent"
            task_order: Priority 0-100 (higher = more priority)
            feature: Feature label for grouping

        Examples:
          manage_task("create", project_id="p-1", title="Fix auth bug")
          manage_task("create", project_id="p-1", parent_task_id="t-1", title="Subtask")
          manage_task("update", task_id="t-1", status="doing")
          manage_task("delete", task_id="t-1")

        Returns: {success: bool, task?: object, message: string}
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()
            
            async with httpx.AsyncClient(timeout=timeout) as client:
                if action == "create":
                    if not project_id or not title:
                        return MCPErrorFormatter.format_error(
                            "validation_error",
                            "project_id and title required for create",
                            suggestion="Provide both project_id and title"
                        )
                    
                    task_payload = {
                        "project_id": project_id,
                        "title": title,
                        "description": description or "",
                        "assignee": assignee or "User",
                        "task_order": task_order or 0,
                        "sources": [],
                        "code_examples": [],
                    }

                    # Add optional fields if provided
                    if parent_task_id:
                        task_payload["parent_task_id"] = parent_task_id
                    if story_id:
                        task_payload["story_id"] = story_id
                    if feature:
                        task_payload["feature"] = feature
                    if status:
                        task_payload["status"] = status

                    response = await client.post(
                        urljoin(api_url, "/api/tasks"),
                        json=task_payload,
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        task = result.get("task")
                        
                        # Optimize task response
                        if task:
                            task = optimize_task_response(task)
                        
                        return json.dumps({
                            "success": True,
                            "task": task,
                            "task_id": task.get("id") if task else None,
                            "message": result.get("message", "Task created successfully"),
                        })
                    else:
                        return MCPErrorFormatter.from_http_error(response, "create task")
                        
                elif action == "update":
                    if not task_id:
                        return MCPErrorFormatter.format_error(
                            "validation_error",
                            "task_id required for update",
                            suggestion="Provide task_id to update"
                        )
                    
                    # Build update fields
                    update_fields = {}
                    if title is not None:
                        update_fields["title"] = title
                    if description is not None:
                        update_fields["description"] = description
                    if status is not None:
                        update_fields["status"] = status
                    if assignee is not None:
                        update_fields["assignee"] = assignee
                    if task_order is not None:
                        update_fields["task_order"] = task_order
                    if feature is not None:
                        update_fields["feature"] = feature
                    if parent_task_id is not None:
                        update_fields["parent_task_id"] = parent_task_id
                    if story_id is not None:
                        update_fields["story_id"] = story_id
                    
                    if not update_fields:
                        return MCPErrorFormatter.format_error(
                            error_type="validation_error",
                            message="No fields to update",
                            suggestion="Provide at least one field to update",
                        )
                    
                    response = await client.put(
                        urljoin(api_url, f"/api/tasks/{task_id}"),
                        json=update_fields
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        task = result.get("task")
                        
                        # Optimize task response
                        if task:
                            task = optimize_task_response(task)
                        
                        return json.dumps({
                            "success": True,
                            "task": task,
                            "message": result.get("message", "Task updated successfully"),
                        })
                    else:
                        return MCPErrorFormatter.from_http_error(response, "update task")
                        
                elif action == "delete":
                    if not task_id:
                        return MCPErrorFormatter.format_error(
                            "validation_error",
                            "task_id required for delete",
                            suggestion="Provide task_id to delete"
                        )
                    
                    response = await client.delete(
                        urljoin(api_url, f"/api/tasks/{task_id}")
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        return json.dumps({
                            "success": True,
                            "message": result.get("message", "Task deleted successfully"),
                        })
                    else:
                        return MCPErrorFormatter.from_http_error(response, "delete task")
                        
                else:
                    return MCPErrorFormatter.format_error(
                        "invalid_action",
                        f"Unknown action: {action}",
                        suggestion="Use 'create', 'update', or 'delete'"
                    )
                    
        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(
                e, f"{action} task", {"task_id": task_id, "project_id": project_id}
            )
        except Exception as e:
            logger.error(f"Error managing task ({action}): {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, f"{action} task")

    @mcp.tool()
    async def find_subtasks(
        ctx: Context,
        parent_task_id: str,
        recursive: bool = False,
        include_archived: bool = False
    ) -> str:
        """
        Find subtasks by parent task ID.

        Args:
            parent_task_id: Parent task UUID to find subtasks for
            recursive: If True, get all subtasks recursively (default: False for direct children only)
            include_archived: Include archived subtasks in results

        Returns:
            JSON with subtasks array and hierarchy information
        """
        try:
            from src.server.services.projects.task_service import TaskService

            task_service = TaskService()

            if recursive:
                # Get recursive subtasks using database function
                success, result = task_service.get_task_subtasks_recursive(parent_task_id)
            else:
                # Get direct subtasks only
                success, result = task_service.get_subtasks_by_parent(parent_task_id, include_archived)

            if success:
                # Optimize subtasks responses
                if "subtasks" in result:
                    result["subtasks"] = [optimize_task_response(subtask) for subtask in result["subtasks"]]

                return json.dumps({
                    "success": True,
                    **result
                })
            else:
                return MCPErrorFormatter.format_error(
                    error_type="operation_failed",
                    message=result.get("error", "Failed to get subtasks"),
                    suggestion="Verify the parent task ID exists"
                )

        except Exception as e:
            logger.error(f"Error finding subtasks: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "find subtasks")

    @mcp.tool()
    async def get_task_hierarchy(
        ctx: Context,
        task_id: str
    ) -> str:
        """
        Get the complete hierarchy path for a task (from root to current).

        Args:
            task_id: Task UUID to get hierarchy for

        Returns:
            JSON with hierarchy path showing parent relationships
        """
        try:
            from src.server.services.projects.task_service import TaskService

            task_service = TaskService()
            success, result = task_service.get_task_hierarchy_path(task_id)

            if success:
                return json.dumps({
                    "success": True,
                    **result
                })
            else:
                return MCPErrorFormatter.format_error(
                    error_type="operation_failed",
                    message=result.get("error", "Failed to get task hierarchy"),
                    suggestion="Verify the task ID exists"
                )

        except Exception as e:
            logger.error(f"Error getting task hierarchy: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "get task hierarchy")

    @mcp.tool()
    async def manage_subtask(
        ctx: Context,
        action: str,  # "create" | "update" | "delete"
        parent_task_id: str | None = None,  # Required for create
        subtask_id: str | None = None,  # Required for update/delete
        title: str | None = None,
        description: str | None = None,
        status: str | None = None,
        assignee: str | None = None,
        task_order: int | None = None,
        feature: str | None = None
    ) -> str:
        """
        Manage subtasks specifically (create/update/delete).

        Args:
            action: "create" | "update" | "delete"
            parent_task_id: Parent task UUID (required for create)
            subtask_id: Subtask UUID (required for update/delete)
            title: Subtask title
            description: Subtask description
            status: "todo" | "doing" | "review" | "waiting" | "done"
            assignee: "User" | "Archon" | "AI IDE Agent"
            task_order: Priority order within subtasks
            feature: Feature label (inherited from parent if not provided)

        Examples:
          manage_subtask("create", parent_task_id="t-1", title="Fix bug details")
          manage_subtask("update", subtask_id="st-1", status="doing")
          manage_subtask("delete", subtask_id="st-1")

        Returns: {success: bool, subtask?: object, message: string}
        """
        try:
            from src.server.services.projects.task_service import TaskService

            task_service = TaskService()

            if action == "create":
                if not parent_task_id or not title:
                    return MCPErrorFormatter.format_error(
                        "validation_error",
                        "parent_task_id and title required for create",
                        suggestion="Provide both parent_task_id and title"
                    )

                success, result = await task_service.create_subtask(
                    parent_task_id=parent_task_id,
                    title=title,
                    description=description or "",
                    assignee=assignee or "User",
                    task_order=task_order or 0,
                    feature=feature,
                )

                if success:
                    subtask = result.get("subtask")
                    if subtask:
                        subtask = optimize_task_response(subtask)

                    return json.dumps({
                        "success": True,
                        "subtask": subtask,
                        "message": "Subtask created successfully"
                    })
                else:
                    return MCPErrorFormatter.format_error(
                        error_type="operation_failed",
                        message=result.get("error", "Failed to create subtask"),
                        suggestion="Check parent task exists and is not archived"
                    )

            elif action in ["update", "delete"]:
                if not subtask_id:
                    return MCPErrorFormatter.format_error(
                        "validation_error",
                        "subtask_id required for update/delete",
                        suggestion="Provide the subtask_id to modify"
                    )

                if action == "update":
                    update_fields = {}
                    if title is not None:
                        update_fields["title"] = title
                    if description is not None:
                        update_fields["description"] = description
                    if status is not None:
                        update_fields["status"] = status
                    if assignee is not None:
                        update_fields["assignee"] = assignee
                    if task_order is not None:
                        update_fields["task_order"] = task_order
                    if feature is not None:
                        update_fields["feature"] = feature

                    if not update_fields:
                        return MCPErrorFormatter.format_error(
                            error_type="validation_error",
                            message="No fields to update",
                            suggestion="Provide at least one field to update",
                        )

                    success, result = await task_service.update_task(subtask_id, update_fields)

                    if success:
                        subtask = result.get("task")
                        if subtask:
                            subtask = optimize_task_response(subtask)

                        return json.dumps({
                            "success": True,
                            "subtask": subtask,
                            "message": result.get("message", "Subtask updated successfully")
                        })
                    else:
                        return MCPErrorFormatter.format_error(
                            error_type="operation_failed",
                            message=result.get("error", "Failed to update subtask"),
                            suggestion="Verify the subtask ID exists"
                        )

                elif action == "delete":
                    # For subtasks, use the enhanced archive method
                    success, result = await task_service.archive_task_with_subtasks(subtask_id)

                    if success:
                        return json.dumps({
                            "success": True,
                            "message": result.get("message", "Subtask archived successfully"),
                            "total_archived": result.get("total_archived", 1)
                        })
                    else:
                        return MCPErrorFormatter.format_error(
                            error_type="operation_failed",
                            message=result.get("error", "Failed to archive subtask"),
                            suggestion="Verify the subtask ID exists"
                        )

            else:
                return MCPErrorFormatter.format_error(
                    "validation_error",
                    f"Invalid action: {action}",
                    suggestion="Use 'create', 'update', or 'delete'"
                )

        except Exception as e:
            logger.error(f"Error managing subtask ({action}): {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, f"{action} subtask")

    # ============================================================================
    # NEW HIERARCHICAL MCP TOOLS - Epic 3.1 Implementation
    # ============================================================================

    @mcp.tool()
    async def find_epics(
        ctx: Context,
        query: str | None = None,  # Search capability
        epic_id: str | None = None,  # For getting single epic
        filter_by: str | None = None,
        filter_value: str | None = None,
        project_id: str | None = None,
        include_closed: bool = True,
        page: int = 1,
        per_page: int = DEFAULT_PAGE_SIZE,
    ) -> str:
        """
        Find and search epics (consolidated: list + search + get).

        Args:
            query: Keyword search in title, description (optional)
            epic_id: Get specific epic by ID (returns full details)
            filter_by: "status" | "project" | "priority" (optional)
            filter_value: Filter value (e.g., "todo", "doing", "review", "done")
            project_id: Project UUID (optional, for additional filtering)
            include_closed: Include done epics in results
            page: Page number for pagination
            per_page: Items per page (default: 10)

        Returns:
            JSON array of epics or single epic (optimized payloads for lists)

        Examples:
            find_epics() # All epics
            find_epics(query="database") # Search for "database"
            find_epics(epic_id="epic-123") # Get specific epic (full details)
            find_epics(filter_by="status", filter_value="todo") # Only todo epics
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()

            # Single epic get mode
            if epic_id:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.get(urljoin(api_url, f"/api/epics/{epic_id}"))

                    if response.status_code == 200:
                        epic = response.json()
                        # Don't optimize single epic get - return full details
                        return json.dumps({"success": True, "epic": epic})
                    elif response.status_code == 404:
                        return MCPErrorFormatter.format_error(
                            error_type="not_found",
                            message=f"Epic {epic_id} not found",
                            suggestion="Verify the epic ID is correct",
                            http_status=404,
                        )
                    else:
                        return MCPErrorFormatter.from_http_error(response, "get epic")

            # List mode with search and filters
            params: dict[str, Any] = {
                "page": page,
                "per_page": per_page,
                "exclude_large_fields": True,  # Always exclude large fields in MCP responses
            }

            # Add search query if provided
            if query:
                params["q"] = query

            if filter_by == "project" and filter_value:
                # Use project-specific endpoint for project filtering
                url = urljoin(api_url, f"/api/projects/{filter_value}/epics")
            elif filter_by == "status" and filter_value:
                # Use generic epics endpoint for status filtering
                url = urljoin(api_url, "/api/epics")
                params["status"] = filter_value
                params["include_closed"] = include_closed
                if project_id:
                    params["project_id"] = project_id
            elif project_id:
                # Direct project_id parameter provided
                url = urljoin(api_url, "/api/epics")
                params["project_id"] = project_id
                params["include_closed"] = include_closed
            else:
                # No specific filters - get all epics
                url = urljoin(api_url, "/api/epics")
                params["include_closed"] = include_closed

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()

                result = response.json()

                # Normalize response format
                if isinstance(result, list):
                    epics = result
                    total_count = len(result)
                elif isinstance(result, dict):
                    if "epics" in result:
                        epics = result["epics"]
                        total_count = result.get("total_count", len(epics))
                    elif "data" in result:
                        epics = result["data"]
                        total_count = result.get("total", len(epics))
                    else:
                        return MCPErrorFormatter.format_error(
                            error_type="invalid_response",
                            message="Unexpected response format from API",
                            details={"response_keys": list(result.keys())},
                        )
                else:
                    return MCPErrorFormatter.format_error(
                        error_type="invalid_response",
                        message="Invalid response type from API",
                        details={"response_type": type(result).__name__},
                    )

                # Optimize epic responses
                optimized_epics = [optimize_task_response(epic) for epic in epics]

                return json.dumps({
                    "success": True,
                    "epics": optimized_epics,
                    "total_count": total_count,
                    "count": len(optimized_epics),
                    "query": query,  # Include search query in response
                })

        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(
                e, "list epics", {"filter_by": filter_by, "filter_value": filter_value}
            )
        except Exception as e:
            logger.error(f"Error listing epics: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "list epics")

    @mcp.tool()
    async def manage_epic(
        ctx: Context,
        action: str,  # "create" | "update" | "delete"
        epic_id: str | None = None,
        project_id: str | None = None,
        title: str | None = None,
        description: str | None = None,
        status: str | None = None,
        priority: str | None = None,
        business_value: dict | None = None
    ) -> str:
        """
        Manage epics (consolidated: create/update/delete).

        Args:
            action: "create" | "update" | "delete"
            epic_id: Epic UUID for update/delete
            project_id: Project UUID for create
            title: Epic title text
            description: Detailed epic description
            status: "todo" | "doing" | "review" | "waiting" | "done"
            priority: "low" | "medium" | "high" | "critical"
            business_value: Business value information (optional)

        Examples:
          manage_epic("create", project_id="p-1", title="Database Migration")
          manage_epic("update", epic_id="e-1", status="doing")
          manage_epic("delete", epic_id="e-1")

        Returns: {success: bool, epic?: object, message: string}
        """
        try:
            from src.server.services.projects.epic_service import EpicService

            epic_service = EpicService()

            if action == "create":
                if not project_id or not title:
                    return MCPErrorFormatter.format_error(
                        "validation_error",
                        "project_id and title required for create",
                        suggestion="Provide both project_id and title"
                    )

                success, result = await epic_service.create_epic(
                    project_id=project_id,
                    title=title,
                    description=description or "",
                    status=status or "todo",
                    priority=priority or "medium",
                    business_value=business_value
                )

                if success:
                    epic = result.get("epic")
                    if epic:
                        epic = optimize_task_response(epic)

                    return json.dumps({
                        "success": True,
                        "epic": epic,
                        "epic_id": epic.get("id") if epic else None,
                        "message": "Epic created successfully",
                    })
                else:
                    return MCPErrorFormatter.format_error(
                        error_type="operation_failed",
                        message=result.get("error", "Failed to create epic"),
                        suggestion="Check project exists and parameters are valid"
                    )

            elif action == "update":
                if not epic_id:
                    return MCPErrorFormatter.format_error(
                        "validation_error",
                        "epic_id required for update",
                        suggestion="Provide epic_id to update"
                    )

                success, result = await epic_service.update_epic(
                    epic_id=epic_id,
                    title=title,
                    description=description,
                    status=status,
                    priority=priority,
                    business_value=business_value
                )

                if success:
                    epic = result.get("epic")
                    if epic:
                        epic = optimize_task_response(epic)

                    return json.dumps({
                        "success": True,
                        "epic": epic,
                        "message": "Epic updated successfully",
                    })
                else:
                    return MCPErrorFormatter.format_error(
                        error_type="operation_failed",
                        message=result.get("error", "Failed to update epic"),
                        suggestion="Verify the epic ID exists and parameters are valid"
                    )

            elif action == "delete":
                if not epic_id:
                    return MCPErrorFormatter.format_error(
                        "validation_error",
                        "epic_id required for delete",
                        suggestion="Provide epic_id to delete"
                    )

                success, result = await epic_service.delete_epic(epic_id)

                if success:
                    return json.dumps({
                        "success": True,
                        "message": result.get("message", "Epic deleted successfully"),
                    })
                else:
                    return MCPErrorFormatter.format_error(
                        error_type="operation_failed",
                        message=result.get("error", "Failed to delete epic"),
                        suggestion="Verify the epic ID exists and has no dependent stories"
                    )

            else:
                return MCPErrorFormatter.format_error(
                    "invalid_action",
                    f"Unknown action: {action}",
                    suggestion="Use 'create', 'update', or 'delete'"
                )

        except Exception as e:
            logger.error(f"Error managing epic ({action}): {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, f"{action} epic")

    @mcp.tool()
    async def find_stories(
        ctx: Context,
        query: str | None = None,  # Search capability
        story_id: str | None = None,  # For getting single story
        filter_by: str | None = None,
        filter_value: str | None = None,
        epic_id: str | None = None,
        project_id: str | None = None,
        include_closed: bool = True,
        page: int = 1,
        per_page: int = DEFAULT_PAGE_SIZE,
    ) -> str:
        """
        Find and search stories (consolidated: list + search + get).

        Args:
            query: Keyword search in title, description (optional)
            story_id: Get specific story by ID (returns full details)
            filter_by: "status" | "epic" | "priority" (optional)
            filter_value: Filter value (e.g., "todo", "doing", "review", "done")
            epic_id: Epic UUID (optional, for additional filtering)
            project_id: Project UUID (optional, for additional filtering)
            include_closed: Include done stories in results
            page: Page number for pagination
            per_page: Items per page (default: 10)

        Returns:
            JSON array of stories or single story (optimized payloads for lists)

        Examples:
            find_stories() # All stories
            find_stories(query="user login") # Search for "user login"
            find_stories(story_id="story-123") # Get specific story (full details)
            find_stories(filter_by="epic", filter_value="epic-456") # Stories in epic
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()

            # Single story get mode
            if story_id:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.get(urljoin(api_url, f"/api/stories/{story_id}"))

                    if response.status_code == 200:
                        story = response.json()
                        # Don't optimize single story get - return full details
                        return json.dumps({"success": True, "story": story})
                    elif response.status_code == 404:
                        return MCPErrorFormatter.format_error(
                            error_type="not_found",
                            message=f"Story {story_id} not found",
                            suggestion="Verify the story ID is correct",
                            http_status=404,
                        )
                    else:
                        return MCPErrorFormatter.from_http_error(response, "get story")

            # List mode with search and filters
            params: dict[str, Any] = {
                "page": page,
                "per_page": per_page,
                "exclude_large_fields": True,  # Always exclude large fields in MCP responses
            }

            # Add search query if provided
            if query:
                params["q"] = query

            if filter_by == "epic" and filter_value:
                # Use epic-specific endpoint for epic filtering
                url = urljoin(api_url, f"/api/epics/{filter_value}/stories")
            elif filter_by == "status" and filter_value:
                # Use generic stories endpoint for status filtering
                url = urljoin(api_url, "/api/stories")
                params["status"] = filter_value
                params["include_closed"] = include_closed
                if epic_id:
                    params["epic_id"] = epic_id
                if project_id:
                    params["project_id"] = project_id
            elif epic_id:
                # Direct epic_id parameter provided
                url = urljoin(api_url, "/api/stories")
                params["epic_id"] = epic_id
                params["include_closed"] = include_closed
            elif project_id:
                # Direct project_id parameter provided
                url = urljoin(api_url, "/api/stories")
                params["project_id"] = project_id
                params["include_closed"] = include_closed
            else:
                # No specific filters - get all stories
                url = urljoin(api_url, "/api/stories")
                params["include_closed"] = include_closed

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()

                result = response.json()

                # Normalize response format
                if isinstance(result, list):
                    stories = result
                    total_count = len(result)
                elif isinstance(result, dict):
                    if "stories" in result:
                        stories = result["stories"]
                        total_count = result.get("total_count", len(stories))
                    elif "data" in result:
                        stories = result["data"]
                        total_count = result.get("total", len(stories))
                    else:
                        return MCPErrorFormatter.format_error(
                            error_type="invalid_response",
                            message="Unexpected response format from API",
                            details={"response_keys": list(result.keys())},
                        )
                else:
                    return MCPErrorFormatter.format_error(
                        error_type="invalid_response",
                        message="Invalid response type from API",
                        details={"response_type": type(result).__name__},
                    )

                # Optimize story responses
                optimized_stories = [optimize_task_response(story) for story in stories]

                return json.dumps({
                    "success": True,
                    "stories": optimized_stories,
                    "total_count": total_count,
                    "count": len(optimized_stories),
                    "query": query,  # Include search query in response
                })

        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(
                e, "list stories", {"filter_by": filter_by, "filter_value": filter_value}
            )
        except Exception as e:
            logger.error(f"Error listing stories: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "list stories")

    @mcp.tool()
    async def manage_story(
        ctx: Context,
        action: str,  # "create" | "update" | "delete"
        story_id: str | None = None,
        epic_id: str | None = None,
        title: str | None = None,
        description: str | None = None,
        status: str | None = None,
        priority: str | None = None,
        acceptance_criteria: list[str] | None = None,
        business_value: dict | None = None
    ) -> str:
        """
        Manage stories (consolidated: create/update/delete).

        Args:
            action: "create" | "update" | "delete"
            story_id: Story UUID for update/delete
            epic_id: Epic UUID for create
            title: Story title text
            description: Detailed story description
            status: "todo" | "doing" | "review" | "waiting" | "done"
            priority: "low" | "medium" | "high" | "critical"
            acceptance_criteria: List of acceptance criteria
            business_value: Business value information (optional)

        Examples:
          manage_story("create", epic_id="e-1", title="User Login Feature")
          manage_story("update", story_id="s-1", status="doing")
          manage_story("delete", story_id="s-1")

        Returns: {success: bool, story?: object, message: string}
        """
        try:
            from src.server.services.projects.story_service import StoryService

            story_service = StoryService()

            if action == "create":
                if not epic_id or not title:
                    return MCPErrorFormatter.format_error(
                        "validation_error",
                        "epic_id and title required for create",
                        suggestion="Provide both epic_id and title"
                    )

                success, result = await story_service.create_story(
                    epic_id=epic_id,
                    title=title,
                    description=description or "",
                    status=status or "todo",
                    priority=priority or "medium",
                    acceptance_criteria=acceptance_criteria or [],
                    business_value=business_value
                )

                if success:
                    story = result.get("story")
                    if story:
                        story = optimize_task_response(story)

                    return json.dumps({
                        "success": True,
                        "story": story,
                        "story_id": story.get("id") if story else None,
                        "message": "Story created successfully",
                    })
                else:
                    return MCPErrorFormatter.format_error(
                        error_type="operation_failed",
                        message=result.get("error", "Failed to create story"),
                        suggestion="Check epic exists and parameters are valid"
                    )

            elif action == "update":
                if not story_id:
                    return MCPErrorFormatter.format_error(
                        "validation_error",
                        "story_id required for update",
                        suggestion="Provide story_id to update"
                    )

                success, result = await story_service.update_story(
                    story_id=story_id,
                    title=title,
                    description=description,
                    status=status,
                    priority=priority,
                    acceptance_criteria=acceptance_criteria,
                    business_value=business_value
                )

                if success:
                    story = result.get("story")
                    if story:
                        story = optimize_task_response(story)

                    return json.dumps({
                        "success": True,
                        "story": story,
                        "message": "Story updated successfully",
                    })
                else:
                    return MCPErrorFormatter.format_error(
                        error_type="operation_failed",
                        message=result.get("error", "Failed to update story"),
                        suggestion="Verify the story ID exists and parameters are valid"
                    )

            elif action == "delete":
                if not story_id:
                    return MCPErrorFormatter.format_error(
                        "validation_error",
                        "story_id required for delete",
                        suggestion="Provide story_id to delete"
                    )

                success, result = await story_service.delete_story(story_id)

                if success:
                    return json.dumps({
                        "success": True,
                        "message": result.get("message", "Story deleted successfully"),
                    })
                else:
                    return MCPErrorFormatter.format_error(
                        error_type="operation_failed",
                        message=result.get("error", "Failed to delete story"),
                        suggestion="Verify the story ID exists and has no dependent tasks"
                    )

            else:
                return MCPErrorFormatter.format_error(
                    "invalid_action",
                    f"Unknown action: {action}",
                    suggestion="Use 'create', 'update', or 'delete'"
                )

        except Exception as e:
            logger.error(f"Error managing story ({action}): {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, f"{action} story")

    # Note: find_subtasks and manage_subtask tools are already implemented above
    # They follow the existing pattern and work with the parent_task_id relationship
    # The existing tools are:
    # - find_subtasks() - lines 377-425
    # - manage_subtask() - lines 464-611
    #
    # These tools already provide the consolidated pattern for subtasks following
    # the same structure as the new hierarchical tools above.

    # ============================================================================
    # ADVANCED HIERARCHICAL MCP TOOLS - Epic 3.2 Implementation
    # ============================================================================

    @mcp.tool()
    async def get_hierarchy(
        ctx: Context,
        entry_point_type: str,  # "project" | "epic" | "story" | "task"
        entry_point_id: str,
        depth: int = -1,  # -1 = unlimited, 0 = current level only
        traversal: str = "depth_first",  # "depth_first" | "breadth_first"
        include_fields: list[str] | None = None,
        filter_status: list[str] | None = None,
        filter_assignee: list[str] | None = None,
        include_dependencies: bool = False,
        max_results: int = 1000,
    ) -> str:
        """
        Get hierarchical project structure with intelligent filtering.

        Args:
            entry_point_type: Starting level ("project", "epic", "story", "task")
            entry_point_id: ID of the entry point item
            depth: Maximum depth to traverse (-1 = unlimited, 0 = current level only)
            traversal: Traversal method ("depth_first" or "breadth_first")
            include_fields: Specific fields to include (optimizes response)
            filter_status: Only include items with these statuses
            filter_assignee: Only include items with these assignees
            include_dependencies: Include dependency information
            max_results: Maximum number of items to return (prevents large responses)

        Returns:
            JSON with hierarchical structure and metadata

        Examples:
            get_hierarchy("project", "proj-123", depth=2)
            get_hierarchy("epic", "epic-456", include_dependencies=True)
            get_hierarchy("story", "story-789", filter_status=["todo", "doing"])
        """
        try:
            from src.server.services.projects.project_service import ProjectService
            from src.server.services.projects.epic_service import EpicService
            from src.server.services.projects.story_service import StoryService
            from src.server.services.projects.task_service import TaskService

            # Validate entry point type
            if entry_point_type not in ["project", "epic", "story", "task"]:
                return MCPErrorFormatter.format_error(
                    "validation_error",
                    f"Invalid entry_point_type: {entry_point_type}",
                    suggestion="Use 'project', 'epic', 'story', or 'task'"
                )

            # Validate traversal method
            if traversal not in ["depth_first", "breadth_first"]:
                return MCPErrorFormatter.format_error(
                    "validation_error",
                    f"Invalid traversal method: {traversal}",
                    suggestion="Use 'depth_first' or 'breadth_first'"
                )

            # Initialize services
            project_service = ProjectService()
            epic_service = EpicService()
            story_service = StoryService()
            task_service = TaskService()

            # Build hierarchy starting from entry point
            hierarchy = {
                "entry_point": {"type": entry_point_type, "id": entry_point_id},
                "structure": [],
                "truncated": False
            }

            items_collected = 0

            # Get the entry point item
            if entry_point_type == "project":
                success, result = project_service.get_project(entry_point_id)
                if not success:
                    return MCPErrorFormatter.format_error(
                        "not_found",
                        f"Project {entry_point_id} not found",
                        suggestion="Verify the project ID is correct"
                    )
                entry_item = result["project"]

                # Get epics for this project if depth allows
                if depth != 0 and items_collected < max_results:
                    epics_success, epics_result = await epic_service.list_epics(
                        project_id=entry_point_id,
                        include_archived=True,
                        limit=max_results - items_collected
                    )
                    if epics_success:
                        for epic in epics_result.get("epics", []):
                            if items_collected >= max_results:
                                hierarchy["truncated"] = True
                                break

                            # Apply filters
                            if filter_status and epic.get("status") not in filter_status:
                                continue

                            epic_item = {
                                "level": "epic",
                                "id": epic["id"],
                                "title": epic.get("title", ""),
                                "status": epic.get("status", "todo"),
                                "priority": epic.get("priority", 0),
                                "progress_percentage": epic.get("progress_percentage", 0),
                                "children": []
                            }

                            # Get stories for this epic if depth allows
                            if depth == -1 or depth > 1:
                                stories_success, stories_result = await story_service.list_stories(
                                    epic_id=epic["id"],
                                    include_archived=True,
                                    limit=max_results - items_collected
                                )
                                if stories_success:
                                    for story in stories_result.get("stories", []):
                                        if items_collected >= max_results:
                                            hierarchy["truncated"] = True
                                            break

                                        # Apply filters
                                        if filter_status and story.get("status") not in filter_status:
                                            continue

                                        story_item = {
                                            "level": "story",
                                            "id": story["id"],
                                            "title": story.get("title", ""),
                                            "status": story.get("status", "todo"),
                                            "priority": story.get("priority", 0),
                                            "progress_percentage": story.get("progress_percentage", 0),
                                            "children": []
                                        }

                                        # Get tasks for this story if depth allows
                                        if depth == -1 or depth > 2:
                                            tasks_success, tasks_result = await task_service.get_tasks_by_story(
                                                story_id=story["id"],
                                                exclude_large_fields=True
                                            )
                                            if tasks_success:
                                                for task in tasks_result.get("tasks", []):
                                                    if items_collected >= max_results:
                                                        hierarchy["truncated"] = True
                                                        break

                                                    # Apply filters
                                                    if filter_status and task.get("status") not in filter_status:
                                                        continue
                                                    if filter_assignee and task.get("assignee") not in filter_assignee:
                                                        continue

                                                    task_item = {
                                                        "level": "task",
                                                        "id": task["id"],
                                                        "title": task.get("title", ""),
                                                        "status": task.get("status", "todo"),
                                                        "assignee": task.get("assignee", "User"),
                                                        "task_order": task.get("task_order", 0),
                                                        "children": []
                                                    }

                                                    story_item["children"].append(task_item)
                                                    items_collected += 1

                                        epic_item["children"].append(story_item)
                                        items_collected += 1

                            hierarchy["structure"].append(epic_item)
                            items_collected += 1

            elif entry_point_type == "epic":
                success, result = await epic_service.get_epic(entry_point_id)
                if not success:
                    return MCPErrorFormatter.format_error(
                        "not_found",
                        f"Epic {entry_point_id} not found",
                        suggestion="Verify the epic ID is correct"
                    )
                entry_item = result["epic"]

                # Build hierarchy starting from this epic
                epic_item = {
                    "level": "epic",
                    "id": entry_item["id"],
                    "title": entry_item.get("title", ""),
                    "status": entry_item.get("status", "todo"),
                    "priority": entry_item.get("priority", 0),
                    "progress_percentage": entry_item.get("progress_percentage", 0),
                    "children": []
                }

                # Get stories for this epic if depth allows
                if depth != 0 and items_collected < max_results:
                    stories_success, stories_result = await story_service.list_stories(
                        epic_id=entry_point_id,
                        include_archived=True,
                        limit=max_results - items_collected
                    )
                    if stories_success:
                        for story in stories_result.get("stories", []):
                            if items_collected >= max_results:
                                hierarchy["truncated"] = True
                                break

                            # Apply filters
                            if filter_status and story.get("status") not in filter_status:
                                continue

                            story_item = {
                                "level": "story",
                                "id": story["id"],
                                "title": story.get("title", ""),
                                "status": story.get("status", "todo"),
                                "priority": story.get("priority", 0),
                                "progress_percentage": story.get("progress_percentage", 0),
                                "children": []
                            }

                            epic_item["children"].append(story_item)
                            items_collected += 1

                hierarchy["structure"].append(epic_item)

            elif entry_point_type == "story":
                success, result = await story_service.get_story(entry_point_id)
                if not success:
                    return MCPErrorFormatter.format_error(
                        "not_found",
                        f"Story {entry_point_id} not found",
                        suggestion="Verify the story ID is correct"
                    )
                entry_item = result["story"]

                # Build hierarchy starting from this story
                story_item = {
                    "level": "story",
                    "id": entry_item["id"],
                    "title": entry_item.get("title", ""),
                    "status": entry_item.get("status", "todo"),
                    "priority": entry_item.get("priority", 0),
                    "progress_percentage": entry_item.get("progress_percentage", 0),
                    "children": []
                }

                # Get tasks for this story if depth allows
                if depth != 0 and items_collected < max_results:
                    tasks_success, tasks_result = await task_service.get_tasks_by_story(
                        story_id=entry_point_id,
                        exclude_large_fields=True
                    )
                    if tasks_success:
                        for task in tasks_result.get("tasks", []):
                            if items_collected >= max_results:
                                hierarchy["truncated"] = True
                                break

                            # Apply filters
                            if filter_status and task.get("status") not in filter_status:
                                continue
                            if filter_assignee and task.get("assignee") not in filter_assignee:
                                continue

                            task_item = {
                                "level": "task",
                                "id": task["id"],
                                "title": task.get("title", ""),
                                "status": task.get("status", "todo"),
                                "assignee": task.get("assignee", "User"),
                                "task_order": task.get("task_order", 0),
                                "children": []
                            }

                            story_item["children"].append(task_item)
                            items_collected += 1

                hierarchy["structure"].append(story_item)

            elif entry_point_type == "task":
                success, result = task_service.get_task(entry_point_id)
                if not success:
                    return MCPErrorFormatter.format_error(
                        "not_found",
                        f"Task {entry_point_id} not found",
                        suggestion="Verify the task ID is correct"
                    )
                entry_item = result["task"]

                # Build hierarchy starting from this task
                task_item = {
                    "level": "task",
                    "id": entry_item["id"],
                    "title": entry_item.get("title", ""),
                    "status": entry_item.get("status", "todo"),
                    "assignee": entry_item.get("assignee", "User"),
                    "task_order": entry_item.get("task_order", 0),
                    "children": []
                }

                # Get subtasks for this task if depth allows
                if depth != 0 and items_collected < max_results:
                    subtasks_success, subtasks_result = task_service.get_subtasks_by_parent(
                        entry_point_id,
                        include_archived=True
                    )
                    if subtasks_success:
                        for subtask in subtasks_result.get("subtasks", []):
                            if items_collected >= max_results:
                                hierarchy["truncated"] = True
                                break

                            # Apply filters
                            if filter_status and subtask.get("status") not in filter_status:
                                continue
                            if filter_assignee and subtask.get("assignee") not in filter_assignee:
                                continue

                            subtask_item = {
                                "level": "subtask",
                                "id": subtask["id"],
                                "title": subtask.get("title", ""),
                                "status": subtask.get("status", "todo"),
                                "assignee": subtask.get("assignee", "User"),
                                "task_order": subtask.get("task_order", 0),
                                "children": []
                            }

                            task_item["children"].append(subtask_item)
                            items_collected += 1

                hierarchy["structure"].append(task_item)

            # Add metadata
            metadata = {
                "total_items": items_collected,
                "traversal_used": traversal,
                "max_depth": depth,
                "entry_point": {"type": entry_point_type, "id": entry_point_id},
                "filters_applied": {
                    "status": filter_status or [],
                    "assignee": filter_assignee or []
                }
            }

            return json.dumps({
                "success": True,
                "hierarchy": hierarchy,
                "metadata": metadata
            })

        except Exception as e:
            logger.error(f"Error getting hierarchy: {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, "get hierarchy")

    @mcp.tool()
    async def manage_dependencies(
        ctx: Context,
        action: str,  # "create" | "query" | "delete"
        from_type: str | None = None,  # "epic" | "story" | "task"
        from_id: str | None = None,
        to_type: str | None = None,  # "epic" | "story" | "task"
        to_id: str | None = None,
        dependency_type: str | None = None,  # "blocks" | "depends_on" | "related_to" | "precedes" | "follows"
        dependency_id: str | None = None,  # For delete action
        description: str | None = None,
        validate_cycles: bool = True,
    ) -> str:
        """
        Manage dependencies between hierarchy elements with cycle detection.

        Args:
            action: "create" | "query" | "delete"
            from_type: Source item type ("epic", "story", "task")
            from_id: Source item ID
            to_type: Target item type ("epic", "story", "task")
            to_id: Target item ID
            dependency_type: "blocks" | "depends_on" | "related_to" | "precedes" | "follows"
            dependency_id: Dependency ID for delete action
            description: Optional description of the dependency
            validate_cycles: Whether to check for circular dependencies (default: True)

        Returns:
            JSON with dependency operation result

        Examples:
            manage_dependencies("create", "story", "s-1", "story", "s-2", "blocks")
            manage_dependencies("query", "epic", "e-1")
            manage_dependencies("delete", dependency_id="dep-123")
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()

            async with httpx.AsyncClient(timeout=timeout) as client:
                if action == "create":
                    if not all([from_type, from_id, to_type, to_id, dependency_type]):
                        return MCPErrorFormatter.format_error(
                            "validation_error",
                            "from_type, from_id, to_type, to_id, and dependency_type required for create",
                            suggestion="Provide all required dependency parameters"
                        )

                    # Validate types
                    valid_types = ["epic", "story", "task"]
                    if from_type not in valid_types or to_type not in valid_types:
                        return MCPErrorFormatter.format_error(
                            "validation_error",
                            f"Invalid item type. Must be one of: {valid_types}",
                            suggestion="Use 'epic', 'story', or 'task'"
                        )

                    # Validate dependency type
                    valid_dep_types = ["blocks", "depends_on", "related_to", "precedes", "follows"]
                    if dependency_type not in valid_dep_types:
                        return MCPErrorFormatter.format_error(
                            "validation_error",
                            f"Invalid dependency type. Must be one of: {valid_dep_types}",
                            suggestion="Use 'blocks', 'depends_on', 'related_to', 'precedes', or 'follows'"
                        )

                    # Create dependency
                    dependency_payload = {
                        "from_type": from_type,
                        "from_id": from_id,
                        "to_type": to_type,
                        "to_id": to_id,
                        "dependency_type": dependency_type,
                        "description": description or "",
                        "validate_cycles": validate_cycles
                    }

                    response = await client.post(
                        urljoin(api_url, "/api/dependencies"),
                        json=dependency_payload
                    )

                    if response.status_code == 200:
                        result = response.json()
                        return json.dumps({
                            "success": True,
                            "dependency": result.get("dependency"),
                            "message": result.get("message", "Dependency created successfully")
                        })
                    else:
                        return MCPErrorFormatter.from_http_error(response, "create dependency")

                elif action == "query":
                    if not from_type or not from_id:
                        return MCPErrorFormatter.format_error(
                            "validation_error",
                            "from_type and from_id required for query",
                            suggestion="Provide the item to query dependencies for"
                        )

                    # Query dependencies
                    response = await client.get(
                        urljoin(api_url, f"/api/{from_type}/{from_id}/dependencies")
                    )

                    if response.status_code == 200:
                        result = response.json()
                        dependencies = result.get("dependencies", [])

                        return json.dumps({
                            "success": True,
                            "dependencies": dependencies,
                            "count": len(dependencies),
                            "item": {"type": from_type, "id": from_id}
                        })
                    else:
                        return MCPErrorFormatter.from_http_error(response, "query dependencies")

                elif action == "delete":
                    if not dependency_id:
                        return MCPErrorFormatter.format_error(
                            "validation_error",
                            "dependency_id required for delete",
                            suggestion="Provide the dependency ID to delete"
                        )

                    # Delete dependency
                    response = await client.delete(
                        urljoin(api_url, f"/api/dependencies/{dependency_id}")
                    )

                    if response.status_code == 200:
                        result = response.json()
                        return json.dumps({
                            "success": True,
                            "message": result.get("message", "Dependency deleted successfully")
                        })
                    else:
                        return MCPErrorFormatter.from_http_error(response, "delete dependency")

                else:
                    return MCPErrorFormatter.format_error(
                        "invalid_action",
                        f"Unknown action: {action}",
                        suggestion="Use 'create', 'query', or 'delete'"
                    )

        except httpx.RequestError as e:
            return MCPErrorFormatter.from_exception(
                e, f"{action} dependency", {"from_type": from_type, "from_id": from_id}
            )
        except Exception as e:
            logger.error(f"Error managing dependency ({action}): {e}", exc_info=True)
            return MCPErrorFormatter.from_exception(e, f"{action} dependency")
