"""
Projects API - Refactored core module
Contains: Core project endpoints + MCP direct endpoints + Admin endpoints

Handles:
- Project management (CRUD operations)
- Task management with hierarchical structure
- Streaming project creation with DocumentAgent integration
- HTTP polling for progress updates
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi import status as http_status
from pydantic import BaseModel

# Removed direct logging import - using unified config
# Set up standard logger for background tasks
from ..config.logfire_config import get_logger, logfire
from ..utils import get_supabase_client
from ..utils.etag_utils import check_etag, generate_etag

logger = get_logger(__name__)

# Service imports
from ..services.projects import (
    ProjectCreationService,
    ProjectService,
    SourceLinkingService,
    TaskService,
)
from ..services.projects.epic_service import EpicService
from ..services.projects.story_service import StoryService
from ..services.projects.document_service import DocumentService
from ..services.projects.versioning_service import VersioningService

# Using HTTP polling for real-time updates

router = APIRouter(prefix="/api", tags=["projects"])


class CreateProjectRequest(BaseModel):
    title: str
    description: str | None = None
    github_repo: str | None = None
    docs: list[Any] | None = None
    features: list[Any] | None = None
    data: list[Any] | None = None
    technical_sources: list[str] | None = None  # List of knowledge source IDs
    business_sources: list[str] | None = None  # List of knowledge source IDs
    pinned: bool | None = None  # Whether this project should be pinned to top


class UpdateProjectRequest(BaseModel):
    title: str | None = None
    description: str | None = None  # Add description field
    github_repo: str | None = None
    docs: list[Any] | None = None
    features: list[Any] | None = None
    data: list[Any] | None = None
    technical_sources: list[str] | None = None  # List of knowledge source IDs
    business_sources: list[str] | None = None  # List of knowledge source IDs
    pinned: bool | None = None  # Whether this project is pinned to top


class CreateTaskRequest(BaseModel):
    project_id: str
    title: str
    description: str | None = None
    status: str | None = "todo"
    assignee: str | None = "User"
    task_order: int | None = 0
    feature: str | None = None
    story_id: str | None = None  # Support for hierarchy
    parent_task_id: str | None = None  # Support for subtasks
    priority: str | None = "medium"


class CreateEpicRequest(BaseModel):
    title: str
    description: str | None = None
    status: str | None = "todo"
    priority: str | None = "medium"
    # mvp_flag: bool | None = False  # Not in TRAXIS schema
    business_value: dict[str, Any] | None = None


class UpdateEpicRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    # mvp_flag: bool | None = None  # Not in TRAXIS schema
    business_value: dict[str, Any] | None = None


class CreateStoryRequest(BaseModel):
    title: str
    description: str | None = None
    status: str | None = "todo"
    priority: str | None = "medium"
    story_points: int | None = None
    acceptance_criteria: dict[str, Any] | None = None
    # mvp_flag: bool | None = False  # Not in TRAXIS schema


class UpdateStoryRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    story_points: int | None = None
    acceptance_criteria: dict[str, Any] | None = None
    # mvp_flag: bool | None = None  # Not in TRAXIS schema


class ReorderStoriesRequest(BaseModel):
    story_ids: list[str]


class MoveStoryRequest(BaseModel):
    target_epic_id: str
    target_position: int | None = None
    moved_by: str | None = None


@router.get("/projects")
async def list_projects(
    response: Response,
    include_content: bool = True,
    if_none_match: str | None = Header(None)
):
    """
    List all projects.
    
    Args:
        include_content: If True (default), returns full project content.
                        If False, returns lightweight metadata with statistics.
    """
    try:
        logfire.debug(f"Listing all projects | include_content={include_content}")

        # Use ProjectService to get projects with include_content parameter
        project_service = ProjectService()
        success, result = project_service.list_projects(include_content=include_content)

        if not success:
            raise HTTPException(status_code=500, detail=result)

        # Only format with sources if we have full content
        if include_content:
            # Use SourceLinkingService to format projects with sources
            source_service = SourceLinkingService()
            formatted_projects = source_service.format_projects_with_sources(result["projects"])
        else:
            # Lightweight response doesn't need source formatting
            formatted_projects = result["projects"]

        # Monitor response size for optimization validation
        response_json = json.dumps(formatted_projects)
        response_size = len(response_json)

        # Log response metrics
        logfire.debug(
            f"Projects listed successfully | count={len(formatted_projects)} | "
            f"size_bytes={response_size} | include_content={include_content}"
        )

        # Log large responses at debug level (>100KB is worth noting, but normal for project data)
        if response_size > 100000:
            logfire.debug(
                f"Large response size | size_bytes={response_size} | "
                f"include_content={include_content} | project_count={len(formatted_projects)}"
            )

        # Generate ETag from stable data (excluding timestamp)
        etag_data = {
            "projects": formatted_projects,
            "count": len(formatted_projects)
        }
        current_etag = generate_etag(etag_data)

        # Generate response with timestamp for polling
        response_data = {
            "projects": formatted_projects,
            "timestamp": datetime.utcnow().isoformat(),
            "count": len(formatted_projects)
        }

        # Check if client's ETag matches
        if check_etag(if_none_match, current_etag):
            response.status_code = http_status.HTTP_304_NOT_MODIFIED
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            return None

        # Set headers
        response.headers["ETag"] = current_etag
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()
        response.headers["Cache-Control"] = "no-cache, must-revalidate"

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list projects | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects")
async def create_project(request: CreateProjectRequest):
    """Create a new project with streaming progress."""
    # Validate title
    if not request.title:
        raise HTTPException(status_code=422, detail="Title is required")

    if not request.title.strip():
        raise HTTPException(status_code=422, detail="Title cannot be empty")

    try:
        logfire.info(
            f"Creating new project | title={request.title} | github_repo={request.github_repo}"
        )

        # Prepare kwargs for additional project fields
        kwargs = {}
        if request.pinned is not None:
            kwargs["pinned"] = request.pinned
        if request.features:
            kwargs["features"] = request.features
        if request.data:
            kwargs["data"] = request.data

        # Create project directly with AI assistance
        project_service = ProjectCreationService()
        success, result = await project_service.create_project_with_ai(
            progress_id="direct",  # No progress tracking needed
            title=request.title,
            description=request.description,
            github_repo=request.github_repo,
            **kwargs,
        )

        if success:
            logfire.info(f"Project created successfully | project_id={result['project_id']}")
            return {
                "project_id": result["project_id"],
                "project": result.get("project"),
                "status": "completed",
                "message": f"Project '{request.title}' created successfully",
            }
        else:
            raise HTTPException(status_code=500, detail=result)

    except Exception as e:
        logfire.error(f"Failed to start project creation | error={str(e)} | title={request.title}")
        raise HTTPException(status_code=500, detail={"error": str(e)})




@router.get("/projects/health")
async def projects_health():
    """Health check for projects API and database schema validation."""
    try:
        logfire.info("Projects health check requested")
        supabase_client = get_supabase_client()

        # Check if projects table exists by testing ProjectService
        try:
            project_service = ProjectService(supabase_client)
            # Try to list projects with limit 1 to test table access
            success, _ = project_service.list_projects()
            projects_table_exists = success
            if success:
                logfire.info("Projects table detected successfully")
            else:
                logfire.warning("Projects table access failed")
        except Exception as e:
            projects_table_exists = False
            logfire.warning(f"Projects table not found | error={str(e)}")

        # Check if tasks table exists by testing TaskService
        try:
            task_service = TaskService(supabase_client)
            # Try to list tasks with limit 1 to test table access
            success, _ = await task_service.list_tasks(include_closed=True)
            tasks_table_exists = success
            if success:
                logfire.info("Tasks table detected successfully")
            else:
                logfire.warning("Tasks table access failed")
        except Exception as e:
            tasks_table_exists = False
            logfire.warning(f"Tasks table not found | error={str(e)}")

        schema_valid = projects_table_exists and tasks_table_exists

        result = {
            "status": "healthy" if schema_valid else "schema_missing",
            "service": "projects",
            "schema": {
                "projects_table": projects_table_exists,
                "tasks_table": tasks_table_exists,
                "valid": schema_valid,
            },
        }

        logfire.info(
            f"Projects health check completed | status={result['status']} | schema_valid={schema_valid}"
        )

        return result

    except Exception as e:
        logfire.error(f"Projects health check failed | error={str(e)}")
        return {
            "status": "error",
            "service": "projects",
            "error": str(e),
            "schema": {"projects_table": False, "tasks_table": False, "valid": False},
        }


@router.get("/projects/task-counts")
async def get_all_task_counts(
    request: Request,
    response: Response,
):
    """
    Get task counts for all projects in a single batch query.
    Optimized endpoint to avoid N+1 query problem.
    
    Returns counts grouped by project_id with todo, doing, and done counts.
    Review status is included in doing count to match frontend logic.
    """
    try:
        # Get If-None-Match header for ETag comparison
        if_none_match = request.headers.get("If-None-Match")

        logfire.debug(f"Getting task counts for all projects | etag={if_none_match}")

        # Use TaskService to get batch task counts
        # Get client explicitly to ensure mocking works in tests
        supabase_client = get_supabase_client()
        task_service = TaskService(supabase_client)
        success, result = await task_service.get_all_project_task_counts()

        if not success:
            logfire.error(f"Failed to get task counts | error={result.get('error')}")
            raise HTTPException(status_code=500, detail=result)

        # Generate ETag from counts data
        etag_data = {
            "counts": result,
            "count": len(result)
        }
        current_etag = generate_etag(etag_data)

        # Check if client's ETag matches (304 Not Modified)
        if check_etag(if_none_match, current_etag):
            response.status_code = 304
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            logfire.debug(f"Task counts unchanged, returning 304 | etag={current_etag}")
            return None

        # Set ETag headers for successful response
        response.headers["ETag"] = current_etag
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()

        logfire.debug(
            f"Task counts retrieved | project_count={len(result)} | etag={current_etag}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get task counts | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Get a specific project."""
    try:
        logfire.info(f"Getting project | project_id={project_id}")

        # Use ProjectService to get the project
        project_service = ProjectService()
        success, result = project_service.get_project(project_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                logfire.warning(f"Project not found | project_id={project_id}")
                raise HTTPException(status_code=404, detail=result)
            else:
                raise HTTPException(status_code=500, detail=result)

        project = result["project"]

        logfire.info(
            f"Project retrieved successfully | project_id={project_id} | title={project['title']}"
        )

        # The ProjectService already includes sources, so just add any missing fields
        return {
            **project,
            "description": project.get("description", ""),
            "docs": project.get("docs", []),
            "features": project.get("features", []),
            "data": project.get("data", []),
            "pinned": project.get("pinned", False),
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get project | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/projects/{project_id}")
async def update_project(project_id: str, request: UpdateProjectRequest):
    """Update a project with comprehensive Logfire monitoring."""
    try:
        supabase_client = get_supabase_client()

        # Build update fields from request
        update_fields = {}
        if request.title is not None:
            update_fields["title"] = request.title
        if request.description is not None:
            update_fields["description"] = request.description
        if request.github_repo is not None:
            update_fields["github_repo"] = request.github_repo
        if request.docs is not None:
            update_fields["docs"] = request.docs
        if request.features is not None:
            update_fields["features"] = request.features
        if request.data is not None:
            update_fields["data"] = request.data
        if request.pinned is not None:
            update_fields["pinned"] = request.pinned

        # Create version snapshots for JSONB fields before updating
        if update_fields:
            try:
                from ..services.projects.versioning_service import VersioningService

                versioning_service = VersioningService(supabase_client)

                # Get current project for comparison
                project_service = ProjectService(supabase_client)
                success, current_result = project_service.get_project(project_id)

                if success and current_result.get("project"):
                    current_project = current_result["project"]
                    version_count = 0

                    # Create versions for updated JSONB fields
                    for field_name in ["docs", "features", "data"]:
                        if field_name in update_fields:
                            current_content = current_project.get(field_name, {})
                            new_content = update_fields[field_name]

                            # Only create version if content actually changed
                            if current_content != new_content:
                                v_success, _ = versioning_service.create_version(
                                    project_id=project_id,
                                    field_name=field_name,
                                    content=current_content,
                                    change_summary=f"Updated {field_name} via API",
                                    change_type="update",
                                    created_by="api_user",
                                )
                                if v_success:
                                    version_count += 1

                    logfire.info(f"Created {version_count} version snapshots before update")
            except ImportError:
                logfire.warning("VersioningService not available - skipping version snapshots")
            except Exception as e:
                logfire.warning(f"Failed to create version snapshots: {e}")
                # Don't fail the update, just log the warning

        # Use ProjectService to update the project
        project_service = ProjectService(supabase_client)
        success, result = project_service.update_project(project_id, update_fields)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(
                    status_code=404, detail={"error": f"Project with ID {project_id} not found"}
                )
            else:
                raise HTTPException(status_code=500, detail=result)

        project = result["project"]

        # Handle source updates using SourceLinkingService
        source_service = SourceLinkingService(supabase_client)

        if request.technical_sources is not None or request.business_sources is not None:
            source_success, source_result = source_service.update_project_sources(
                project_id=project_id,
                technical_sources=request.technical_sources,
                business_sources=request.business_sources,
            )

            if source_success:
                logfire.info(
                    f"Project sources updated | project_id={project_id} | technical_success={source_result.get('technical_success', 0)} | technical_failed={source_result.get('technical_failed', 0)} | business_success={source_result.get('business_success', 0)} | business_failed={source_result.get('business_failed', 0)}"
                )
            else:
                logfire.warning(f"Failed to update some sources: {source_result}")

        # Format project response with sources using SourceLinkingService
        formatted_project = source_service.format_project_with_sources(project)

        logfire.info(
            f"Project updated successfully | project_id={project_id} | title={project.get('title')} | technical_sources={len(formatted_project.get('technical_sources', []))} | business_sources={len(formatted_project.get('business_sources', []))}"
        )

        return formatted_project

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Project update failed | project_id={project_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project and all its tasks."""
    try:
        logfire.info(f"Deleting project | project_id={project_id}")

        # Use ProjectService to delete the project
        project_service = ProjectService()
        success, result = project_service.delete_project(project_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result)
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Project deleted successfully | project_id={project_id} | deleted_tasks={result.get('deleted_tasks', 0)}"
        )

        return {
            "message": "Project deleted successfully",
            "deleted_tasks": result.get("deleted_tasks", 0),
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to delete project | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}/features")
async def get_project_features(project_id: str):
    """Get features from a project's features JSONB field."""
    try:
        logfire.info(f"Getting project features | project_id={project_id}")

        # Use ProjectService to get features
        project_service = ProjectService()
        success, result = project_service.get_project_features(project_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                logfire.warning(f"Project not found for features | project_id={project_id}")
                raise HTTPException(status_code=404, detail=result)
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Project features retrieved | project_id={project_id} | feature_count={result.get('count', 0)}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get project features | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== EPIC MANAGEMENT ENDPOINTS ====================


@router.get("/projects/{project_id}/hierarchy")
async def get_project_hierarchy(
    project_id: str,
    request: Request,
    response: Response,
    include_tasks: bool = True,
    include_archived: bool = False,
    if_none_match: str | None = Header(None)
):
    """Get complete project hierarchy: Project > Epics > Stories > Tasks > Subtasks with ETag support."""
    try:
        logfire.debug(
            f"🚀 API get_project_hierarchy called | project_id={project_id} | include_tasks={include_tasks} | include_archived={include_archived} | etag={if_none_match}"
        )

        # Get project
        project_service = ProjectService()
        project_success, project_result = project_service.get_project(project_id)

        if not project_success:
            if "not found" in project_result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=project_result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=project_result)

        project = project_result["project"]

        # Get epics for this project
        epic_service = EpicService()
        try:
            epics = await epic_service.list_epics(
                project_id=project_id
            )
        except Exception as e:
            logger.error(f"Failed to list epics for project dashboard | error={str(e)} | project_id={project_id}")
            raise HTTPException(status_code=500, detail={"error": str(e)})

        # For each epic, get its stories
        story_service = StoryService()
        for epic in epics:
            story_success, story_result = await story_service.list_stories(
                epic_id=epic["id"]
            )
            if story_success:
                epic["stories"] = story_result.get("stories", [])

                # For each story, get its tasks if requested
                if include_tasks:
                    task_service = TaskService()
                    for story in epic["stories"]:
                        task_success, task_result = await task_service.list_tasks(
                            story_id=story["id"],
                            include_closed=True,
                            include_archived=include_archived
                        )
                        if task_success:
                            story["tasks"] = task_result.get("tasks", [])

                            # Get all subtasks for this story's tasks in one efficient query
                            if story["tasks"]:
                                task_ids = [task["id"] for task in story["tasks"]]

                                # Build a query to get all subtasks for all tasks at once
                                subtasks_query = task_service.supabase_client.table("archon_tasks").select("*").in_("parent_task_id", task_ids)

                                if not include_archived:
                                    subtasks_query = subtasks_query.or_("archived.is.null,archived.is.false")

                                subtasks_response = subtasks_query.order("parent_task_id", desc=False).order("task_order", desc=False).execute()

                                # Group subtasks by parent_task_id
                                subtasks_by_parent = {}
                                for subtask in subtasks_response.data or []:
                                    parent_id = subtask["parent_task_id"]
                                    if parent_id not in subtasks_by_parent:
                                        subtasks_by_parent[parent_id] = []
                                    subtasks_by_parent[parent_id].append(subtask)

                                # Assign subtasks to their parent tasks
                                for task in story["tasks"]:
                                    task["subtasks"] = subtasks_by_parent.get(task["id"], [])
                        else:
                            story["tasks"] = []
            else:
                epic["stories"] = []

        # Build hierarchy response
        hierarchy = {
            "project": {
                "id": project["id"],
                "title": project["title"],
                "description": project.get("description", ""),
                "epics": epics
            },
            "metadata": {
                "epic_count": len(epics),
                "story_count": sum(len(epic.get("stories", [])) for epic in epics),
                "task_count": sum(
                    len(story.get("tasks", []))
                    for epic in epics
                    for story in epic.get("stories", [])
                ) if include_tasks else 0,
                "subtask_count": sum(
                    len(task.get("subtasks", []))
                    for epic in epics
                    for story in epic.get("stories", [])
                    for task in story.get("tasks", [])
                ) if include_tasks else 0,
                "include_tasks": include_tasks,
                "include_archived": include_archived
            }
        }

        # 🎯 FIX: Generate ETag from complete hierarchy content, not just counts
        # This ensures that any changes to task priority, status, assignee, etc. will generate a new ETag
        logfire.debug(f"🚀 API generating ETag from complete hierarchy content | project_id={project_id}")
        etag_data = {
            "project_id": project_id,
            "include_tasks": include_tasks,
            "include_archived": include_archived,
            "hierarchy_content": hierarchy  # Include the complete hierarchy content
        }
        current_etag = generate_etag(etag_data)
        logfire.debug(f"🚀 API generated new ETag | project_id={project_id} | etag={current_etag}")

        # Check if client's ETag matches (304 Not Modified)
        if check_etag(if_none_match, current_etag):
            response.status_code = 304
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            response.headers["Last-Modified"] = datetime.utcnow().isoformat()
            logfire.debug(f"🚀 API hierarchy unchanged, returning 304 | project_id={project_id} | etag={current_etag}")
            return None

        # Set ETag headers for successful response
        response.headers["ETag"] = current_etag
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()

        logfire.debug(
            f"🚀 API project hierarchy retrieved | project_id={project_id} | epic_count={len(epics)} | story_count={hierarchy['metadata']['story_count']} | task_count={hierarchy['metadata']['task_count']} | subtask_count={hierarchy['metadata']['subtask_count']} | etag={current_etag}"
        )

        return hierarchy

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"🚀 API get_project_hierarchy ERROR | project_id={project_id} | error={str(e)}")
        logger.error(f"Failed to get project hierarchy | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/admin/fix-waiting-status")
async def fix_waiting_status():
    """
    TEMPORARY ENDPOINT: Add 'waiting' to task_status enum to fix HTTP 500 errors
    when saving tasks with 'waiting' status.

    This resolves the mismatch between frontend (expects 'waiting') and
    database (only has 'brainstorming', 'todo', 'doing', 'review', 'done').
    """
    try:
        logfire.info("🔧 Starting fix_waiting_status migration")

        # Use TaskService to get database connection
        task_service = TaskService()

        # Check current enum values using direct database query
        check_sql = """
            SELECT enumlabel
            FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_status')
            ORDER BY enumsortorder;
        """

        # Execute query through TaskService's database connection
        current_values = []
        try:
            # Get database connection pool from TaskService
            async with task_service.db_pool.acquire() as conn:
                # Check current enum values
                rows = await conn.fetch(check_sql)
                current_values = [row['enumlabel'] for row in rows]

                logfire.info(f"📋 Current task_status enum values: {current_values}")

                if 'waiting' in current_values:
                    return {
                        "success": True,
                        "message": "Status 'waiting' already exists in task_status enum",
                        "current_values": current_values
                    }

                # Add 'waiting' to the enum
                add_enum_sql = "ALTER TYPE task_status ADD VALUE 'waiting' AFTER 'review';"
                await conn.execute(add_enum_sql)

                # Verify the addition
                verify_rows = await conn.fetch(check_sql)
                updated_values = [row['enumlabel'] for row in verify_rows]

                logfire.info(f"✅ Successfully added 'waiting' status. New values: {updated_values}")

                return {
                    "success": True,
                    "message": "Successfully added 'waiting' status to task_status enum",
                    "previous_values": current_values,
                    "updated_values": updated_values,
                    "fix_applied": "The 'En attente' (waiting) status now works without HTTP 500 errors"
                }

        except Exception as db_error:
            error_msg = str(db_error)
            if "already exists" in error_msg.lower():
                return {
                    "success": True,
                    "message": "Status 'waiting' already exists in task_status enum",
                    "note": "No migration needed"
                }

            logfire.error(f"❌ Database error: {error_msg}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": f"Database error: {error_msg}",
                    "solution": "Try running the migration manually in Supabase SQL editor",
                    "sql_command": "ALTER TYPE task_status ADD VALUE 'waiting' AFTER 'review';"
                }
            )

    except Exception as e:
        error_msg = str(e)
        logfire.error(f"❌ Failed to fix waiting status: {error_msg}")

        raise HTTPException(
            status_code=500,
            detail={
                "error": f"Failed to add waiting status to enum: {error_msg}",
                "solution": "Try running the migration manually in Supabase SQL editor",
                "sql_command": "ALTER TYPE task_status ADD VALUE 'waiting' AFTER 'review';"
            }
        )


# ==================== MCP DIRECT ENDPOINTS ====================


@router.post("/api/epics")
async def create_epic_mcp(request: CreateEpicRequest):
    """Create a new epic directly via MCP (requires project_id in request)."""
    try:
        logfire.info(
            f"Creating epic via MCP | project_id={request.project_id} | title={request.title}"
        )

        if not request.project_id:
            raise HTTPException(status_code=400, detail="project_id is required")

        # Use EpicService to create epic
        epic_service = EpicService()
        success, result = await epic_service.create_epic(
            project_id=request.project_id,
            title=request.title,
            description=request.description or "",
            status=request.status or "todo",
            priority=request.priority or "medium",
            business_value=request.business_value,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result)

        logfire.info(
            f"Epic created successfully via MCP | project_id={request.project_id} | epic_id={result['epic']['id']}"
        )

        return {"message": "Epic created successfully", "epic": result["epic"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create epic via MCP | error={str(e)} | project_id={getattr(request, 'project_id', 'unknown')}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/api/stories")
async def create_story_mcp(request: CreateStoryRequest):
    """Create a new story directly via MCP (requires epic_id in request)."""
    try:
        logfire.info(
            f"Creating story via MCP | epic_id={request.epic_id} | title={request.title}"
        )

        if not request.epic_id:
            raise HTTPException(status_code=400, detail="epic_id is required")

        # Convert priority string to integer for service layer
        def convert_priority_to_int(priority_str: str | None) -> int:
            """Convert priority string to integer expected by service layer."""
            priority_map = {
                "low": 25,
                "medium": 50,
                "high": 75,
                "critical": 100
            }
            return priority_map.get(priority_str or "medium", 50)

        # Use StoryService to create story
        story_service = StoryService()
        result = await story_service.create_story(
            epic_id=request.epic_id,
            title=request.title,
            description=request.description or "",
            status=request.status or "todo",
            priority=convert_priority_to_int(request.priority),
            story_points=request.story_points,
            acceptance_criteria=request.acceptance_criteria,
        )

        # Check if result indicates an error
        if "error" in result:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result.get("error"))

        logfire.info(
            f"Story created successfully via MCP | epic_id={request.epic_id} | story_id={result.get('id', 'unknown')}"
        )

        return {"message": "Story created successfully", "story": result}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create story via MCP | error={str(e)} | epic_id={getattr(request, 'epic_id', 'unknown')}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/api/tasks")
async def create_task_mcp(request: CreateTaskRequest):
    """Create a new task directly via MCP (requires project_id in request, optional story_id/parent_task_id)."""
    try:
        logfire.info(
            f"Creating task via MCP | project_id={request.project_id} | title={request.title}"
        )

        if not request.project_id:
            raise HTTPException(status_code=400, detail="project_id is required")

        # Use TaskService to create task
        task_service = TaskService()
        success, result = await task_service.create_task(
            project_id=request.project_id,
            story_id=request.story_id,
            parent_task_id=request.parent_task_id,
            title=request.title,
            description=request.description or "",
            status=request.status or "todo",
            assignee=request.assignee,
            priority=request.priority or "medium",
            task_order=request.task_order or 0,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result)

        logfire.info(
            f"Task created successfully via MCP | project_id={request.project_id} | task_id={result['task']['id']}"
        )

        return {"message": "Task created successfully", "task": result["task"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create task via MCP | error={str(e)} | project_id={getattr(request, 'project_id', 'unknown')}")
        raise HTTPException(status_code=500, detail={"error": str(e)})
