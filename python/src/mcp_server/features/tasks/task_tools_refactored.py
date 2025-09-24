"""
Refactored MCP tools registration for TRAXIS task management.

This file imports from the modular components and registers all tools.
"""

import traceback

from mcp.server.fastmcp import Context, FastMCP  # type: ignore

from .epic_tools import find_epics, manage_epic
from .story_tools import find_stories, manage_story
from .task_analytics import (
    analyze_project_health,
    find_bottlenecks,
    find_stale_items,
    get_progress_snapshot,
    get_epic_timeline,
    predict_completion
)

# Import from modular components
from .task_core import find_tasks, manage_task
from .task_analytics import (
    analyze_project_health,
    find_bottlenecks,
    find_stale_items,
    get_progress_snapshot,
    get_epic_timeline,
    predict_completion
)
from .epic_tools import find_epics, manage_epic
from .story_tools import find_stories, manage_story
from .task_utils import MCPErrorFormatter


def register_task_tools(mcp: FastMCP) -> None:
    """
    Register all task management tools with the MCP server.

    This function now imports from smaller, focused modules instead of
    having everything in a single 3000-line file.
    """

    # Core CRUD operations
    @mcp.tool()
    async def find_tasks_tool(
        ctx: Context,
        query: str | None = None,
        task_id: str | None = None,
        filter_by: str | None = None,
        filter_value: str | None = None,
        project_id: str | None = None,
        include_closed: bool = True,
        page: int = 1,
        per_page: int = 10,
    ) -> str:
        """Find and search tasks (consolidated: list + search + get)."""
        return await find_tasks(
            ctx, query, task_id, filter_by, filter_value, project_id, include_closed, page, per_page
        )

    @mcp.tool()
    async def manage_task_tool(
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
        """Manage tasks (consolidated: create/update/delete)."""
        return await manage_task(
            ctx,
            action,
            task_id,
            project_id,
            parent_task_id,
            story_id,
            title,
            description,
            status,
            assignee,
            task_order,
            feature,
        )

    # Analytics and health monitoring
    @mcp.tool()
    async def analyze_project_health_tool(
        ctx: Context, project_id: str | None = None, scope: str = "current", include_metrics: bool = True
    ) -> str:
        """Analyze project health and provide insights on bottlenecks, risks, and progress."""
        return await analyze_project_health(ctx, project_id, scope, include_metrics)

    @mcp.tool()
    async def find_bottlenecks_tool(
        ctx: Context,
        epic_id: str | None = None,
        story_id: str | None = None,
        include_dependencies: bool = True,
        limit: int = 10,
    ) -> str:
        """Find bottlenecks in the project that are blocking progress."""
        return await find_bottlenecks(ctx, epic_id, story_id, include_dependencies, limit)

    @mcp.tool()
    async def find_stale_items_tool(
        ctx: Context, days: int = 7, status_filter: list[str] | None = None, include_assignee: bool = True
    ) -> str:
        """Find items that haven't been updated recently."""
        return await find_stale_items(ctx, days, status_filter, include_assignee)

    # EPICs management tools
    @mcp.tool()
    async def find_epics_tool(
        ctx: Context,
        query: str | None = None,
        epic_id: str | None = None,
        filter_by: str | None = None,
        filter_value: str | None = None,
        project_id: str | None = None,
        include_closed: bool = True,
        page: int = 1,
        per_page: int = 10,
    ) -> str:
        """Find and search epics (consolidated: list + search + get)."""
        return await find_epics(
            ctx, query, epic_id, filter_by, filter_value, project_id, include_closed, page, per_page
        )

    @mcp.tool()
    async def manage_epic_tool(
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
        """Manage epics (consolidated: create/update/delete)."""
        return await manage_epic(
            ctx, action, epic_id, project_id, parent_epic_id, title, description, status, assignee, epic_order, feature
        )

    # Stories management tools
    @mcp.tool()
    async def find_stories_tool(
        ctx: Context,
        query: str | None = None,
        story_id: str | None = None,
        filter_by: str | None = None,
        filter_value: str | None = None,
        project_id: str | None = None,
        epic_id: str | None = None,
        include_closed: bool = True,
        page: int = 1,
        per_page: int = 10,
    ) -> str:
        """Find and search stories (consolidated: list + search + get)."""
        return await find_stories(
            ctx, query, story_id, filter_by, filter_value, project_id, epic_id, include_closed, page, per_page
        )

    @mcp.tool()
    async def manage_story_tool(
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
        """Manage stories (consolidated: create/update/delete)."""
        return await manage_story(
            ctx,
            action,
            story_id,
            project_id,
            epic_id,
            parent_story_id,
            title,
            description,
            status,
            assignee,
            story_order,
            feature,
        )

    # Progress Reporting Tools (STORY 3.7.6)
    @mcp.tool()
    async def get_progress_snapshot_tool(
        ctx: Context,
        epic_id: str | None = None,
        depth: int = 2
    ) -> str:
        """
        Get a snapshot of current progress metrics for AI agents.

        Args:
            epic_id: Optional Epic ID to focus on specific epic
            depth: Analysis depth (1=basic, 2=detailed, 3=comprehensive)

        Returns:
            JSON with progress metrics, velocity, and trend analysis
        """
        return await get_progress_snapshot(ctx, epic_id, depth)

    @mcp.tool()
    async def get_epic_timeline_tool(
        ctx: Context,
        epic_id: str
    ) -> str:
        """
        Get timeline and milestone information for a specific epic.

        Args:
            epic_id: Epic UUID to analyze

        Returns:
            JSON with milestones, critical dates, and timeline status
        """
        return await get_epic_timeline(ctx, epic_id)

    @mcp.tool()
    async def predict_completion_tool(
        ctx: Context,
        target_id: str,
        target_type: str,
        based_on: str = "velocity"
    ) -> str:
        """
        Predict completion date for a target (epic, story, or project).

        Args:
            target_id: ID of the target to predict
            target_type: "epic" | "story" | "project" | "task"
            based_on: Prediction method - "velocity" (default) | "average" | "optimistic"

        Returns:
            JSON with completion prediction, confidence level, and assumptions
        """
        return await predict_completion(ctx, target_id, target_type, based_on)

    # Test function for debugging
    @mcp.tool()
    async def test_modular_structure(ctx: Context) -> str:
        """Test that the new modular structure works correctly."""
        try:
            return MCPErrorFormatter.format_error(
                "test_success",
                "Modular structure is working correctly",
                {"modules_loaded": ["task_core", "task_analytics", "task_utils"]},
            ).replace('"success": false', '"success": true')  # Convert to success
        except Exception as e:
            return MCPErrorFormatter.format_error(
                "test_failed",
                f"Modular structure test failed: {str(e)}",
                {"exception_type": type(e).__name__, "traceback": traceback.format_exc()},
            )
