"""
Projects API endpoints for Archon

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
        success, result = task_service.get_all_project_task_counts()

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


@router.get("/projects/{project_id}/epics")
async def list_project_epics(
    project_id: str,
    request: Request,
    response: Response,
    status: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    sort: str | None = "created_at",
    order: str | None = "desc",
    limit: int = 50,
    offset: int = 0,
    if_none_match: str | None = Header(None)
):
    """List all epics for a project with standardized pagination/filtering following API design standards."""
    try:
        # Validate pagination parameters
        limit = min(max(1, limit), 100)  # Between 1-100 as per standards
        offset = max(0, offset)

        logfire.debug(
            f"Listing project epics | project_id={project_id} | status={status} | search={search} | "
            f"sort={sort} | order={order} | limit={limit} | offset={offset} | etag={if_none_match}"
        )

        # Use EpicService with full filtering support
        epic_service = EpicService()
        try:
            # Get total count for pagination
            total_count = await epic_service.count_epics(
                project_id=project_id,
                status=status,
                priority=priority,
                search=search
            )

            # Get filtered and paginated epics
            epics = await epic_service.list_epics(
                project_id=project_id,
                status=status,
                priority=priority,
                search=search,
                sort=sort,
                order=order,
                limit=limit,
                offset=offset
            )
        except Exception as e:
            logger.error(f"Failed to list project epics | error={str(e)} | project_id={project_id}")
            raise HTTPException(status_code=500, detail={"error": str(e)})

        # Build standardized response with pagination
        response_data = {
            "data": epics,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": (offset + limit) < total_count
            },
            "filters_applied": {}
        }

        # Add applied filters to response
        if status:
            response_data["filters_applied"]["status"] = status
        if priority:
            response_data["filters_applied"]["priority"] = priority
        if search:
            response_data["filters_applied"]["search"] = search
        if sort != "created_at":
            response_data["filters_applied"]["sort"] = sort
        if order != "desc":
            response_data["filters_applied"]["order"] = order

        # Generate ETag from response data (excluding timestamps for consistency)
        etag_data = {
            "count": len(epics),
            "total": total_count,
            "project_id": project_id,
            "filters": response_data["filters_applied"],
            "pagination": {"limit": limit, "offset": offset}
        }
        current_etag = generate_etag(etag_data)

        # Check if client's ETag matches (304 Not Modified)
        if check_etag(if_none_match, current_etag):
            response.status_code = 304
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "private, must-revalidate"
            response.headers["Last-Modified"] = datetime.utcnow().isoformat()
            logfire.debug(f"Epics unchanged, returning 304 | project_id={project_id} | etag={current_etag}")
            return None

        # Set ETag headers for successful response
        response.headers["ETag"] = current_etag
        response.headers["Cache-Control"] = "private, must-revalidate"
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()

        logfire.debug(
            f"Project epics retrieved | project_id={project_id} | epic_count={len(epics)} | "
            f"total={total_count} | etag={current_etag}"
        )

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list project epics | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/epics")
async def create_project_epic(project_id: str, request: CreateEpicRequest):
    """Create a new epic for a project."""
    try:
        logfire.info(
            f"Creating epic for project | project_id={project_id} | title={request.title}"
        )

        # Use EpicService to create epic
        epic_service = EpicService()
        success, result = await epic_service.create_epic(
            project_id=project_id,
            title=request.title,
            description=request.description or "",
            status=request.status or "todo",
            priority=request.priority or "medium",
            # mvp_flag=request.mvp_flag or False,  # Not in TRAXIS schema
            business_value=request.business_value,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result)

        logfire.info(
            f"Epic created successfully | project_id={project_id} | epic_id={result['epic']['id']}"
        )

        return {"message": "Epic created successfully", "epic": result["epic"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create epic | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/epics/story-counts")
async def get_epics_story_counts(
    request: Request,
    response: Response,
):
    """
    Get story counts for all epics in a single batch query.
    Optimized endpoint to avoid N+1 query problem.

    Returns counts grouped by epic_id with todo, doing, review, waiting, and done counts.
    """
    try:
        # Get If-None-Match header for ETag comparison
        if_none_match = request.headers.get("If-None-Match")

        logfire.debug(f"Getting story counts for all epics | etag={if_none_match}")

        # Use StoryService to get batch story counts
        story_service = StoryService()
        success, result = await story_service.get_all_epic_story_counts()

        if not success:
            logfire.error(f"Failed to get story counts | error={result.get('error')}")
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
            logfire.debug(f"Story counts unchanged, returning 304 | etag={current_etag}")
            return None

        # Set ETag headers for successful response
        response.headers["ETag"] = current_etag
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()

        logfire.debug(
            f"Story counts retrieved | epic_count={len(result)} | etag={current_etag}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get story counts | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/epics/{epic_id}")
async def get_epic(epic_id: str):
    """Get a specific epic by ID."""
    try:
        logfire.info(f"Getting epic | epic_id={epic_id}")

        # Use EpicService to get the epic
        epic_service = EpicService()
        epic = await epic_service.get_epic(epic_id)

        logfire.info(
            f"Epic retrieved successfully | epic_id={epic_id} | project_id={epic.get('project_id')}"
        )

        return epic

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get epic | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/epics/{epic_id}")
async def update_epic(epic_id: str, request: UpdateEpicRequest):
    """Update an epic."""
    try:
        logfire.info(f"Updating epic | epic_id={epic_id}")

        # Build update fields dictionary
        update_fields = {}
        if request.title is not None:
            update_fields["title"] = request.title
        if request.description is not None:
            update_fields["description"] = request.description
        if request.status is not None:
            update_fields["status"] = request.status
        if request.priority is not None:
            update_fields["priority"] = request.priority
        # if request.mvp_flag is not None:  # Not in TRAXIS schema
        #     update_fields["mvp_flag"] = request.mvp_flag
        if request.business_value is not None:
            update_fields["business_value"] = request.business_value

        # Use EpicService to update the epic
        epic_service = EpicService()
        updated_epic = await epic_service.update_epic(epic_id, update_fields)

        logfire.info(
            f"Epic updated successfully | epic_id={epic_id} | project_id={updated_epic.get('project_id')} | updated_fields={list(update_fields.keys())}"
        )

        return {"message": "Epic updated successfully", "epic": updated_epic}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to update epic | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/epics/{epic_id}")
async def delete_epic(epic_id: str):
    """Delete an epic (soft delete)."""
    try:
        logfire.info(f"Deleting epic | epic_id={epic_id}")

        # Use EpicService to delete the epic
        epic_service = EpicService()
        success, result = await epic_service.delete_epic(epic_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            elif "already archived" in result.get("error", "").lower():
                raise HTTPException(status_code=409, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Epic deleted successfully | epic_id={epic_id}")

        return {"message": result.get("message", "Epic deleted successfully")}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to delete epic | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== STORY MANAGEMENT ENDPOINTS ====================


@router.get("/epics/{epic_id}/stories")
async def list_epic_stories(
    epic_id: str,
    request: Request,
    response: Response,
    status: str | None = None,
    if_none_match: str | None = Header(None)
):
    """List all stories for a specific epic with ETag support and optional filtering."""
    try:
        logfire.debug(
            f"Listing epic stories | epic_id={epic_id} | status={status} | etag={if_none_match}"
        )

        # Use StoryService to list stories
        story_service = StoryService()
        success, result = await story_service.list_stories(
            epic_id=epic_id,
            status=status
        )

        if not success:
            raise HTTPException(status_code=500, detail=result)

        stories = result.get("stories", [])

        # Generate ETag from story data (excluding timestamps for consistency)
        etag_data = {
            "stories": [{
                "id": story.get("id"),
                "title": story.get("title"),
                "status": story.get("status"),
                "priority": story.get("priority"),
                "story_points": story.get("story_points"),
                # "mvp_flag": story.get("mvp_flag")  # Not in TRAXIS schema
            } for story in stories],
            "epic_id": epic_id,
            "count": len(stories)
        }
        current_etag = generate_etag(etag_data)

        # Check if client's ETag matches (304 Not Modified)
        if check_etag(if_none_match, current_etag):
            response.status_code = 304
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            response.headers["Last-Modified"] = datetime.utcnow().isoformat()
            logfire.debug(f"Stories unchanged, returning 304 | epic_id={epic_id} | etag={current_etag}")
            return None

        # Set ETag headers for successful response
        response.headers["ETag"] = current_etag
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()

        logfire.debug(
            f"Epic stories retrieved | epic_id={epic_id} | story_count={len(stories)} | etag={current_etag}"
        )

        return stories

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list epic stories | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/epics/{epic_id}/stories/reorder")
async def reorder_epic_stories(epic_id: str, request: ReorderStoriesRequest):
    """Reorder stories within an epic."""
    try:
        story_service = StoryService()
        success, result = await story_service.reorder_stories_in_epic(epic_id, request.story_ids)

        if not success:
            detail = result.get("error") if isinstance(result, dict) else result
            # Treat missing stories as bad request to encourage clients to refresh
            raise HTTPException(status_code=400, detail=result if isinstance(result, dict) else {"error": detail})

        logfire.info(
            f"Stories reordered | epic_id={epic_id} | count={len(request.story_ids)}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to reorder stories | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/epics/{epic_id}/stories")
async def create_epic_story(epic_id: str, request: CreateStoryRequest):
    """Create a new story for an epic."""
    try:
        logfire.info(
            f"Creating story for epic | epic_id={epic_id} | title={request.title}"
        )

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
            epic_id=epic_id,
            title=request.title,
            description=request.description or "",
            status=request.status or "todo",
            priority=convert_priority_to_int(request.priority),  # 🟢 FIXED: Convert to int
            story_points=request.story_points,
            acceptance_criteria=request.acceptance_criteria,
            # mvp_flag=request.mvp_flag or False,  # Not in TRAXIS schema
        )

        # Check if result indicates an error
        if "error" in result:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result.get("error"))

        logfire.info(
            f"Story created successfully | epic_id={epic_id} | story_id={result.get('id', 'unknown')}"
        )

        return {"message": "Story created successfully", "story": result}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create story | error={str(e)} | epic_id={epic_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/stories/{story_id}")
async def get_story(story_id: str):
    """Get a specific story by ID."""
    try:
        logfire.info(f"Getting story | story_id={story_id}")

        # Use StoryService to get the story
        story_service = StoryService()
        success, result = story_service.get_story(story_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        story = result["story"]

        logfire.info(
            f"Story retrieved successfully | story_id={story_id} | epic_id={story.get('epic_id')}"
        )

        return story

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get story | error={str(e)} | story_id={story_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/stories/{story_id}")
async def update_story(story_id: str, request: UpdateStoryRequest):
    """Update a story."""
    try:
        logfire.info(f"Updating story | story_id={story_id}")

        # Build update fields dictionary
        update_fields = {}
        if request.title is not None:
            update_fields["title"] = request.title
        if request.description is not None:
            update_fields["description"] = request.description
        if request.status is not None:
            update_fields["status"] = request.status
        if request.priority is not None:
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
            update_fields["priority"] = convert_priority_to_int(request.priority)
        if request.story_points is not None:
            update_fields["story_points"] = request.story_points
        if request.acceptance_criteria is not None:
            update_fields["acceptance_criteria"] = request.acceptance_criteria
        # if request.mvp_flag is not None:  # Not in TRAXIS schema
        #     update_fields["mvp_flag"] = request.mvp_flag

        # Use StoryService to update the story
        story_service = StoryService()
        success, result = await story_service.update_story(
            story_id=story_id,
            **update_fields  # 🟢 FIXED: Unpack dict to individual parameters
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        updated_story = result["story"]

        logfire.info(
            f"Story updated successfully | story_id={story_id} | epic_id={updated_story.get('epic_id')} | updated_fields={list(update_fields.keys())}"
        )

        return {"message": "Story updated successfully", "story": updated_story}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to update story | error={str(e)} | story_id={story_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/stories/{story_id}/move")
async def move_story(story_id: str, request: MoveStoryRequest):
    """Move a story to a different epic and optionally reposition it."""
    try:
        story_service = StoryService()
        success, result = await story_service.move_story_to_epic(
            story_id=story_id,
            target_epic_id=request.target_epic_id,
            target_position=request.target_position,
            moved_by=request.moved_by,
        )

        if not success:
            detail = result if isinstance(result, dict) else {"error": result}
            message = detail.get("error", "")
            if "not found" in message.lower():
                raise HTTPException(status_code=404, detail=detail)
            raise HTTPException(status_code=400, detail=detail)

        logfire.info(
            f"Story moved | story_id={story_id} | target_epic_id={request.target_epic_id} | position={request.target_position}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to move story | error={str(e)} | story_id={story_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/stories/{story_id}")
async def delete_story(story_id: str):
    """Delete a story (soft delete)."""
    try:
        logfire.info(f"Deleting story | story_id={story_id}")

        # Use StoryService to delete the story
        story_service = StoryService()
        success, result = await story_service.delete_story(story_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            elif "already archived" in result.get("error", "").lower():
                raise HTTPException(status_code=409, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Story deleted successfully | story_id={story_id}")

        return {"message": result.get("message", "Story deleted successfully")}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to delete story | error={str(e)} | story_id={story_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== GENERIC HIERARCHICAL ENDPOINTS ====================


@router.get("/epics")
async def list_all_epics(
    status: str | None = None,
    project_id: str | None = None,
    include_closed: bool = True,
    page: int = 1,
    per_page: int = 10,
    exclude_large_fields: bool = False,
    q: str | None = None,  # Search query parameter
):
    """List epics across all projects with optional filters including status, project and keyword search."""
    try:
        logfire.info(
            f"Listing all epics | status={status} | project_id={project_id} | include_closed={include_closed} | page={page} | per_page={per_page} | q={q}"
        )

        epic_service = EpicService()

        # Build filters for epic service
        filters = {}
        if status:
            filters["status"] = status
        if not include_closed:
            filters["exclude_done"] = True

        # Use project-specific listing if project_id provided
        if project_id:
            try:
                epics = await epic_service.list_epics(
                    project_id=project_id,
                    status=status,
                    include_archived=include_closed,
                    limit=per_page,
                    offset=(page - 1) * per_page
                )
                total_count = len(epics)  # For now, basic count
            except Exception as e:
                logger.error(f"Failed to list epics | error={str(e)}")
                raise HTTPException(status_code=500, detail={"error": str(e)})
        else:
            # This would need a new method in EpicService to list across all projects
            # For now, return empty result with appropriate message
            return {
                "epics": [],
                "total_count": 0,
                "message": "Cross-project epic listing not yet implemented. Use project_id parameter."
            }

        # Apply search filter if provided (basic implementation)
        if q:
            q_lower = q.lower()
            filtered_epics = []
            for epic in epics:
                if (q_lower in epic.get("title", "").lower() or
                    q_lower in epic.get("description", "").lower()):
                    filtered_epics.append(epic)
            epics = filtered_epics
            total_count = len(epics)  # Update count after filtering

        # Exclude large fields for MCP optimization
        if exclude_large_fields:
            for epic in epics:
                if "description" in epic and len(epic["description"]) > 1000:
                    epic["description"] = epic["description"][:1000] + "..."

            return {
                "epics": epics,
                "total_count": total_count,
                "count": len(epics)
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to list epics"))

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list epics | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/stories")
async def list_all_stories(
    status: str | None = None,
    epic_id: str | None = None,
    project_id: str | None = None,
    include_closed: bool = True,
    page: int = 1,
    per_page: int = 10,
    exclude_large_fields: bool = False,
    q: str | None = None,  # Search query parameter
):
    """List stories across all epics with optional filters including status, epic, project and keyword search."""
    try:
        logfire.info(
            f"Listing all stories | status={status} | epic_id={epic_id} | project_id={project_id} | include_closed={include_closed} | page={page} | per_page={per_page} | q={q}"
        )

        story_service = StoryService()

        # List stories with optional filters
        success, result = await story_service.list_stories(
            epic_id=epic_id,
            project_id=project_id,
            status=status,
            include_archived=include_closed,
            limit=per_page,
            offset=(page - 1) * per_page
        )

        if success:
            stories = result.get("stories", [])
            total_count = result.get("total_count", 0)

            # Apply search filter if provided (basic implementation)
            if q:
                q_lower = q.lower()
                filtered_stories = []
                for story in stories:
                    if (q_lower in story.get("title", "").lower() or
                        q_lower in story.get("description", "").lower()):
                        filtered_stories.append(story)
                stories = filtered_stories
                total_count = len(stories)  # Update count after filtering

            # Exclude large fields for MCP optimization
            if exclude_large_fields:
                for story in stories:
                    if "description" in story and len(story["description"]) > 1000:
                        story["description"] = story["description"][:1000] + "..."
                    if "acceptance_criteria" in story and isinstance(story["acceptance_criteria"], list):
                        story["acceptance_criteria_count"] = len(story["acceptance_criteria"])
                        del story["acceptance_criteria"]

            return {
                "stories": stories,
                "total_count": total_count,
                "count": len(stories)
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to list stories"))

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list stories | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== DEPENDENCY MANAGEMENT ENDPOINTS ====================


@router.post("/dependencies")
async def create_dependency(request: dict):
    """Create a new dependency between hierarchy items with cycle detection."""
    try:
        # Extract parameters
        from_type = request.get("from_type")
        from_id = request.get("from_id")
        to_type = request.get("to_type")
        to_id = request.get("to_id")
        dependency_type = request.get("dependency_type")
        description = request.get("description", "")
        validate_cycles = request.get("validate_cycles", True)

        # Validate required fields
        if not all([from_type, from_id, to_type, to_id, dependency_type]):
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: from_type, from_id, to_type, to_id, dependency_type"
            )

        # Validate types
        valid_types = ["epic", "story", "task"]
        if from_type not in valid_types or to_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid item type. Must be one of: {valid_types}"
            )

        # Validate dependency type
        valid_dep_types = ["blocks", "depends_on", "related_to", "precedes", "follows"]
        if dependency_type not in valid_dep_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid dependency type. Must be one of: {valid_dep_types}"
            )

        # Prevent self-dependency
        if from_type == to_type and from_id == to_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot create dependency to self"
            )

        # Create dependency using direct database call
        # TODO: Create DependencyService for better architecture
        supabase = get_supabase_client()

        # Check for existing dependency
        existing = supabase.table("archon_dependencies").select("id").eq("dependent_item_type", from_type).eq("dependent_item_id", from_id).eq("dependency_item_type", to_type).eq("dependency_item_id", to_id).eq("dependency_type", dependency_type).execute()

        if existing.data:
            raise HTTPException(
                status_code=409,
                detail="Dependency already exists"
            )

        # Create the dependency
        dependency_data = {
            "dependent_item_type": from_type,
            "dependent_item_id": from_id,
            "dependency_item_type": to_type,
            "dependency_item_id": to_id,
            "dependency_type": dependency_type,
            "description": description
        }

        result = supabase.table("archon_dependencies").insert(dependency_data).execute()

        if result.data:
            dependency = result.data[0]
            return {
                "dependency": dependency,
                "message": "Dependency created successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create dependency")

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create dependency | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/{item_type}/{item_id}/dependencies")
async def get_item_dependencies(item_type: str, item_id: str):
    """Get all dependencies for an item (both incoming and outgoing)."""
    try:
        # Validate item type
        valid_types = ["epic", "story", "task"]
        if item_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid item type. Must be one of: {valid_types}"
            )

        supabase = get_supabase_client()

        # Get outgoing dependencies (what this item depends on)
        outgoing = supabase.table("archon_dependencies").select("*").eq("dependent_item_type", item_type).eq("dependent_item_id", item_id).execute()

        # Get incoming dependencies (what depends on this item)
        incoming = supabase.table("archon_dependencies").select("*").eq("dependency_item_type", item_type).eq("dependency_item_id", item_id).execute()

        dependencies = {
            "outgoing": outgoing.data or [],
            "incoming": incoming.data or [],
            "total_count": len(outgoing.data or []) + len(incoming.data or [])
        }

        return {"dependencies": dependencies}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get dependencies | error={str(e)} | item_type={item_type} | item_id={item_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/dependencies/{dependency_id}")
async def delete_dependency(dependency_id: str):
    """Delete a dependency by ID."""
    try:
        supabase = get_supabase_client()

        result = supabase.table("archon_dependencies").delete().eq("id", dependency_id).execute()

        if result.data:
            return {"message": "Dependency deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Dependency not found")

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to delete dependency | error={str(e)} | dependency_id={dependency_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== HIERARCHY NAVIGATION ENDPOINTS ====================


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
        success, result = task_service.get_task(task_id)

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
        success, result = task_service.get_subtasks_by_parent(task_id)

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


@router.get("/projects/{project_id}/docs")
async def list_project_documents(project_id: str, include_content: bool = False):
    """
    List all documents for a specific project.
    
    Args:
        project_id: Project UUID
        include_content: If True, includes full document content.
                        If False (default), returns metadata only.
    """
    try:
        logfire.info(
            f"Listing documents for project | project_id={project_id} | include_content={include_content}"
        )

        # Use DocumentService to list documents
        document_service = DocumentService()
        success, result = document_service.list_documents(project_id, include_content=include_content)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Documents listed successfully | project_id={project_id} | count={result.get('total_count', 0)} | lightweight={not include_content}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list documents | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/docs")
async def create_project_document(project_id: str, request: CreateDocumentRequest):
    """Create a new document for a project."""
    try:
        logfire.info(
            f"Creating document for project | project_id={project_id} | title={request.title}"
        )

        # Use DocumentService to create document
        document_service = DocumentService()
        success, result = document_service.add_document(
            project_id=project_id,
            document_type=request.document_type,
            title=request.title,
            content=request.content,
            tags=request.tags,
            author=request.author,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result)

        logfire.info(
            f"Document created successfully | project_id={project_id} | doc_id={result['document']['id']}"
        )

        return {"message": "Document created successfully", "document": result["document"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create document | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}/docs/{doc_id}")
async def get_project_document(project_id: str, doc_id: str):
    """Get a specific document from a project."""
    try:
        logfire.info(f"Getting document | project_id={project_id} | doc_id={doc_id}")

        # Use DocumentService to get document
        document_service = DocumentService()
        success, result = document_service.get_document(project_id, doc_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Document retrieved successfully | project_id={project_id} | doc_id={doc_id}")

        return result["document"]

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to get document | error={str(e)} | project_id={project_id} | doc_id={doc_id}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/projects/{project_id}/docs/{doc_id}")
async def update_project_document(project_id: str, doc_id: str, request: UpdateDocumentRequest):
    """Update a document in a project."""
    try:
        logfire.info(f"Updating document | project_id={project_id} | doc_id={doc_id}")

        # Build update fields
        update_fields = {}
        if request.title is not None:
            update_fields["title"] = request.title
        if request.content is not None:
            update_fields["content"] = request.content
        if request.tags is not None:
            update_fields["tags"] = request.tags
        if request.author is not None:
            update_fields["author"] = request.author

        # Use DocumentService to update document
        document_service = DocumentService()
        success, result = document_service.update_document(project_id, doc_id, update_fields)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Document updated successfully | project_id={project_id} | doc_id={doc_id}")

        return {"message": "Document updated successfully", "document": result["document"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to update document | error={str(e)} | project_id={project_id} | doc_id={doc_id}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/projects/{project_id}/docs/{doc_id}")
async def delete_project_document(project_id: str, doc_id: str):
    """Delete a document from a project."""
    try:
        logfire.info(f"Deleting document | project_id={project_id} | doc_id={doc_id}")

        # Use DocumentService to delete document
        document_service = DocumentService()
        success, result = document_service.delete_document(project_id, doc_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Document deleted successfully | project_id={project_id} | doc_id={doc_id}")

        return {"message": "Document deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to delete document | error={str(e)} | project_id={project_id} | doc_id={doc_id}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== VERSION MANAGEMENT ENDPOINTS ====================


@router.get("/projects/{project_id}/versions")
async def list_project_versions(project_id: str, field_name: str = None):
    """List version history for a project's JSONB fields."""
    try:
        logfire.info(
            f"Listing versions for project | project_id={project_id} | field_name={field_name}"
        )

        # Use VersioningService to list versions
        versioning_service = VersioningService()
        success, result = versioning_service.list_versions(project_id, field_name)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Versions listed successfully | project_id={project_id} | count={result.get('total_count', 0)}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list versions | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/versions")
async def create_project_version(project_id: str, request: CreateVersionRequest):
    """Create a version snapshot for a project's JSONB field."""
    try:
        logfire.info(
            f"Creating version for project | project_id={project_id} | field_name={request.field_name}"
        )

        # Use VersioningService to create version
        versioning_service = VersioningService()
        success, result = versioning_service.create_version(
            project_id=project_id,
            field_name=request.field_name,
            content=request.content,
            change_summary=request.change_summary,
            change_type=request.change_type,
            document_id=request.document_id,
            created_by=request.created_by,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result)

        logfire.info(
            f"Version created successfully | project_id={project_id} | version_number={result['version_number']}"
        )

        return {"message": "Version created successfully", "version": result["version"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create version | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}/versions/{field_name}/{version_number}")
async def get_project_version(project_id: str, field_name: str, version_number: int):
    """Get a specific version's content."""
    try:
        logfire.info(
            f"Getting version | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        # Use VersioningService to get version content
        versioning_service = VersioningService()
        success, result = versioning_service.get_version_content(
            project_id, field_name, version_number
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Version retrieved successfully | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to get version | error={str(e)} | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/versions/{field_name}/{version_number}/restore")
async def restore_project_version(
    project_id: str, field_name: str, version_number: int, request: RestoreVersionRequest
):
    """Restore a project's JSONB field to a specific version."""
    try:
        logfire.info(
            f"Restoring version | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        # Use VersioningService to restore version
        versioning_service = VersioningService()
        success, result = versioning_service.restore_version(
            project_id=project_id,
            field_name=field_name,
            version_number=version_number,
            restored_by=request.restored_by,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Version restored successfully | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        return {
            "message": f"Successfully restored {field_name} to version {version_number}",
            **result,
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to restore version | error={str(e)} | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== MIGRATION ENDPOINT (TEMPORARY) ====================

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
