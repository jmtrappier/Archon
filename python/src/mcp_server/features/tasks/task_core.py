"""
Core CRUD operations for tasks, epics, stories, and subtasks.
"""

import json
import httpx
from urllib.parse import urljoin
from mcp.server.fastmcp import Context

from .task_utils import (
    get_api_url,
    get_default_timeout,
    MCPErrorFormatter,
    make_api_request,
    DEFAULT_PAGE_SIZE
)


async def find_tasks(
    ctx: Context,
    query: str | None = None,
    task_id: str | None = None,
    filter_by: str | None = None,
    filter_value: str | None = None,
    project_id: str | None = None,
    include_closed: bool = True,
    page: int = 1,
    per_page: int = DEFAULT_PAGE_SIZE,
) -> str:
    """
    Find and search tasks (consolidated: list + search + get).
    """
    try:
        async with httpx.AsyncClient(timeout=get_default_timeout()) as client:
            # Build query parameters
            params = {
                "page": page,
                "per_page": per_page,
            }

            # Handle single task lookup
            if task_id:
                success, result = await make_api_request(
                    client, f"/api/tasks/{task_id}", data_key=None
                )
                if not success:
                    return MCPErrorFormatter.format_error(
                        "not_found",
                        f"Task {task_id} not found",
                        result
                    )
                return json.dumps({"success": True, "task": result})

            # Handle search and filtering
            if query:
                params["query"] = query

            if filter_by and filter_value:
                params[filter_by] = filter_value

            if project_id:
                params["project_id"] = project_id

            if not include_closed:
                url = urljoin(get_api_url(), "/api/tasks/active")
            else:
                url = urljoin(get_api_url(), "/api/tasks")
                params["include_closed"] = include_closed

            async with httpx.AsyncClient(timeout=get_default_timeout()) as client:
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

                return json.dumps({
                    "success": True,
                    "tasks": tasks,
                    "total_count": total_count,
                    "count": len(tasks),
                    "query": query,
                    "filter_by": filter_by,
                    "filter_value": filter_value,
                    "page": page,
                    "per_page": per_page
                })

    except Exception as e:
        return MCPErrorFormatter.format_error(
            error_type="unknown_error",
            message=f"Failed to find tasks: {str(e)}",
            details={
                "exception_type": type(e).__name__,
                "exception_message": str(e)
            }
        )


async def manage_task(
    ctx: Context,
    action: str,
    task_id: str | None = None,
    project_id: str | None = None,
    parent_task_id: str | None = None,
    story_id: str | None = None,
    title: str | None = None,
    description: str | None = None,
    status: str | None = None,
    assignee: str | None = None,
    task_order: int | None = None,
    feature: str | None = None,
) -> str:
    """
    Manage tasks (consolidated: create/update/delete).
    """
    try:
        api_url = get_api_url()
        timeout = get_default_timeout()

        async with httpx.AsyncClient(timeout=timeout) as client:
            if action == "create":
                if not project_id or not title:
                    return MCPErrorFormatter.format_error(
                        "missing_required_fields",
                        "project_id and title are required for creating tasks"
                    )

                data = {
                    "project_id": project_id,
                    "title": title,
                    "description": description or "",
                    "status": status or "todo",
                    "assignee": assignee or "User",
                    "task_order": task_order or 0,
                    "feature": feature
                }

                if parent_task_id:
                    data["parent_task_id"] = parent_task_id
                if story_id:
                    data["story_id"] = story_id

                response = await client.post(urljoin(api_url, "/api/tasks"), json=data)
                response.raise_for_status()

                return json.dumps({
                    "success": True,
                    "task": response.json(),
                    "message": f"Task '{title}' created successfully"
                })

            elif action == "update":
                if not task_id:
                    return MCPErrorFormatter.format_error(
                        "missing_required_fields",
                        "task_id is required for updating tasks"
                    )

                data = {}
                if title is not None:
                    data["title"] = title
                if description is not None:
                    data["description"] = description
                if status is not None:
                    data["status"] = status
                if assignee is not None:
                    data["assignee"] = assignee
                if task_order is not None:
                    data["task_order"] = task_order
                if feature is not None:
                    data["feature"] = feature

                response = await client.put(urljoin(api_url, f"/api/tasks/{task_id}"), json=data)
                response.raise_for_status()

                return json.dumps({
                    "success": True,
                    "task": response.json(),
                    "message": f"Task {task_id} updated successfully"
                })

            elif action == "delete":
                if not task_id:
                    return MCPErrorFormatter.format_error(
                        "missing_required_fields",
                        "task_id is required for deleting tasks"
                    )

                response = await client.delete(urljoin(api_url, f"/api/tasks/{task_id}"))
                response.raise_for_status()

                return json.dumps({
                    "success": True,
                    "message": f"Task {task_id} deleted successfully"
                })

            else:
                return MCPErrorFormatter.format_error(
                    "invalid_action",
                    f"Unknown action: {action}. Valid actions: create, update, delete"
                )

    except Exception as e:
        return MCPErrorFormatter.format_error(
            error_type="unknown_error",
            message=f"Failed to {action} task: {str(e)}",
            details={
                "exception_type": type(e).__name__,
                "exception_message": str(e)
            }
        )