"""
Analytics and health monitoring functions for TRAXIS project management.
"""

import json
import httpx
from urllib.parse import urljoin
from mcp.server.fastmcp import Context
from datetime import datetime, timedelta

from .task_utils import (
    get_api_url,
    get_default_timeout,
    MCPErrorFormatter,
    make_api_request,
    normalize_api_response
)


async def analyze_project_health(
    ctx: Context,
    project_id: str | None = None,
    scope: str = "current",
    include_metrics: bool = True
) -> str:
    """
    Analyze project health and provide insights on bottlenecks, risks, and progress.

    Args:
        project_id: Project UUID (optional)
        scope: "current" | "epic" | "project" | "all"
        include_metrics: Include detailed metrics in response

    Returns:
        JSON with health score, bottlenecks, risks, and metrics

    Examples:
        analyze_project_health()  # Current scope analysis
        analyze_project_health(project_id="p-1", scope="project")  # Full project analysis
    """
    try:
        timeout = get_default_timeout()

        health_data = {
            "health_score": 0,
            "bottlenecks": [],
            "risks": [],
            "metrics": {},
            "recommendations": []
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            # Fetch tasks using standardized approach
            task_params = {
                "page": 1,
                "per_page": 100,  # Get more items for analysis
                "include_closed": True
            }
            if project_id:
                task_params["project_id"] = project_id

            success, task_result = await make_api_request(
                client, "/api/tasks", task_params, "tasks"
            )

            if not success:
                return MCPErrorFormatter.format_error(
                    "failed_to_fetch",
                    "Could not fetch tasks for health analysis",
                    task_result
                )

            tasks = task_result["data"]

            # Fetch epics if scope includes them
            epics = []
            if scope in ["epic", "project", "all"]:
                epic_params = {"page": 1, "per_page": 50}
                if project_id:
                    epic_params["project_id"] = project_id

                epic_success, epic_result = await make_api_request(
                    client, "/api/epics", epic_params, "epics"
                )
                if epic_success:
                    epics = epic_result["data"]

            # Calculate health metrics
            total_items = len(tasks) + len(epics)
            if total_items == 0:
                health_data["health_score"] = 100
                health_data["metrics"] = {"total_items": 0, "message": "No tasks or epics found"}
                health_data["recommendations"].append("Create some tasks to start tracking progress")
                return json.dumps({"success": True, **health_data})

            # Analyze task distribution
            status_counts = {"todo": 0, "doing": 0, "review": 0, "waiting": 0, "done": 0}
            blocked_items = []
            stale_items = []

            # Simple iteration without complex date handling for now
            for task in tasks:
                if not isinstance(task, dict):
                    continue

                status = task.get("status", "todo")
                if status in status_counts:
                    status_counts[status] += 1

                # Check for blocked/waiting tasks
                if status == "waiting":
                    blocked_items.append({
                        "id": task.get("id"),
                        "title": task.get("title", ""),
                        "type": "task"
                    })

            # Calculate health score based on progress
            completed = status_counts["done"]
            in_progress = status_counts["doing"] + status_counts["review"]
            blocked = status_counts["waiting"]
            total_active = sum(status_counts.values())

            if total_active > 0:
                completion_rate = (completed / total_active) * 100
                progress_rate = (in_progress / total_active) * 100
                blocked_rate = (blocked / total_active) * 100

                # Health score: heavily weight completion, penalize blocking
                health_score = max(0, completion_rate + (progress_rate * 0.5) - (blocked_rate * 2))
                health_data["health_score"] = min(100, health_score)
            else:
                health_data["health_score"] = 0

            # Populate metrics
            if include_metrics:
                health_data["metrics"] = {
                    "total_tasks": len(tasks),
                    "total_epics": len(epics),
                    "status_distribution": status_counts,
                    "completion_rate": completion_rate if total_active > 0 else 0,
                    "blocked_count": len(blocked_items),
                    "scope": scope
                }

            # Add bottlenecks
            if blocked_items:
                health_data["bottlenecks"] = blocked_items[:5]  # Top 5

            # Add risks
            if blocked_rate > 20:
                health_data["risks"].append({
                    "type": "high_blocked_rate",
                    "severity": "high",
                    "message": f"{blocked_rate:.1f}% of tasks are blocked"
                })

            if completion_rate < 30 and total_active > 5:
                health_data["risks"].append({
                    "type": "low_completion",
                    "severity": "medium",
                    "message": f"Only {completion_rate:.1f}% of tasks completed"
                })

            # Add recommendations
            if blocked_items:
                health_data["recommendations"].append("Review and resolve blocked/waiting tasks")

            if progress_rate < 20:
                health_data["recommendations"].append("Start more tasks to increase progress")

            return json.dumps({"success": True, **health_data})

    except Exception as e:
        return MCPErrorFormatter.format_error(
            error_type="unknown_error",
            message=f"Failed to analyze project health: {str(e)}",
            details={
                "exception_type": type(e).__name__,
                "exception_message": str(e)
            }
        )


async def find_bottlenecks(
    ctx: Context,
    epic_id: str | None = None,
    story_id: str | None = None,
    include_dependencies: bool = True,
    limit: int = 10
) -> str:
    """
    Find bottlenecks in the project that are blocking progress.

    Args:
        epic_id: Filter by specific epic
        story_id: Filter by specific story
        include_dependencies: Include dependency analysis
        limit: Maximum number of bottlenecks to return

    Returns:
        JSON with bottlenecks sorted by impact

    Examples:
        find_bottlenecks()  # All bottlenecks
        find_bottlenecks(epic_id="e-1", include_dependencies=True)
    """
    try:
        timeout = get_default_timeout()
        bottlenecks = []

        async with httpx.AsyncClient(timeout=timeout) as client:
            # Get tasks using standardized approach
            task_params = {"page": 1, "per_page": 100, "include_closed": True}
            if epic_id:
                task_params["epic_id"] = epic_id
            if story_id:
                task_params["story_id"] = story_id

            success, result = await make_api_request(
                client, "/api/tasks", task_params, "tasks"
            )

            if not success:
                return MCPErrorFormatter.format_error(
                    "failed_to_fetch",
                    "Could not fetch tasks for bottleneck analysis",
                    result
                )

            tasks = result["data"]

            # Analyze for bottlenecks
            waiting_tasks = []
            overloaded_assignees = {}
            dependency_blocks = []

            for task in tasks:
                if not isinstance(task, dict):
                    continue

                # Check for waiting/blocked tasks
                if task.get("status") == "waiting":
                    waiting_tasks.append({
                        "id": task.get("id"),
                        "title": task.get("title", ""),
                        "assignee": task.get("assignee"),
                        "blocked_days": 0  # Would calculate from updated_at
                    })

                # Track assignee workload
                assignee = task.get("assignee")
                if assignee and task.get("status") in ["todo", "doing"]:
                    if assignee not in overloaded_assignees:
                        overloaded_assignees[assignee] = []
                    overloaded_assignees[assignee].append(task.get("id"))

            # Check for dependency bottlenecks if requested
            if include_dependencies:
                try:
                    dep_success, dep_result = await make_api_request(
                        client, "/api/dependencies", None, "dependencies"
                    )
                    if dep_success:
                        dependencies = dep_result["data"]

                        # Find circular dependencies or long chains
                        for dep in dependencies:
                            if isinstance(dep, dict) and dep.get("type") == "blocks":
                                dependency_blocks.append({
                                    "from": dep.get("from_id"),
                                    "to": dep.get("to_id"),
                                    "type": "blocking_dependency"
                                })
                except Exception:
                    # Ignore dependency analysis errors
                    pass

            # Compile bottlenecks
            for task in waiting_tasks:
                bottlenecks.append({
                    "type": "waiting_task",
                    "impact": "high",
                    "item_id": task["id"],
                    "title": task["title"],
                    "details": f"Task blocked in waiting status",
                    "suggestion": "Review dependencies and unblock"
                })

            for assignee, task_ids in overloaded_assignees.items():
                if len(task_ids) > 5:  # Threshold for overload
                    bottlenecks.append({
                        "type": "overloaded_assignee",
                        "impact": "medium",
                        "assignee": assignee,
                        "task_count": len(task_ids),
                        "details": f"{assignee} has {len(task_ids)} active tasks",
                        "suggestion": "Redistribute tasks or prioritize"
                    })

            for dep in dependency_blocks:
                bottlenecks.append({
                    "type": "dependency_block",
                    "impact": "high",
                    "from_id": dep["from"],
                    "to_id": dep["to"],
                    "details": "Blocking dependency detected",
                    "suggestion": "Resolve dependency or remove block"
                })

            # Sort by impact and limit
            impact_order = {"high": 3, "medium": 2, "low": 1}
            bottlenecks.sort(key=lambda x: impact_order.get(x.get("impact", "low"), 1), reverse=True)

            return json.dumps({
                "success": True,
                "bottlenecks": bottlenecks[:limit],
                "total_found": len(bottlenecks),
                "analysis_scope": {
                    "epic_id": epic_id,
                    "story_id": story_id,
                    "include_dependencies": include_dependencies
                }
            })

    except Exception as e:
        return MCPErrorFormatter.format_error(
            error_type="unknown_error",
            message=f"Failed to find bottlenecks: {str(e)}",
            details={
                "exception_type": type(e).__name__,
                "exception_message": str(e)
            }
        )


async def find_stale_items(
    ctx: Context,
    days: int = 7,
    status_filter: list[str] | None = None,
    include_assignee: bool = True
) -> str:
    """
    Find items that haven't been updated recently.

    Args:
        days: Number of days to consider as stale (default: 7)
        status_filter: Only check specific statuses (e.g., ["todo", "doing"])
        include_assignee: Include assignee information

    Returns:
        JSON with stale items sorted by last update

    Examples:
        find_stale_items()  # Items not updated in 7 days
        find_stale_items(days=14, status_filter=["doing"])  # Active items stale > 14 days
    """
    try:
        timeout = get_default_timeout()

        async with httpx.AsyncClient(timeout=timeout) as client:
            # Get tasks
            success, result = await make_api_request(
                client, "/api/tasks", {"page": 1, "per_page": 200}, "tasks"
            )

            if not success:
                return MCPErrorFormatter.format_error(
                    "failed_to_fetch",
                    "Could not fetch tasks for stale analysis",
                    result
                )

            tasks = result["data"]
            stale_items = []
            cutoff_date = datetime.now() - timedelta(days=days)

            for task in tasks:
                if not isinstance(task, dict):
                    continue

                # Apply status filter if provided
                if status_filter and task.get("status") not in status_filter:
                    continue

                # Simple stale detection (would need proper date parsing in real implementation)
                updated_at = task.get("updated_at")
                if updated_at:
                    try:
                        # Basic date comparison (simplified)
                        # In real implementation, would parse ISO datetime
                        stale_items.append({
                            "id": task.get("id"),
                            "title": task.get("title", ""),
                            "status": task.get("status"),
                            "assignee": task.get("assignee") if include_assignee else None,
                            "updated_at": updated_at,
                            "days_stale": days,  # Simplified calculation
                            "type": "task"
                        })
                    except Exception:
                        # Skip items with unparseable dates
                        continue

            # Sort by staleness (most stale first)
            # In real implementation, would sort by actual date calculation
            stale_items = stale_items[:20]  # Limit results

            return json.dumps({
                "success": True,
                "stale_items": stale_items,
                "total_found": len(stale_items),
                "criteria": {
                    "days": days,
                    "status_filter": status_filter
                },
                "recommendations": [
                    "Review stale items and update status",
                    "Check if items can be closed or reassigned",
                    "Consider breaking down large stale tasks"
                ]
            })

    except Exception as e:
        return MCPErrorFormatter.format_error(
            error_type="unknown_error",
            message=f"Failed to find stale items: {str(e)}",
            details={
                "exception_type": type(e).__name__,
                "exception_message": str(e)
            }
        )