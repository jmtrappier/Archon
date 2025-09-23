"""
Epic management tools for Archon MCP Server.

Provides find_epics and manage_epic functionality for the unified Kanban interface.
"""

import json
from urllib.parse import urljoin
import httpx
from mcp.server.fastmcp import Context

from .task_utils import (
    MCPErrorFormatter,
    get_api_url,
    get_default_timeout,
    DEFAULT_PAGE_SIZE,
    MAX_DESCRIPTION_LENGTH,
    optimize_task_response,
)


async def find_epics(
    ctx: Context,
    query: str | None = None,
    epic_id: str | None = None,
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
                    return json.dumps({"success": True, "epic": epic})
                elif response.status_code == 404:
                    return MCPErrorFormatter.format_error(
                        error_type="not_found",
                        message=f"Epic {epic_id} not found",
                        details={"epic_id": epic_id}
                    )
                else:
                    response.raise_for_status()

        # List/search mode
        params = {}
        if query:
            params["q"] = query
        if filter_by and filter_value:
            params[filter_by] = filter_value
        if project_id:
            params["project_id"] = project_id
        if not include_closed:
            params["exclude_status"] = "done"
        if page:
            params["page"] = page
        if per_page:
            params["per_page"] = per_page

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(urljoin(api_url, "/api/epics"), params=params)
            response.raise_for_status()

            data = response.json()
            if isinstance(data, list):
                epics_data = data
                total_count = len(epics_data)
            else:
                epics_data = data.get("epics", data.get("data", []))
                total_count = data.get("total_count", len(epics_data))

            # Optimize for MCP usage
            optimized_epics = []
            for epic in epics_data:
                optimized_epic = optimize_task_response(epic)
                if len(optimized_epic.get("description", "")) > MAX_DESCRIPTION_LENGTH:
                    optimized_epic["description"] = optimized_epic["description"][:MAX_DESCRIPTION_LENGTH] + "..."
                optimized_epics.append(optimized_epic)

            return json.dumps({
                "success": True,
                "epics": optimized_epics,
                "total_count": total_count,
                "count": len(optimized_epics),
                "query": query,
                "filter_by": filter_by,
                "filter_value": filter_value,
                "page": page,
                "per_page": per_page
            })

    except Exception as e:
        return MCPErrorFormatter.format_error(
            error_type="find_epics_error",
            message=f"Failed to find epics: {str(e)}",
            details={
                "query": query,
                "epic_id": epic_id,
                "exception_type": type(e).__name__
            }
        )


async def manage_epic(
    ctx: Context,
    action: str,
    epic_id: str | None = None,
    project_id: str | None = None,
    parent_epic_id: str | None = None,
    title: str | None = None,
    description: str | None = None,
    status: str | None = None,
    assignee: str | None = None,
    epic_order: int | None = None,
    feature: str | None = None,
) -> str:
    """
    Manage epics (consolidated: create/update/delete).

    Args:
        action: "create" | "update" | "delete"
        epic_id: Epic UUID for update/delete
        project_id: Project UUID for create
        parent_epic_id: Parent epic UUID for hierarchical epics
        title: Epic title text
        description: Detailed epic description
        status: "todo" | "doing" | "review" | "done"
        assignee: "User" | "Archon" | "AI IDE Agent"
        epic_order: Priority 0-100 (higher = more priority)
        feature: Feature label for grouping

    Examples:
        manage_epic("create", project_id="p-1", title="Database Migration")
        manage_epic("update", epic_id="e-1", status="doing")
        manage_epic("delete", epic_id="e-1")

    Returns: {success: bool, epic?: object, message: string}
    """
    try:
        api_url = get_api_url()
        timeout = get_default_timeout()

        if action == "create":
            if not project_id or not title:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message="project_id and title are required for epic creation",
                    details={"missing_fields": ["project_id", "title"]}
                )

            epic_data = {
                "project_id": project_id,
                "title": title,
                "description": description or "",
                "status": status or "todo",
                "assignee": assignee or "User",
                "epic_order": epic_order or 50,
                "feature": feature
            }
            if parent_epic_id:
                epic_data["parent_epic_id"] = parent_epic_id

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    urljoin(api_url, "/api/epics"),
                    json=epic_data
                )
                response.raise_for_status()
                epic = response.json()

                return json.dumps({
                    "success": True,
                    "epic": epic,
                    "message": f"Epic '{title}' created successfully"
                })

        elif action == "update":
            if not epic_id:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message="epic_id is required for epic update",
                    details={"missing_fields": ["epic_id"]}
                )

            update_data = {}
            if title is not None:
                update_data["title"] = title
            if description is not None:
                update_data["description"] = description
            if status is not None:
                update_data["status"] = status
            if assignee is not None:
                update_data["assignee"] = assignee
            if epic_order is not None:
                update_data["epic_order"] = epic_order
            if feature is not None:
                update_data["feature"] = feature

            if not update_data:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message="At least one field must be provided for update",
                    details={"epic_id": epic_id}
                )

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.patch(
                    urljoin(api_url, f"/api/epics/{epic_id}"),
                    json=update_data
                )
                response.raise_for_status()
                epic = response.json()

                return json.dumps({
                    "success": True,
                    "epic": epic,
                    "message": f"Epic {epic_id} updated successfully"
                })

        elif action == "delete":
            if not epic_id:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message="epic_id is required for epic deletion",
                    details={"missing_fields": ["epic_id"]}
                )

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.delete(urljoin(api_url, f"/api/epics/{epic_id}"))
                response.raise_for_status()

                return json.dumps({
                    "success": True,
                    "message": f"Epic {epic_id} deleted successfully"
                })

        else:
            return MCPErrorFormatter.format_error(
                error_type="validation_error",
                message=f"Invalid action '{action}'. Must be 'create', 'update', or 'delete'",
                details={"action": action}
            )

    except Exception as e:
        return MCPErrorFormatter.format_error(
            error_type="manage_epic_error",
            message=f"Failed to {action} epic: {str(e)}",
            details={
                "action": action,
                "epic_id": epic_id,
                "exception_type": type(e).__name__
            }
        )