"""
Projects-specific API endpoints for Archon

Handles core project operations:
- Project CRUD operations
- Project health monitoring
- Project features management
"""

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

# Service imports
from ..services.projects import (
    ProjectCreationService,
    ProjectService,
    SourceLinkingService,
)

router = APIRouter(prefix="/api", tags=["projects"])


class CreateProjectRequest(BaseModel):
    title: str
    description: str | None = None
    github_repo: str | None = None
    docs: list[Any] | None = None
    features: list[Any] | None = None
    data: list[Any] | None = None
    technical_sources: list[str] | None = None
    business_sources: list[str] | None = None
    pinned: bool | None = None


class UpdateProjectRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    github_repo: str | None = None
    docs: list[Any] | None = None
    features: list[Any] | None = None
    data: list[Any] | None = None
    technical_sources: list[str] | None = None
    business_sources: list[str] | None = None
    pinned: bool | None = None


@router.get("/projects")
async def list_projects(
    project_id: str | None = None,
    query: str | None = None,
    page: int = 1,
    per_page: int = 50,
    include_docs: bool = False,
    include_features: bool = False,
    exclude_large_fields: bool = True,
    if_none_match: str | None = Header(None),
) -> dict[str, Any]:
    """List all projects with optional filtering and ETag support."""
    try:
        logfire.info(
            f"Listing projects | project_id={project_id} | query={query} | page={page} | per_page={per_page}"
        )

        project_service = ProjectService()

        # If specific project requested
        if project_id:
            success, result = await project_service.get_project(
                project_id=project_id,
                include_docs=include_docs,
                include_features=include_features,
            )

            if not success:
                if "not found" in result.get("error", "").lower():
                    raise HTTPException(status_code=404, detail=result.get("error"))
                raise HTTPException(status_code=500, detail=result.get("error"))

            # Generate ETag for individual project
            etag_content = json.dumps(result["project"], sort_keys=True)
            etag = generate_etag(etag_content)

            # Check if client has latest version
            if check_etag(if_none_match, etag):
                return Response(status_code=304)

            # Build response
            response_data = {
                "success": True,
                "project": result["project"],
            }

            response = Response(
                content=json.dumps(response_data),
                media_type="application/json",
                headers={"ETag": etag},
            )
            return response

        # List all projects
        success, result = await project_service.list_projects(
            query=query,
            page=page,
            per_page=per_page,
            include_docs=include_docs,
            include_features=include_features,
        )

        if not success:
            raise HTTPException(status_code=500, detail=result.get("error"))

        projects = result["projects"]

        # Exclude large fields for MCP optimization
        if exclude_large_fields:
            for project in projects:
                if "description" in project and len(project["description"]) > 1000:
                    project["description"] = project["description"][:1000] + "..."

        # Generate ETag for projects list
        etag_content = json.dumps(projects, sort_keys=True)
        etag = generate_etag(etag_content)

        # Check if client has latest version
        if check_etag(if_none_match, etag):
            return Response(status_code=304)

        response_data = {
            "success": True,
            "projects": projects,
            "total": result.get("total", len(projects)),
            "page": page,
            "per_page": per_page,
            "query": query,
        }

        response = Response(
            content=json.dumps(response_data),
            media_type="application/json",
            headers={"ETag": etag},
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list projects | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects")
async def create_project(request: CreateProjectRequest) -> dict[str, Any]:
    """Create a new project with all features."""
    try:
        logfire.info(f"Creating project | title={request.title}")

        project_creation_service = ProjectCreationService()

        # Create project
        success, result = await project_creation_service.create_project(
            title=request.title,
            description=request.description,
            github_repo=request.github_repo,
            docs=request.docs or [],
            features=request.features or [],
            data=request.data or [],
            technical_sources=request.technical_sources or [],
            business_sources=request.business_sources or [],
            pinned=request.pinned or False,
        )

        if not success:
            raise HTTPException(status_code=400, detail=result)

        logfire.info(f"Project created successfully | project_id={result['project']['id']}")

        return {
            "message": f"Project '{request.title}' created successfully",
            "project": result["project"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create project | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/health")
async def get_projects_health() -> dict[str, Any]:
    """Get health status for all projects."""
    try:
        project_service = ProjectService()
        success, result = await project_service.get_projects_health()

        if not success:
            raise HTTPException(status_code=500, detail=result.get("error"))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get projects health | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/task-counts")
async def get_all_project_task_counts() -> dict[str, Any]:
    """Get task counts for all projects."""
    try:
        from ..services.projects import TaskService

        task_service = TaskService()
        success, result = await task_service.get_all_project_task_counts()

        if not success:
            raise HTTPException(status_code=500, detail=result.get("error"))

        return {
            "success": True,
            "project_task_counts": result["project_task_counts"],
            "total_projects": result["total_projects"],
            "timestamp": datetime.now().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get all project task counts | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    include_docs: bool = False,
    include_features: bool = False,
    if_none_match: str | None = Header(None),
) -> dict[str, Any]:
    """Get a specific project by ID with ETag support."""
    try:
        logfire.info(f"Getting project | project_id={project_id}")

        project_service = ProjectService()
        success, result = await project_service.get_project(
            project_id=project_id,
            include_docs=include_docs,
            include_features=include_features,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            raise HTTPException(status_code=500, detail=result.get("error"))

        # Generate ETag
        etag_content = json.dumps(result["project"], sort_keys=True)
        etag = generate_etag(etag_content)

        # Check if client has latest version
        if check_etag(if_none_match, etag):
            return Response(status_code=304)

        response_data = {
            "success": True,
            "project": result["project"],
        }

        response = Response(
            content=json.dumps(response_data),
            media_type="application/json",
            headers={"ETag": etag},
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get project | project_id={project_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/projects/{project_id}")
async def update_project(project_id: str, request: UpdateProjectRequest) -> dict[str, Any]:
    """Update a project."""
    try:
        logfire.info(f"Updating project | project_id={project_id}")

        project_service = ProjectService()

        # Build update data
        update_data = {}
        if request.title is not None:
            update_data["title"] = request.title
        if request.description is not None:
            update_data["description"] = request.description
        if request.github_repo is not None:
            update_data["github_repo"] = request.github_repo
        if request.docs is not None:
            update_data["docs"] = request.docs
        if request.features is not None:
            update_data["features"] = request.features
        if request.data is not None:
            update_data["data"] = request.data
        if request.technical_sources is not None:
            update_data["technical_sources"] = request.technical_sources
        if request.business_sources is not None:
            update_data["business_sources"] = request.business_sources
        if request.pinned is not None:
            update_data["pinned"] = request.pinned

        success, result = await project_service.update_project(
            project_id=project_id, **update_data
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            raise HTTPException(status_code=400, detail=result.get("error"))

        logfire.info(f"Project updated successfully | project_id={project_id}")

        return {
            "success": True,
            "message": "Project updated successfully",
            "project": result["project"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to update project | project_id={project_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str) -> dict[str, Any]:
    """Delete a project and all its associated data."""
    try:
        logfire.info(f"Deleting project | project_id={project_id}")

        project_service = ProjectService()
        success, result = await project_service.delete_project(project_id=project_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            raise HTTPException(status_code=500, detail=result.get("error"))

        logfire.info(f"Project deleted successfully | project_id={project_id}")

        return {"success": True, "message": "Project deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to delete project | project_id={project_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}/features")
async def get_project_features(project_id: str) -> dict[str, Any]:
    """Get features for a specific project."""
    try:
        logfire.info(f"Getting project features | project_id={project_id}")

        project_service = ProjectService()
        success, result = await project_service.get_project(
            project_id=project_id, include_features=True
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            raise HTTPException(status_code=500, detail=result.get("error"))

        features = result["project"].get("features", {})

        return {
            "success": True,
            "features": features,
            "project_id": project_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get project features | project_id={project_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})