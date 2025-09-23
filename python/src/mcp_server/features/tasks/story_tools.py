"""
Story management tools for Archon MCP Server.

Provides find_stories and manage_story functionality for the unified Kanban interface.
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


async def find_stories(
    ctx: Context,
    query: str | None = None,
    story_id: str | None = None,
    filter_by: str | None = None,
    filter_value: str | None = None,
    project_id: str | None = None,
    epic_id: str | None = None,
    include_closed: bool = True,
    page: int = 1,
    per_page: int = DEFAULT_PAGE_SIZE,
) -> str:
    """
    Find and search stories (consolidated: list + search + get).

    Args:
        query: Keyword search in title, description (optional)
        story_id: Get specific story by ID (returns full details)
        filter_by: "status" | "project" | "epic" | "assignee" (optional)
        filter_value: Filter value (e.g., "todo", "doing", "review", "done")
        project_id: Project UUID (optional, for additional filtering)
        epic_id: Epic UUID (optional, for epic-specific stories)
        include_closed: Include done stories in results
        page: Page number for pagination
        per_page: Items per page (default: 10)

    Returns:
        JSON array of stories or single story (optimized payloads for lists)

    Examples:
        find_stories() # All stories
        find_stories(query="authentication") # Search for "authentication"
        find_stories(story_id="story-123") # Get specific story (full details)
        find_stories(epic_id="epic-1") # Stories for specific epic
        find_stories(filter_by="status", filter_value="todo") # Only todo stories
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
                    return json.dumps({"success": True, "story": story})
                elif response.status_code == 404:
                    return MCPErrorFormatter.format_error(
                        error_type="not_found",
                        message=f"Story {story_id} not found",
                        details={"story_id": story_id}
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
        if epic_id:
            params["epic_id"] = epic_id
        if not include_closed:
            params["exclude_status"] = "done"
        if page:
            params["page"] = page
        if per_page:
            params["per_page"] = per_page

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(urljoin(api_url, "/api/stories"), params=params)
            response.raise_for_status()

            data = response.json()
            if isinstance(data, list):
                stories_data = data
                total_count = len(stories_data)
            else:
                stories_data = data.get("stories", data.get("data", []))
                total_count = data.get("total_count", len(stories_data))

            # Optimize for MCP usage
            optimized_stories = []
            for story in stories_data:
                optimized_story = optimize_task_response(story)
                if len(optimized_story.get("description", "")) > MAX_DESCRIPTION_LENGTH:
                    optimized_story["description"] = optimized_story["description"][:MAX_DESCRIPTION_LENGTH] + "..."
                optimized_stories.append(optimized_story)

            return json.dumps({
                "success": True,
                "stories": optimized_stories,
                "total_count": total_count,
                "count": len(optimized_stories),
                "query": query,
                "filter_by": filter_by,
                "filter_value": filter_value,
                "epic_id": epic_id,
                "page": page,
                "per_page": per_page
            })

    except Exception as e:
        return MCPErrorFormatter.format_error(
            error_type="find_stories_error",
            message=f"Failed to find stories: {str(e)}",
            details={
                "query": query,
                "story_id": story_id,
                "epic_id": epic_id,
                "exception_type": type(e).__name__
            }
        )


async def manage_story(
    ctx: Context,
    action: str,
    story_id: str | None = None,
    project_id: str | None = None,
    epic_id: str | None = None,
    parent_story_id: str | None = None,
    title: str | None = None,
    description: str | None = None,
    status: str | None = None,
    assignee: str | None = None,
    story_order: int | None = None,
    feature: str | None = None,
) -> str:
    """
    Manage stories (consolidated: create/update/delete).

    Args:
        action: "create" | "update" | "delete"
        story_id: Story UUID for update/delete
        project_id: Project UUID for create
        epic_id: Epic UUID for linking story to epic
        parent_story_id: Parent story UUID for hierarchical stories
        title: Story title text
        description: Detailed story description
        status: "todo" | "doing" | "review" | "done"
        assignee: "User" | "Archon" | "AI IDE Agent"
        story_order: Priority 0-100 (higher = more priority)
        feature: Feature label for grouping

    Examples:
        manage_story("create", project_id="p-1", epic_id="e-1", title="User Authentication")
        manage_story("update", story_id="s-1", status="doing")
        manage_story("delete", story_id="s-1")

    Returns: {success: bool, story?: object, message: string}
    """
    try:
        api_url = get_api_url()
        timeout = get_default_timeout()

        if action == "create":
            if not project_id or not title:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message="project_id and title are required for story creation",
                    details={"missing_fields": ["project_id", "title"]}
                )

            story_data = {
                "project_id": project_id,
                "title": title,
                "description": description or "",
                "status": status or "todo",
                "assignee": assignee or "User",
                "story_order": story_order or 50,
                "feature": feature
            }
            if epic_id:
                story_data["epic_id"] = epic_id
            if parent_story_id:
                story_data["parent_story_id"] = parent_story_id

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    urljoin(api_url, "/api/stories"),
                    json=story_data
                )
                response.raise_for_status()
                story = response.json()

                return json.dumps({
                    "success": True,
                    "story": story,
                    "message": f"Story '{title}' created successfully"
                })

        elif action == "update":
            if not story_id:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message="story_id is required for story update",
                    details={"missing_fields": ["story_id"]}
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
            if story_order is not None:
                update_data["story_order"] = story_order
            if feature is not None:
                update_data["feature"] = feature
            if epic_id is not None:
                update_data["epic_id"] = epic_id

            if not update_data:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message="At least one field must be provided for update",
                    details={"story_id": story_id}
                )

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.patch(
                    urljoin(api_url, f"/api/stories/{story_id}"),
                    json=update_data
                )
                response.raise_for_status()
                story = response.json()

                return json.dumps({
                    "success": True,
                    "story": story,
                    "message": f"Story {story_id} updated successfully"
                })

        elif action == "delete":
            if not story_id:
                return MCPErrorFormatter.format_error(
                    error_type="validation_error",
                    message="story_id is required for story deletion",
                    details={"missing_fields": ["story_id"]}
                )

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.delete(urljoin(api_url, f"/api/stories/{story_id}"))
                response.raise_for_status()

                return json.dumps({
                    "success": True,
                    "message": f"Story {story_id} deleted successfully"
                })

        else:
            return MCPErrorFormatter.format_error(
                error_type="validation_error",
                message=f"Invalid action '{action}'. Must be 'create', 'update', or 'delete'",
                details={"action": action}
            )

    except Exception as e:
        return MCPErrorFormatter.format_error(
            error_type="manage_story_error",
            message=f"Failed to {action} story: {str(e)}",
            details={
                "action": action,
                "story_id": story_id,
                "exception_type": type(e).__name__
            }
        )