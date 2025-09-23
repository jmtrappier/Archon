from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi import status as http_status
from pydantic import BaseModel

from ..config.logfire_config import get_logger, logfire
from ..utils import get_supabase_client
from ..utils.etag_utils import check_etag, generate_etag

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["auto-refactored"])

from ..services.projects import TaskService

@router.get("/projects/{project_id}/tasks")
async def list_project_tasks(
    project_id: str,
    request: Request,
    response: Response,
    include_archived: bool = False,
    exclude_large_fields: bool = False
):
    """List all tasks for a specific project with ETag support for efficient polling."""
    try:
        # Get If-None-Match header for ETag comparison
        if_none_match = request.headers.get("If-None-Match")

        logfire.debug(
            f"Listing project tasks | project_id={project_id} | include_archived={include_archived} | exclude_large_fields={exclude_large_fields} | etag={if_none_match}"
        )

        # Use TaskService to list tasks
        task_service = TaskService()
        success, result = await task_service.list_tasks(
            project_id=project_id,
            include_closed=True,  # Get all tasks, including done
            exclude_large_fields=exclude_large_fields,
            include_archived=include_archived,  # Pass the flag down to service
        )

        if not success:
            raise HTTPException(status_code=500, detail=result)

        tasks = result.get("tasks", [])

        # Generate ETag from task data (excluding timestamps for consistency)
        etag_data = {
            "tasks": [{
                "id": task.get("id"),
                "title": task.get("title"),
                "status": task.get("status"),
                "task_order": task.get("task_order"),
                "assignee": task.get("assignee"),
                "feature": task.get("feature")
            } for task in tasks],
            "project_id": project_id,
            "count": len(tasks)
        }
        current_etag = generate_etag(etag_data)

        # Check if client's ETag matches (304 Not Modified)
        if check_etag(if_none_match, current_etag):
            response.status_code = 304
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            response.headers["Last-Modified"] = datetime.utcnow().isoformat()
            logfire.debug(f"Tasks unchanged, returning 304 | project_id={project_id} | etag={current_etag}")
            return None

        # Set ETag headers for successful response
        response.headers["ETag"] = current_etag
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()

        logfire.debug(
            f"Project tasks retrieved | project_id={project_id} | task_count={len(tasks)} | etag={current_etag}"
        )

        return tasks

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list project tasks | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# Remove the complex /tasks endpoint - it's not needed and breaks things


@router.post("/tasks")
async def create_task(request: CreateTaskRequest):
    """Create a new task or subtask with automatic reordering."""
    try:
        task_service = TaskService()

        # If parent_task_id is provided, create a subtask
        if request.parent_task_id:
            success, result = await task_service.create_subtask(
                parent_task_id=request.parent_task_id,
                title=request.title,
                description=request.description or "",
                assignee=request.assignee or "User",
                task_order=request.task_order or 0,
                feature=request.feature,
                priority=request.priority or "medium",
            )

            if not success:
                raise HTTPException(status_code=400, detail=result)

            created_subtask = result["subtask"]

            logfire.info(
                f"Subtask created successfully | subtask_id={created_subtask['id']} | parent_task_id={request.parent_task_id}"
            )

            return {"message": "Subtask created successfully", "task": created_subtask}

        # Otherwise, create a regular task
        else:
            success, result = await task_service.create_task(
                project_id=request.project_id,
                title=request.title,
                description=request.description or "",
                assignee=request.assignee or "User",
                task_order=request.task_order or 0,
                feature=request.feature,
                story_id=request.story_id,  # Support for hierarchy
                priority=request.priority or "medium",
            )

            if not success:
                raise HTTPException(status_code=400, detail=result)

            created_task = result["task"]

            logfire.info(
                f"Task created successfully | task_id={created_task['id']} | project_id={request.project_id}"
            )

            return {"message": "Task created successfully", "task": created_task}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create task | error={str(e)} | project_id={request.project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/stories/{story_id}/tasks/reorder")
async def reorder_story_tasks(story_id: str, request: ReorderTasksRequest):
    """Reorder root-level tasks within a story."""
    try:
        task_service = TaskService()
        success, result = await task_service.reorder_tasks_in_story(story_id, request.task_ids)

        if not success:
            detail = result if isinstance(result, dict) else {"error": result}
            message = detail.get("error", "")
            if "not found" in message.lower():
                raise HTTPException(status_code=404, detail=detail)
            raise HTTPException(status_code=400, detail=detail)

        logfire.info(
            f"Tasks reordered | story_id={story_id} | count={len(request.task_ids)}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to reorder tasks | error={str(e)} | story_id={story_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/tasks/{task_id}/subtasks/reorder")
async def reorder_task_subtasks(task_id: str, request: ReorderSubtasksRequest):
    """Reorder subtasks within a parent task."""
    try:
        task_service = TaskService()
        success, result = await task_service.reorder_subtasks_in_task(task_id, request.subtask_ids)

        if not success:
            detail = result if isinstance(result, dict) else {"error": result}
            message = detail.get("error", "")
            if "not found" in message.lower():
                raise HTTPException(status_code=404, detail=detail)
            raise HTTPException(status_code=400, detail=detail)

        logfire.info(
            f"Subtasks reordered | parent_task_id={task_id} | count={len(request.subtask_ids)}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to reorder subtasks | error={str(e)} | parent_task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/tasks")
async def list_tasks(
    status: str | None = None,
    project_id: str | None = None,
    epic_id: str | None = None,  # New hierarchy filter
    story_id: str | None = None,  # New hierarchy filter
    include_closed: bool = True,
    page: int = 1,
    per_page: int = 10,
    exclude_large_fields: bool = False,
    q: str | None = None,  # Search query parameter
):
    """List tasks with optional filters including status, project, epic, story and keyword search."""
    try:
        logfire.info(
            f"Listing tasks | status={status} | project_id={project_id} | epic_id={epic_id} | story_id={story_id} | include_closed={include_closed} | page={page} | per_page={per_page} | q={q}"
        )

        # Use TaskService to list tasks
        task_service = TaskService()
        success, result = await task_service.list_tasks(
            project_id=project_id,
            status=status,
            epic_id=epic_id,  # Pass hierarchy filters
            story_id=story_id,  # Pass hierarchy filters
            include_closed=include_closed,
            exclude_large_fields=exclude_large_fields,
            search_query=q,  # Pass search query to service
        )

        if not success:
            raise HTTPException(status_code=500, detail=result)

        tasks = result.get("tasks", [])

        # If exclude_large_fields is True, remove large fields from tasks
        if exclude_large_fields:
            for task in tasks:
                # Remove potentially large fields
                task.pop("sources", None)
                task.pop("code_examples", None)
                task.pop("messages", None)

        # Apply pagination
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_tasks = tasks[start_idx:end_idx]

        # Prepare response
        response = {
            "tasks": paginated_tasks,
            "pagination": {
                "total": len(tasks),
                "page": page,
                "per_page": per_page,
                "pages": (len(tasks) + per_page - 1) // per_page,
            },
        }

        # Monitor response size for optimization validation
        response_json = json.dumps(response)
        response_size = len(response_json)

        # Log response metrics
        logfire.info(
            f"Tasks listed successfully | count={len(paginated_tasks)} | "
            f"size_bytes={response_size} | exclude_large_fields={exclude_large_fields}"
        )

        # Warning for large responses (>10KB)
        if response_size > 10000:
            logfire.warning(
                f"Large task response size | size_bytes={response_size} | "
                f"exclude_large_fields={exclude_large_fields} | task_count={len(paginated_tasks)}"
            )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list tasks | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """Get a specific task by ID."""
    try:
        # Use TaskService to get the task
        task_service = TaskService()
        success, result = await task_service.get_task(task_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        task = result["task"]

        logfire.info(
            f"Task retrieved successfully | task_id={task_id} | project_id={task.get('project_id')}"
        )

        return task

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get task | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/tasks/{task_id}/subtasks")
async def get_task_subtasks(task_id: str):
    """Get all subtasks for a specific task."""
    try:
        # Use TaskService to get subtasks
        task_service = TaskService()
        success, result = await task_service.get_subtasks_by_parent(task_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Subtasks retrieved successfully | task_id={task_id} | count={result.get('total_count', 0)}"
        )

        # Return just the subtasks array as expected by the frontend
        return result.get("subtasks", [])

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get subtasks | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


class UpdateTaskRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    assignee: str | None = None
    task_order: int | None = None
    feature: str | None = None
    priority: str | None = None


class ReorderTasksRequest(BaseModel):
    task_ids: list[str]


class ReorderSubtasksRequest(BaseModel):
    subtask_ids: list[str]


class MoveTaskRequest(BaseModel):
    target_story_id: str | None = None
    target_parent_task_id: str | None = None
    target_position: int | None = None
    moved_by: str | None = None


class CreateDocumentRequest(BaseModel):
    document_type: str
    title: str
    content: dict[str, Any] | None = None
    tags: list[str] | None = None
    author: str | None = None


class UpdateDocumentRequest(BaseModel):
    title: str | None = None
    content: dict[str, Any] | None = None
    tags: list[str] | None = None
    author: str | None = None


class CreateVersionRequest(BaseModel):
    field_name: str
    content: dict[str, Any]
    change_summary: str | None = None
    change_type: str | None = "update"
    document_id: str | None = None
    created_by: str | None = "system"


class RestoreVersionRequest(BaseModel):
    restored_by: str | None = "system"


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, request: UpdateTaskRequest):
    """Update a task."""
    try:
        logfire.info(f"🚀 API update_task called | task_id={task_id} | request={request}")

        # Build update fields dictionary
        update_fields = {}
        if request.title is not None:
            update_fields["title"] = request.title
        if request.description is not None:
            update_fields["description"] = request.description
        if request.status is not None:
            update_fields["status"] = request.status
        if request.assignee is not None:
            update_fields["assignee"] = request.assignee
        if request.task_order is not None:
            update_fields["task_order"] = request.task_order
        if request.feature is not None:
            update_fields["feature"] = request.feature
        if request.priority is not None:
            update_fields["priority"] = request.priority

        logfire.info(f"🚀 API update_task built update_fields | task_id={task_id} | update_fields={update_fields}")

        # Use TaskService to update the task
        task_service = TaskService()
        logfire.info(f"🚀 API update_task calling task_service.update_task | task_id={task_id} | update_fields={update_fields}")
        success, result = await task_service.update_task(task_id, update_fields)

        logfire.info(f"🚀 API update_task task_service.update_task returned | task_id={task_id} | success={success} | result={result}")

        if not success:
            logfire.error(f"🚀 API update_task task_service failed | task_id={task_id} | error={result}")
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        updated_task = result["task"]

        logfire.info(
            f"🚀 API update_task success | task_id={task_id} | project_id={updated_task.get('project_id')} | updated_fields={list(update_fields.keys())} | returned_task={updated_task}"
        )

        response = {"message": "Task updated successfully", "task": updated_task}
        logfire.info(f"🚀 API update_task returning response | task_id={task_id} | response={response}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to update task | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/tasks/{task_id}/move")
async def move_task(task_id: str, request: MoveTaskRequest):
    """Move a task either to another story or under a different parent."""
    try:
        task_service = TaskService()

        if request.target_parent_task_id:
            success, result = await task_service.move_subtask_to_parent(
                task_id=task_id,
                target_parent_id=request.target_parent_task_id,
                target_position=request.target_position,
                moved_by=request.moved_by,
            )
        elif request.target_story_id:
            success, result = await task_service.move_task_to_story(
                task_id=task_id,
                target_story_id=request.target_story_id,
                target_position=request.target_position,
                moved_by=request.moved_by,
            )
        else:
            raise HTTPException(status_code=400, detail={"error": "target_story_id or target_parent_task_id is required"})

        if not success:
            detail = result if isinstance(result, dict) else {"error": result}
            message = detail.get("error", "")
            if "not found" in message.lower():
                raise HTTPException(status_code=404, detail=detail)
            raise HTTPException(status_code=400, detail=detail)

        logfire.info(
            f"Task moved | task_id={task_id} | target_story={request.target_story_id} | "
            f"target_parent={request.target_parent_task_id} | position={request.target_position}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to move task | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    """Archive a task (soft delete)."""
    try:
        # Use TaskService to archive the task
        task_service = TaskService()
        success, result = await task_service.archive_task(task_id, archived_by="api")

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            elif "already archived" in result.get("error", "").lower():
                raise HTTPException(status_code=409, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Task archived successfully | task_id={task_id}")

        return {"message": result.get("message", "Task archived successfully")}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to archive task | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# MCP endpoints for task operations


@router.put("/mcp/tasks/{task_id}/status")
async def mcp_update_task_status(task_id: str, status: str):
    """Update task status via MCP tools."""
    try:
        logfire.info(f"MCP task status update | task_id={task_id} | status={status}")

        # Use TaskService to update the task
        task_service = TaskService()
        success, result = await task_service.update_task(
            task_id=task_id, update_fields={"status": status}
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
            else:
                raise HTTPException(status_code=500, detail=result)

        updated_task = result["task"]
        project_id = updated_task["project_id"]

        logfire.info(
            f"Task status updated | task_id={task_id} | project_id={project_id} | status={status}"
        )

        return {"message": "Task status updated successfully", "task": updated_task}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to update task status | error={str(e)} | task_id={task_id}"
        )
        raise HTTPException(status_code=500, detail=str(e))


# Progress tracking via HTTP polling - see /api/progress endpoints

# ==================== DOCUMENT MANAGEMENT ENDPOINTS ====================


